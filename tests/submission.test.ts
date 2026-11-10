import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { test } from 'node:test';
import { archiveContents } from '../scripts/archive.js';
import { canonicalJson, object, parseJson, requiredFile } from '../scripts/common.js';
import { openai } from '../scripts/models.js';
import {
  SOURCE,
  SUBMISSION_MCP,
  submissionFiles,
  build,
  localPath,
  sourceFiles,
  validate,
} from '../scripts/prepare_submission.js';

function publicFiles() {
  return submissionFiles(sourceFiles(SOURCE), parseJson(readFileSync(SUBMISSION_MCP)));
}

function temporary(t: { after(fn: () => void): void }): string {
  const root = mkdtempSync(join(tmpdir(), 'rdh-submission-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
for (const size of [9999, 10000, 10001]) {
  test(`public icon boundary ${size}`, () => {
    const files = publicFiles();
    const manifest = parseJson(requiredFile(files, 'plugin.json'));
    const name = localPath(object(openai(manifest).interface).logo);
    const icon = requiredFile(files, name);
    files.set(name, Buffer.concat([icon, Buffer.alloc(size - icon.length)]));
    if (size < 10000) {
      validate(files);
    } else {
      assert.throws(() => validate(files), /below 10000 bytes/);
    }
  });
}
for (const [field, value] of [
  ['apps', './.app.json'],
  ['hooks', {}],
  ['clientSecret', 'do-not-package'],
] as const) {
  test(`rejects public ${field}`, () => {
    const files = publicFiles();
    const manifest = parseJson(requiredFile(files, 'plugin.json'));
    openai(manifest)[field] = value;
    files.set('plugin.json', canonicalJson(manifest));
    assert.throws(() => validate(files), /must not contain|Private submission/);
  });
}
for (const field of ['apps', 'hooks']) {
  for (const name of ['plugin.json', 'mcp.json']) {
    test(`rejects public ${field} in ${name} regardless of its value`, () => {
      for (const value of [null, false, 0, '', [], {}]) {
        const files = publicFiles();
        const document = parseJson(requiredFile(files, name));
        const target =
          name === 'plugin.json'
            ? openai(document)
            : object(object(document.mcpServers)['remote-device-hub']);
        target[field] = value;
        files.set(name, canonicalJson(document));
        assert.throws(
          () => validate(files),
          new RegExp(`Public uploads must not contain ${field}`),
        );
      }
    });
  }
}
test('public MCP preserves OAuth DCR and rejects missing authentication', () => {
  const files = publicFiles();
  validate(files);
  const mcp = parseJson(requiredFile(files, 'mcp.json'));
  delete object(object(mcp.mcpServers)['remote-device-hub']).extensions;
  files.set('mcp.json', canonicalJson(mcp));
  assert.throws(() => validate(files));
});
test('public MCP prevents website OIDC defaults from entering device authorization', () => {
  for (const change of [{ oidcEnabled: true }, { defaultScopes: ['openid', 'email'] }]) {
    const files = publicFiles();
    const mcp = parseJson(requiredFile(files, 'mcp.json'));
    const server = object(object(mcp.mcpServers)['remote-device-hub']);
    const auth = object(object(object(server.extensions)['com.openai']).auth);
    Object.assign(auth, change);
    files.set('mcp.json', canonicalJson(mcp));
    assert.throws(() => validate(files), /OIDC disabled/);
  }
});
test('public MCP headers and unreferenced files are rejected', () => {
  const files = publicFiles();
  const mcp = parseJson(requiredFile(files, 'mcp.json'));
  object(object(mcp.mcpServers)['remote-device-hub']).headers = { Authorization: 'Bearer fixture' };
  files.set('mcp.json', canonicalJson(mcp));
  assert.throws(() => validate(files), /headers/);
  const clean = publicFiles();
  clean.set('owner-password.local.txt', Buffer.from('not a secret'));
  assert.throws(() => validate(clean), /Unexpected plugin files/);
  assert.throws(() => localPath('./../private.png'), /escapes/);
});
test('incomplete drafts stay explicit and deterministic, never contain App bindings', (t) => {
  const root = temporary(t);
  const source = join(root, 'remote-device-hub');
  cpSync(SOURCE, source, { recursive: true });
  const path = join(source, 'plugin.json');
  const manifest = parseJson(readFileSync(path));
  delete object(openai(manifest).review).demo_recording_url;
  writeFileSync(path, canonicalJson(manifest));
  assert.throws(() => build(source, join(root, 'dist')), /Incomplete/);
  const [archive, report] = build(source, join(root, 'dist'), true);
  assert.match(basename(archive), /-draft.zip$/);
  assert.equal(report.submission_ready, false);
  assert.ok(report.missing_materials.includes('verified_demo_recording_url'));
  const original = readFileSync(archive);
  build(source, join(root, 'dist'), true);
  assert.deepEqual(readFileSync(archive), original);
  const actual = archiveContents(original);
  assert.ok(actual.has('skills/remote-device-operations/SKILL.md'));
  assert.ok(!actual.has('.app.json'));
});
test('public source rejects dangling symlinks', (t) => {
  const root = temporary(t);
  const source = join(root, 'remote-device-hub');
  cpSync(SOURCE, source, { recursive: true });
  symlinkSync(join(root, 'private'), join(source, 'leak.md'));
  assert.throws(() => sourceFiles(source), /symlink/);
});
test('positive review cases require observable expected behavior', () => {
  const files = publicFiles();
  const manifest = parseJson(requiredFile(files, 'plugin.json'));
  const positive = object(object(openai(manifest).review).test_cases).positive;
  assert.ok(Array.isArray(positive));
  delete object(positive[0]).expected_behavior;
  files.set('plugin.json', canonicalJson(manifest));
  assert.throws(() => validate(files), /Incomplete positive/);
});
test('malformed external JSON fails closed', () => {
  for (const content of ['null', '[]', '{"name":3}', '{"extensions":null}']) {
    const files = publicFiles();
    files.set('plugin.json', Buffer.from(content));
    assert.throws(() => validate(files));
  }
});

for (const id of [
  'asdk_app_private_fixture',
  'connector_private_fixture',
  'templated_apps_private_fixture',
]) {
  for (const identity of [id, `plugin_${id}`]) {
    for (const name of ['plugin.json', 'skills/remote-device-operations/SKILL.md']) {
      test(`public archive rejects ${identity} in ${name}`, () => {
        const files = publicFiles();
        if (name === 'plugin.json') {
          const manifest = parseJson(requiredFile(files, name));
          manifest.description = `Use ${identity}.`;
          files.set(name, canonicalJson(manifest));
        } else {
          files.set(
            name,
            Buffer.concat([requiredFile(files, name), Buffer.from(`\nUse ${identity}.\n`)]),
          );
        }
        assert.throws(() => validate(files), /Account-specific registered App ID/);
      });
    }
  }
}
test('public category and prompt metadata follow submission constraints', () => {
  for (const change of [
    { category: 'developer-tools' },
    { defaultPrompt: ['same prompt', 'same   prompt'] },
    { defaultPrompt: ['first\nsecond'] },
    { defaultPrompt: ['x'.repeat(129)] },
  ]) {
    const files = publicFiles();
    const manifest = parseJson(requiredFile(files, 'plugin.json'));
    Object.assign(object(openai(manifest).interface), change);
    files.set('plugin.json', canonicalJson(manifest));
    assert.throws(() => validate(files), /category|defaultPrompt/);
  }
});
test('default package command cannot silently build the personal-account adapter', () => {
  const pkg = parseJson(readFileSync(join(SOURCE, '../../package.json')));
  const command = object(pkg.scripts).package;
  assert.equal(command, 'npm run build && npm run submission');
});

test('candidate archives are immutable and drafts cannot replace them', (t) => {
  const root = temporary(t);
  const source = join(root, 'remote-device-hub');
  cpSync(SOURCE, source, { recursive: true });
  const path = join(source, 'plugin.json');
  const manifest = parseJson(readFileSync(path));
  object(openai(manifest).review).demo_recording_url = 'https://example.com/test-fixture.mp4';
  writeFileSync(path, canonicalJson(manifest));
  const [candidate] = build(source, join(root, 'dist'));
  const bytes = readFileSync(candidate);
  manifest.description = 'Changed fixture';
  writeFileSync(path, canonicalJson(manifest));
  assert.throws(() => build(source, join(root, 'dist')), /Refusing/);
  const [draft] = build(source, join(root, 'dist'), true);
  assert.notEqual(draft, candidate);
  assert.match(draft, /-draft.zip$/);
  assert.deepEqual(readFileSync(candidate), bytes);
});

test('publication identifies Easelian and uses the public company website', () => {
  const [manifest] = validate(publicFiles());
  const ui = openai(manifest).interface;
  assert.equal(object(manifest.author).name, 'Easelian');
  assert.equal(object(manifest.author).url, 'https://easelian.com/');
  assert.equal(ui.developerName, 'Easelian');
  assert.equal(ui.websiteURL, 'https://easelian.com/');
  assert.equal(ui.supportURL, 'https://easelian.com/contact');
  assert.equal(ui.privacyPolicyURL, 'https://easelian.com/privacy');
  assert.equal(ui.termsOfServiceURL, 'https://easelian.com/terms');
});

test('portal projection preserves content and removes only the registered App wiring', () => {
  const source = sourceFiles(SOURCE);
  const before = new Map(source);
  const output = publicFiles();
  assert.deepEqual(source, before);
  assert.ok(!output.has('.app.json'));
  assert.ok(output.has('mcp.json'));
  const expected = parseJson(requiredFile(source, 'plugin.json'));
  delete openai(expected).apps;
  assert.deepEqual(parseJson(requiredFile(output, 'plugin.json')), expected);
  for (const [name, bytes] of source) {
    if (name !== 'plugin.json' && name !== '.app.json') {
      assert.deepEqual(output.get(name), bytes);
    }
  }
});
