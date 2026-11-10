#!/usr/bin/env python3
"""Check the Codex loader, or verify the installed development plugin read-only."""
import argparse
import hashlib
import json
import os
import pathlib
import queue
import re
import shutil
import subprocess
import tempfile
import threading
import time


class CodexClient:
    def __init__(self, executable, stderr):
        self.proc = subprocess.Popen(
            [executable, 'app-server', '--stdio'], stdin=subprocess.PIPE,
            stdout=subprocess.PIPE, stderr=stderr, text=True, bufsize=1,
            env={**os.environ, 'RUST_LOG': 'codex_core_plugins=warn'})
        self.messages = queue.Queue()
        self.ident = 0
        threading.Thread(target=self._read, daemon=True).start()

    def _read(self):
        try:
            for line in self.proc.stdout:
                self.messages.put(json.loads(line))
        finally:
            self.messages.put(None)

    def rpc(self, method, params):
        self.ident += 1
        self.proc.stdin.write(json.dumps({
            'id': self.ident, 'method': method, 'params': params}) + '\n')
        self.proc.stdin.flush()
        deadline = time.monotonic() + 90
        while time.monotonic() < deadline:
            try:
                response = self.messages.get(timeout=1)
            except queue.Empty:
                continue
            if response is None:
                raise RuntimeError('Codex app-server exited before responding')
            if 'id' in response and 'method' in response:
                # Verification never approves a request for broader access.
                self.proc.stdin.write(json.dumps({
                    'id': response['id'], 'error': {
                        'code': -32601, 'message': 'Interactive approval is not supported by this read-only check'}
                }) + '\n')
                self.proc.stdin.flush()
                continue
            if response.get('id') == self.ident:
                if 'error' in response:
                    raise RuntimeError(str(response['error']))
                return response['result']
        raise TimeoutError(method)

    def close(self):
        self.proc.terminate()
        try:
            self.proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.proc.kill()
            self.proc.wait()


def file_hashes(root):
    result = {}
    if not root.is_dir():
        raise RuntimeError(f'Missing plugin directory: {root}')
    for path in sorted(root.rglob('*')):
        if path.is_symlink():
            raise RuntimeError(f'Plugin file must not be a symlink: {path}')
        if path.is_file():
            result[str(path.relative_to(root))] = hashlib.sha256(path.read_bytes()).hexdigest()
    return result


def device_summary(result):
    if result.get('isError'):
        raise RuntimeError('list_devices returned an MCP error')
    value = result.get('structuredContent')
    if value is None:
        for block in result.get('content', []):
            if block.get('type') == 'text':
                try:
                    value = json.loads(block['text'])
                except (KeyError, ValueError):
                    continue
                break
    devices = value.get('devices') if isinstance(value, dict) else None
    if not isinstance(devices, list) or any(not isinstance(item, dict) for item in devices):
        raise RuntimeError('list_devices did not return a device list')
    # Keep account/device identifiers and contents out of the validation report.
    return {'device_count': len(devices),
            'online_count': sum(item.get('online') is True for item in devices)}


def app_id_from_source(source, manifest):
    if any((source / name).exists() for name in ('mcp.json', '.mcp.json')):
        raise RuntimeError('Direct MCP configuration is not supported; use the registered App package')
    extension = manifest.get('extensions', {}).get('com.openai', {}) if '$schema' in manifest else manifest
    if extension.get('apps') != './.app.json':
        raise RuntimeError('Missing required App declaration')
    binding = json.loads((source / '.app.json').read_text())
    apps = binding.get('apps', {})
    if set(binding) != {'apps'} or set(apps) != {'remote-device-hub'}:
        raise RuntimeError('Expected exactly one remote-device-hub App binding')
    app = apps['remote-device-hub']
    if (set(app) != {'id', 'required'} or app.get('required') is not True or
            not isinstance(app.get('id'), str) or
            not re.fullmatch(r'(?:asdk_app_|connector_|templated_apps_)[a-zA-Z0-9_-]+', app['id'])):
        raise RuntimeError('Invalid required App binding')
    return app['id']


def check_connection(client, source, manifest, report, connection_id=None):
    app_id = app_id_from_source(source, manifest)
    report.update(app_id=app_id, connection='registered-app', passed=False)
    thread = client.rpc('thread/start', {'cwd': str(source), 'ephemeral': True,
                                       'sandbox': 'read-only', 'approvalPolicy': 'never'})
    thread_id = thread['thread']['id']
    metadata = client.rpc('app/read', {'threadId': thread_id, 'appIds': [app_id], 'includeTools': True})
    apps = [app for app in metadata.get('apps', []) if app.get('id') == app_id]
    if len(apps) != 1 or app_id in metadata.get('missingAppIds', []):
        raise RuntimeError('Required RDH App is unavailable to this account; verify its registered identity and access')
    report['app_available'] = True
    snapshot = client.rpc('app/installed', {'threadId': thread_id, 'forceRefresh': True})
    installed = [app for app in snapshot.get('apps', []) if app.get('id') == app_id]
    if len(installed) != 1 or not installed[0].get('enabled') or not installed[0].get('callable'):
        raise RuntimeError('Required RDH App is not connected and callable; complete its Connect flow for the intended RDH account')
    report['app_callable'] = True
    status = client.rpc('mcpServerStatus/list', {'threadId': thread_id, 'serverName': 'codex_apps', 'detail': 'full'})
    servers = [item for item in status.get('data', []) if item.get('name') == 'codex_apps']
    if len(servers) != 1 or servers[0].get('toolsError'):
        raise RuntimeError('Hosted App tools are unavailable')
    candidates = []
    for tool in servers[0].get('tools', {}).values():
        meta = tool.get('_meta') or {}
        if (meta.get('connector_id') == app_id and
                tool.get('name', '').rsplit('.', 1)[-1] == 'list_devices' and
                (connection_id is None or meta.get('link_id') == connection_id)):
            candidates.append(tool)
    if len(candidates) != 1:
        raise RuntimeError('Expected one list_devices tool for this App connection; select the intended account or pass --connection-id')
    tool = candidates[0]
    if ((tool.get('annotations') or {}).get('readOnlyHint') is not True or
            tool.get('inputSchema', {}).get('required')):
        raise RuntimeError('App list_devices must be read-only and accept empty arguments')
    result = client.rpc('mcpServer/tool/call', {'threadId': thread_id, 'server': 'codex_apps',
                                              'tool': tool['name'], 'arguments': {}})
    report.update(tool=tool['name'], **device_summary(result), passed=True)


def check_installed(client, source, manifest, report, connection_id=None):
    app_id_from_source(source, manifest)
    plugin_id = manifest['name'] + '@rdh-development'
    report['plugin_id'] = plugin_id
    catalog = client.rpc('plugin/installed', {'cwds': [str(source)]})
    entries = [entry for market in catalog['marketplaces'] for entry in market['plugins']
               if entry['id'] == plugin_id]
    if len(entries) != 1 or not entries[0]['installed'] or not entries[0]['enabled']:
        raise RuntimeError('The development plugin must be installed and enabled; run npm run dev:install')
    entry = entries[0]
    version = entry.get('localVersion') or entry.get('version')
    report.update(installed=True, version=version)
    if version != manifest['version']:
        raise RuntimeError('Installed version differs from the generated development source')
    codex_root = pathlib.Path(os.environ.get('CODEX_HOME', '~/.codex')).expanduser()
    cache = codex_root / 'plugins/cache/rdh-development' / manifest['name'] / version
    report['installed_files_match'] = file_hashes(source) == file_hashes(cache)
    if not report['installed_files_match']:
        raise RuntimeError('Installed files differ from the generated source; run npm run dev:install')
    check_connection(client, source, manifest, report, connection_id)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--codex', default='codex')
    parser.add_argument('--source', type=pathlib.Path,
                        default=pathlib.Path(__file__).resolve().parents[1] / '.build/development/plugins/remote-device-hub')
    parser.add_argument('--installed', action='store_true',
                        help='Verify the installed App package and call its authenticated list_devices')
    parser.add_argument('--connection', action='store_true', help='Verify the registered App connection without requiring local plugin installation')
    parser.add_argument('--connection-id', help='Explicit hosted connection ID when multiple RDH accounts are connected')
    args = parser.parse_args()
    source = args.source.resolve()
    manifest_path = source / 'plugin.json'
    if not manifest_path.exists():
        manifest_path = source / '.codex-plugin/plugin.json'
    manifest = json.loads(manifest_path.read_text())
    name = manifest['name']
    expected_apps = [app_id_from_source(source, manifest)]
    if args.installed and args.connection:
        parser.error('Choose --installed or --connection')
    with tempfile.TemporaryDirectory(prefix='rdh-plugin-preflight-') as temp:
        root = pathlib.Path(temp)
        shutil.copytree(source, root / name)
        directory = root / '.agents/plugins'
        directory.mkdir(parents=True)
        market = directory / 'marketplace.json'
        market.write_text(json.dumps({'name': 'rdh-preflight', 'plugins': [{
            'name': name, 'source': {'source': 'local', 'path': './' + name},
            'policy': {'installation': 'AVAILABLE', 'authentication': 'ON_INSTALL'},
            'category': 'Other'}]}))
        with (root / 'stderr.log').open('w+') as stderr:
            client = CodexClient(args.codex, stderr)
            report = {'source': str(source), 'passed': False, 'installed': False}
            try:
                initialized = client.rpc('initialize', {
                    'clientInfo': {'name': 'rdh-plugin-preflight', 'version': '1'},
                    'capabilities': {'experimentalApi': True}})
                report['client'] = initialized['userAgent']
                if args.installed:
                    check_installed(client, source, manifest, report, args.connection_id)
                    print(json.dumps(report, indent=2))
                    return 0
                if args.connection:
                    check_connection(client, source, manifest, report, args.connection_id)
                    print(json.dumps(report, indent=2))
                    return 0
                result = client.rpc('plugin/read', {'marketplacePath': str(market), 'pluginName': name})
                loaded = sorted(result['plugin']['mcpServers'])
                loaded_apps = sorted(a['id'] for a in result['plugin']['apps'])
                passed = not loaded and loaded_apps == expected_apps
                print(json.dumps({'client': initialized['userAgent'], 'source': str(source),
                                  'direct_mcp_servers': loaded,
                                  'expected_apps': expected_apps, 'loaded_apps': loaded_apps,
                                  'passed': passed, 'installed': False}, indent=2))
                if not passed:
                    stderr.flush()
                    stderr.seek(0)
                    for line in stderr:
                        if 'failed to parse plugin MCP server' in line:
                            print(line.strip())
                    return 1
                return 0
            except (RuntimeError, TimeoutError) as error:
                report['error'] = str(error)
                print(json.dumps(report, indent=2))
                return 1
            finally:
                client.close()


if __name__ == '__main__':
    raise SystemExit(main())
