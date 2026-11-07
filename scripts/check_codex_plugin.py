#!/usr/bin/env python3
"""Check the Codex loader, or verify the installed development plugin read-only."""
import argparse
import hashlib
import json
import os
import pathlib
import queue
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


def check_installed(client, source, manifest, report):
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
    if not (source / 'mcp.json').is_file():
        raise RuntimeError('Installed verification requires the default direct-MCP development build')
    thread = client.rpc('thread/start', {'cwd': str(source), 'ephemeral': True,
                                       'sandbox': 'read-only', 'approvalPolicy': 'never'})
    thread_id = thread['thread']['id']
    status = client.rpc('mcpServerStatus/list', {
        'threadId': thread_id, 'serverName': manifest['name'], 'detail': 'full'})
    servers = [item for item in status['data'] if item['name'] == manifest['name']]
    if len(servers) != 1 or servers[0].get('pluginId') != plugin_id:
        raise RuntimeError('The active MCP server does not belong to the development plugin')
    server = servers[0]
    report.update(auth_status=server['authStatus'], runtime_status=server.get('runtimeStatus'),
                  tool_count=len(server['tools']))
    if server['authStatus'] != 'oAuth':
        raise RuntimeError('OAuth authorization required; connect the development plugin in Codex, then rerun')
    if server.get('toolsError'):
        raise RuntimeError(server['toolsError'])
    if not any(tool.get('name') == 'list_devices' for tool in server['tools'].values()):
        raise RuntimeError('The installed server did not expose list_devices')
    result = client.rpc('mcpServer/tool/call', {
        'threadId': thread_id, 'server': manifest['name'], 'tool': 'list_devices', 'arguments': {}})
    report.update(tool='list_devices', **device_summary(result), passed=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--codex', default='codex')
    parser.add_argument('--source', type=pathlib.Path,
                        default=pathlib.Path(__file__).resolve().parents[1] / '.build/development/plugins/remote-device-hub')
    parser.add_argument('--installed', action='store_true',
                        help='Verify the installed rdh-development version, OAuth, and list_devices')
    args = parser.parse_args()
    source = args.source.resolve()
    manifest_path = source / 'plugin.json'
    if not manifest_path.exists():
        manifest_path = source / '.codex-plugin/plugin.json'
    manifest = json.loads(manifest_path.read_text())
    name = manifest['name']
    mcp_path = next((source / p for p in ['mcp.json', '.mcp.json'] if (source / p).exists()), None)
    expected = sorted(json.loads(mcp_path.read_text())['mcpServers']) if mcp_path else []
    apps_path = source / '.app.json'
    expected_apps = sorted(a['id'] for a in json.loads(apps_path.read_text())['apps'].values()) if apps_path.exists() else []
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
                    check_installed(client, source, manifest, report)
                    print(json.dumps(report, indent=2))
                    return 0
                result = client.rpc('plugin/read', {'marketplacePath': str(market), 'pluginName': name})
                loaded = sorted(result['plugin']['mcpServers'])
                loaded_apps = sorted(a['id'] for a in result['plugin']['apps'])
                passed = bool(expected or expected_apps) and loaded == expected and loaded_apps == expected_apps
                print(json.dumps({'client': initialized['userAgent'], 'source': str(source),
                                  'expected_mcp_servers': expected, 'loaded_mcp_servers': loaded,
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
