import assert from 'node:assert/strict';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { canonicalJson, hashes, object, parseJson, requiredFile } from '../scripts/common.js';
import { developmentFiles, prepare, MARKETPLACE } from '../scripts/prepare_development.js';
import { openai } from '../scripts/models.js';
import { SOURCE, sourceFiles, validate } from '../scripts/prepare_submission.js';

function fixture(t: { after(fn: () => void): void }): string {
  const root = mkdtempSync(join(tmpdir(), 'rdh-development-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(SOURCE, join(root, 'plugins/remote-device-hub'), { recursive: true });
  return root;
}

test('development preserves canonical bytes except the generated OAuth discovery config', () => {
  const source = sourceFiles(SOURCE);
  const before = hashes(source);
  const local = developmentFiles(source);
  assert.deepEqual(hashes(source), before);
  for (const [name, data] of source) {
    if (name !== 'mcp.json') {
      assert.deepEqual(requiredFile(local, name), data, name);
    }
  }
  const mcp = parseJson(requiredFile(local, 'mcp.json'));
  const original = object(
    object(parseJson(requiredFile(source, 'mcp.json')).mcpServers)['remote-device-hub'],
  );
  assert.deepEqual(object(mcp.mcpServers)['remote-device-hub'], {
    type: original.type,
    url: original.url,
  });
  assert.ok(original.extensions);
  assert.ok(!local.has('.codex-plugin/plugin.json'));
  assert.ok(!local.has('.app.json'));
  const manifest = parseJson(requiredFile(source, 'plugin.json'));
  delete object(openai(manifest).review).demo_recording_url;
  const withoutDemo = new Map(source);
  withoutDemo.set('plugin.json', canonicalJson(manifest));
  assert.ok(validate(withoutDemo)[1].includes('verified_demo_recording_url'));
  developmentFiles(withoutDemo);
});

test('existing private App bindings are applied only to generated development files', () => {
  const source = sourceFiles(SOURCE);
  const before = hashes(source);
  const binding = { apps: { fixture: { id: 'asdk_app_local_test' } } };
  const local = developmentFiles(source, binding);
  assert.deepEqual(hashes(source), before);
  assert.deepEqual(parseJson(requiredFile(local, '.app.json')), binding);
  assert.equal(openai(parseJson(requiredFile(local, 'plugin.json'))).apps, './.app.json');
  assert.ok(!local.has('mcp.json'));
  assert.throws(() => validate(local), /Private file|must not contain|Account-specific/);
  for (const bad of [
    { apps: {} },
    { apps: { fixture: { id: 'not-an-app' } } },
    { apps: { fixture: { id: 'asdk_app_local_test', token: 'secret' } } },
    { apps: { fixture: { id: 'asdk_app_local_test' } }, token: 'secret' },
  ]) {
    assert.throws(() => developmentFiles(source, bad), /binding|credentials/);
  }
});

test('marketplace points at generated files and refresh removes retired content', (t) => {
  const root = fixture(t);
  const report = prepare(root);
  const output = join(root, '.build/development');
  const catalogue = parseJson(readFileSync(join(output, '.agents/plugins/marketplace.json')));
  assert.equal(catalogue.name, MARKETPLACE);
  assert.equal(report.installed, false);
  assert.ok(Array.isArray(catalogue.plugins));
  const entry = object(catalogue.plugins[0]);
  const pluginPath = join(output, String(object(entry.source).path));
  assert.deepEqual(hashes(sourceFiles(pluginPath)), report.files);
  assert.deepEqual(object(entry.policy), {
    installation: 'AVAILABLE',
    authentication: 'ON_INSTALL',
  });
  writeFileSync(join(pluginPath, 'retired.txt'), 'old generated file');
  const skill = join(
    root,
    'plugins/remote-device-hub/skills/remote-device-operations/references/files.md',
  );
  writeFileSync(skill, readFileSync(skill, 'utf8') + '\nCurrent development change.\n');
  const changed = prepare(root);
  assert.notEqual(changed.source_sha256, report.source_sha256);
  assert.ok(!existsSync(join(pluginPath, 'retired.txt')));
  assert.match(
    readFileSync(join(pluginPath, 'skills/remote-device-operations/references/files.md'), 'utf8'),
    /Current development change/,
  );
});

test('generation refuses an unowned directory or a symlink without damaging files', (t) => {
  const root = fixture(t);
  const output = join(root, '.build/development');
  mkdirSync(output, { recursive: true });
  const sentinel = join(output, 'keep.txt');
  writeFileSync(sentinel, 'keep');
  assert.throws(() => prepare(root), /unrecognized/);
  assert.equal(readFileSync(sentinel, 'utf8'), 'keep');
  rmSync(output, { recursive: true });
  symlinkSync(join(root, 'plugins'), output);
  assert.throws(() => prepare(root), /symlink/);
  assert.ok(existsSync(join(root, 'plugins/remote-device-hub/plugin.json')));
});

test('invalid canonical data fails before replacing an existing development installation source', (t) => {
  const root = fixture(t);
  prepare(root);
  const output = join(root, '.build/development/plugins/remote-device-hub');
  const before = hashes(sourceFiles(output));
  const path = join(root, 'plugins/remote-device-hub/mcp.json');
  const mcp = parseJson(readFileSync(path));
  object(object(mcp.mcpServers)['remote-device-hub']).headers = { Authorization: 'Bearer fixture' };
  writeFileSync(path, canonicalJson(mcp));
  assert.throws(() => prepare(root), /headers/);
  assert.deepEqual(hashes(sourceFiles(output)), before);
});
