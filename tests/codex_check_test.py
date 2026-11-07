import importlib.util
import io
import json
import pathlib
import queue
import tempfile
import unittest
from unittest.mock import Mock, patch

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / 'scripts/check_codex_plugin.py'
SPEC = importlib.util.spec_from_file_location('codex_check', SCRIPT)
CHECK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECK)


class InstalledCheckTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.source = pathlib.Path(self.temp.name)
        (self.source / 'mcp.json').write_text('{}')
        self.manifest = {'name': 'remote-device-hub', 'version': '1.3.14'}
        self.entry = {'id': 'remote-device-hub@rdh-development', 'installed': True,
                      'enabled': True, 'localVersion': '1.3.14'}
        self.server = {'name': 'remote-device-hub', 'pluginId': self.entry['id'],
                       'authStatus': 'oAuth', 'runtimeStatus': 'connected',
                       'tools': {'list_devices': {'name': 'list_devices'}}}
        self.tool_result = {'structuredContent': {'devices': [
            {'device_id': 'private-device-id', 'online': True}, {'online': False}]}}
        self.client = Mock()
        self.client.rpc.side_effect = self.rpc
        self.hashes = patch.object(CHECK, 'file_hashes', return_value={'mcp.json': 'hash'})
        self.hash_mock = self.hashes.start()
        self.addCleanup(self.hashes.stop)

    def rpc(self, method, params):
        return {
            'plugin/installed': {'marketplaces': [{'plugins': [self.entry]}]},
            'thread/start': {'thread': {'id': 'test-thread'}},
            'mcpServerStatus/list': {'data': [self.server]},
            'mcpServer/tool/call': self.tool_result,
        }[method]

    def verify(self):
        report = {'passed': False}
        CHECK.check_installed(self.client, self.source, self.manifest, report)
        return report

    def assert_no_tool_call(self):
        self.assertNotIn('mcpServer/tool/call', [call.args[0] for call in self.client.rpc.call_args_list])

    def test_installed_call_returns_counts_without_device_data(self):
        report = self.verify()
        self.assertTrue(report['passed'])
        self.assertEqual((report['device_count'], report['online_count']), (2, 1))
        self.assertNotIn('private-device-id', json.dumps(report))
        self.client.rpc.assert_any_call('mcpServer/tool/call', {
            'threadId': 'test-thread', 'server': 'remote-device-hub',
            'tool': 'list_devices', 'arguments': {}})

    def test_old_version_cannot_pass(self):
        self.entry['localVersion'] = '1.0.0'
        with self.assertRaisesRegex(RuntimeError, 'version differs'):
            self.verify()
        self.assert_no_tool_call()

    def test_changed_installation_cannot_pass(self):
        self.hash_mock.side_effect = [{'file': 'new'}, {'file': 'old'}]
        with self.assertRaisesRegex(RuntimeError, 'files differ'):
            self.verify()
        self.assert_no_tool_call()

    def test_another_plugin_connection_is_rejected(self):
        self.server['pluginId'] = 'remote-device-hub@another-marketplace'
        with self.assertRaisesRegex(RuntimeError, 'does not belong'):
            self.verify()
        self.assert_no_tool_call()

    def test_missing_authorization_cannot_pass(self):
        self.server['authStatus'] = 'notLoggedIn'
        with self.assertRaisesRegex(RuntimeError, 'OAuth authorization required'):
            self.verify()
        self.assert_no_tool_call()

    def test_mcp_errors_and_unexpected_responses_cannot_pass(self):
        for value in [{'isError': True}, {'structuredContent': {}},
                      {'structuredContent': {'devices': None}},
                      {'structuredContent': {'devices': ['not-a-device']}}]:
            with self.subTest(value=value), self.assertRaises(RuntimeError):
                CHECK.device_summary(value)
        self.assertEqual(CHECK.device_summary({'content': [
            {'type': 'text', 'text': '{"devices":[]}'}]}),
            {'device_count': 0, 'online_count': 0})

    def test_interactive_request_is_refused_even_when_ids_overlap(self):
        client = CHECK.CodexClient.__new__(CHECK.CodexClient)
        client.ident = 0
        client.proc = Mock(stdin=io.StringIO())
        client.messages = queue.Queue()
        client.messages.put({'id': 1, 'method': 'item/permissions/requestApproval'})
        client.messages.put({'id': 1, 'result': {'ok': True}})
        self.assertEqual(client.rpc('read-only-check', {}), {'ok': True})
        sent = [json.loads(line) for line in client.proc.stdin.getvalue().splitlines()]
        self.assertEqual(sent[1]['error']['code'], -32601)
        self.assertNotIn('result', sent[1])


if __name__ == '__main__':
    unittest.main()
