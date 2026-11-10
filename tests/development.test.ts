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
import { SOURCE, sourceFiles } from '../scripts/plugin_source.js';
import { validatePlugin } from '../scripts/app_contract.js';

function fixture(t: { after(fn: () => void): void }): string {
  const root = mkdtempSync(join(tmpdir(), 'rdh-development-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(SOURCE, join(root, 'plugins/remote-device-hub'), { recursive: true });
  return root;
}

test('local package uses the official compatibility layout without direct MCP', () => {
  const source = sourceFiles(SOURCE);
  const before = hashes(source);
  const local = developmentFiles(source);
  assert.deepEqual(hashes(source), before);
  assert.ok(!local.has('plugin.json'));
  assert.ok(local.has('.codex-plugin/plugin.json'));
  for (const [name, bytes] of source) {
    if (name !== 'plugin.json') {
      assert.deepEqual(local.get(name), bytes);
    }
  }
  assert.ok(local.has('.app.json'));
  assert.ok(!local.has('mcp.json'));
  assert.ok(!local.has('.mcp.json'));
  const compatibility = parseJson(requiredFile(local, '.codex-plugin/plugin.json'));
  assert.equal(compatibility.apps, './.app.json');
  assert.equal(compatibility.skills, './skills');
  const manifest = parseJson(requiredFile(source, 'plugin.json'));
  assert.deepEqual(compatibility.interface, openai(manifest).interface);
  delete object(openai(manifest).review).demo_recording_url;
  const incomplete = new Map(source);
  incomplete.set('plugin.json', canonicalJson(manifest));
  assert.ok(validatePlugin(incomplete)[1].includes('verified_demo_recording_url'));
  developmentFiles(incomplete);
});

test('missing, optional or credential-bearing App dependencies fail closed', () => {
  const source = sourceFiles(SOURCE);
  for (const bad of [
    { apps: {} },
    { apps: { 'remote-device-hub': { id: 'invalid', required: true } } },
    { apps: { 'remote-device-hub': { id: 'asdk_app_fixture', required: false } } },
    { apps: { 'remote-device-hub': { id: 'asdk_app_fixture', required: true, token: 'secret' } } },
    { apps: { 'remote-device-hub': { id: 'asdk_app_fixture', required: true } }, token: 'secret' },
  ]) {
    const invalid = new Map(source);
    invalid.set('.app.json', canonicalJson(bad));
    assert.throws(() => developmentFiles(invalid), /App binding|registered id/);
  }
  const missing = new Map(source);
  missing.delete('.app.json');
  assert.throws(() => developmentFiles(missing));
  const fallback = new Map(source);
  fallback.set('mcp.json', canonicalJson({ mcpServers: {} }));
  assert.throws(() => developmentFiles(fallback), /Unexpected plugin files/);
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
  const path = join(root, 'plugins/remote-device-hub/.app.json');
  const binding = parseJson(readFileSync(path));
  object(object(binding.apps)['remote-device-hub']).token = 'fixture';
  writeFileSync(path, canonicalJson(binding));
  assert.throws(() => prepare(root), /credentials/);
  assert.deepEqual(hashes(sourceFiles(output)), before);
});
