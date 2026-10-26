#!/usr/bin/env python3
"""Read the actual Codex plugin loader; never install or create an account App."""
import argparse
import json
import pathlib
import select
import shutil
import subprocess
import tempfile
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--codex', default='codex')
    parser.add_argument('--source', type=pathlib.Path,
                        default=pathlib.Path(__file__).resolve().parents[1] / 'plugins/remote-device-hub')
    args = parser.parse_args()
    source = args.source.resolve()
    manifest_path = source / 'plugin.json'
    if not manifest_path.exists():
        manifest_path = source / '.codex-plugin/plugin.json'
    name = json.loads(manifest_path.read_text())['name']
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
            proc = subprocess.Popen([args.codex, 'app-server', '--stdio'],
                                    stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                    stderr=stderr, text=True, bufsize=1)
            def rpc(ident, method, params):
                proc.stdin.write(json.dumps({'id': ident, 'method': method, 'params': params}) + '\n')
                proc.stdin.flush()
                deadline = time.monotonic() + 30
                while time.monotonic() < deadline:
                    if select.select([proc.stdout], [], [], 1)[0]:
                        line = proc.stdout.readline()
                        if not line:
                            raise RuntimeError('Codex app-server exited before responding')
                        response = json.loads(line)
                        if response.get('id') == ident:
                            if 'error' in response:
                                raise RuntimeError(str(response['error']))
                            return response['result']
                raise TimeoutError(method)
            try:
                client = rpc(1, 'initialize', {
                    'clientInfo': {'name': 'rdh-plugin-preflight', 'version': '1'},
                    'capabilities': {'experimentalApi': True}})
                result = rpc(2, 'plugin/read', {'marketplacePath': str(market), 'pluginName': name})
                loaded = sorted(result['plugin']['mcpServers'])
                loaded_apps = sorted(a['id'] for a in result['plugin']['apps'])
                passed = bool(expected or expected_apps) and loaded == expected and loaded_apps == expected_apps
                print(json.dumps({'client': client['userAgent'], 'source': str(source),
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
            finally:
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    proc.wait()


if __name__ == '__main__':
    raise SystemExit(main())
