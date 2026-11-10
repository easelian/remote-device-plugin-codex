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
        self.app_id = 'asdk_app_fixture'
        (self.source / '.app.json').write_text(json.dumps({'apps': {
            'remote-device-hub': {'id': self.app_id, 'required': True}}}))
        self.manifest = {'$schema': 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', 'name': 'remote-device-hub', 'version': '1.4.0',
                         'extensions': {'com.openai': {'apps': './.app.json'}}}
        self.entry = {'id': 'remote-device-hub@rdh-development', 'installed': True,
                      'enabled': True, 'localVersion': '1.4.0'}
        self.app = {'id': self.app_id, 'enabled': True, 'callable': True}
        self.metadata = {'apps': [{'id': self.app_id}], 'missingAppIds': []}
        self.tool = {'name': 'remote_device_hub.list_devices',
                     'inputSchema': {'type': 'object', 'properties': {}},
                     'annotations': {'readOnlyHint': True},
                     '_meta': {'connector_id': self.app_id, 'link_id': 'connection-one'}}
        self.server = {'name': 'codex_apps', 'authStatus': 'bearerToken',
                       'tools': {'remote_device_hub.list_devices': self.tool}}
        self.tool_result = {'structuredContent': {'devices': [
            {'device_id': 'private-device-id', 'online': True}, {'online': False}]}}
        self.client = Mock()
        self.client.rpc.side_effect = self.rpc
        self.hashes = patch.object(CHECK, 'file_hashes', return_value={'.app.json': 'hash'})
        self.hash_mock = self.hashes.start()
        self.addCleanup(self.hashes.stop)

    def rpc(self, method, params):
        return {
            'plugin/installed': {'marketplaces': [{'plugins': [self.entry]}]},
            'thread/start': {'thread': {'id': 'test-thread'}},
            'app/read': self.metadata,
            'app/installed': {'apps': [self.app]},
            'mcpServerStatus/list': {'data': [self.server]},
            'mcpServer/tool/call': self.tool_result,
        }[method]

    def verify(self, connection_id=None):
        report = {'passed': False}
        CHECK.check_installed(self.client, self.source, self.manifest, report, connection_id)
        return report

    def assert_no_tool_call(self):
        self.assertNotIn('mcpServer/tool/call', [call.args[0] for call in self.client.rpc.call_args_list])

    def test_app_call_returns_counts_without_device_or_connection_data(self):
        report = self.verify()
        self.assertTrue(report['passed'])
        self.assertEqual((report['device_count'], report['online_count']), (2, 1))
        self.assertNotIn('private-device-id', json.dumps(report))
        self.assertNotIn('connection-one', json.dumps(report))
        self.client.rpc.assert_any_call('mcpServer/tool/call', {
            'threadId': 'test-thread', 'server': 'codex_apps',
            'tool': 'remote_device_hub.list_devices', 'arguments': {}})

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

    def test_another_app_with_same_tool_name_is_rejected(self):
        self.tool['_meta']['connector_id'] = 'asdk_app_another'
        with self.assertRaisesRegex(RuntimeError, 'one list_devices'):
            self.verify()
        self.assert_no_tool_call()

    def test_unavailable_app_is_not_replaced_by_direct_mcp(self):
        self.metadata = {'apps': [], 'missingAppIds': [self.app_id]}
        with self.assertRaisesRegex(RuntimeError, 'unavailable'):
            self.verify()
        self.assert_no_tool_call()

    def test_missing_or_disabled_connection_cannot_pass(self):
        for field in ['callable', 'enabled']:
            with self.subTest(field=field):
                self.app[field] = False
                with self.assertRaisesRegex(RuntimeError, 'not connected and callable'):
                    self.verify()
                self.app[field] = True
        self.assert_no_tool_call()

    def test_ambiguous_account_selection_requires_explicit_connection(self):
        other = {**self.tool, 'name': 'remote_device_hub_second.list_devices',
                 '_meta': {'connector_id': self.app_id, 'link_id': 'connection-two'}}
        self.server['tools'][other['name']] = other
        with self.assertRaisesRegex(RuntimeError, 'select the intended account'):
            self.verify()
        self.assert_no_tool_call()
        self.assertTrue(self.verify('connection-two')['passed'])
        self.client.rpc.assert_any_call('mcpServer/tool/call', {
            'threadId': 'test-thread', 'server': 'codex_apps',
            'tool': other['name'], 'arguments': {}})

    def test_non_readonly_or_parameterized_tool_is_not_called(self):
        self.tool['annotations']['readOnlyHint'] = False
        with self.assertRaisesRegex(RuntimeError, 'read-only'):
            self.verify()
        self.tool['annotations']['readOnlyHint'] = True
        self.tool['inputSchema']['required'] = ['user_id']
        with self.assertRaisesRegex(RuntimeError, 'empty arguments'):
            self.verify()
        self.assert_no_tool_call()

    def test_direct_mcp_source_is_rejected(self):
        (self.source / 'mcp.json').write_text('{}')
        with self.assertRaisesRegex(RuntimeError, 'Direct MCP'):
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
