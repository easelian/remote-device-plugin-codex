import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { test } from 'node:test';
import { archiveContents } from '../scripts/archive.js';
import { canonicalJson, object, parseJson, requiredFile } from '../scripts/common.js';
import { openai } from '../scripts/release.js';
import { SOURCE, build, localPath, sourceFiles, validate } from '../scripts/prepare_submission.js';

function temporary(t: { after(fn: () => void): void }): string {
  const root = mkdtempSync(join(tmpdir(), 'rdh-submission-')); t.after(() => rmSync(root, { recursive: true, force: true })); return root;
}
for (const size of [9999, 10000, 10001]) test(`public icon boundary ${size}`, () => {
  const files = sourceFiles(SOURCE), manifest = parseJson(requiredFile(files, 'plugin.json'));
  const name = localPath(object(openai(manifest).interface).logo), icon = requiredFile(files, name);
  files.set(name, Buffer.concat([icon, Buffer.alloc(size - icon.length)]));
  if (size < 10000) validate(files); else assert.throws(() => validate(files), /below 10000 bytes/);
});
for (const [field, value] of [['apps', './.app.json'], ['hooks', {}], ['clientSecret', 'do-not-package']] as const) test(`rejects public ${field}`, () => {
  const files = sourceFiles(SOURCE), manifest = parseJson(requiredFile(files, 'plugin.json'));
  openai(manifest)[field] = value; files.set('plugin.json', canonicalJson(manifest));
  assert.throws(() => validate(files), /must not contain|Private submission/);
});
test('public MCP headers and unreferenced files are rejected', () => {
  const files = sourceFiles(SOURCE), mcp = parseJson(requiredFile(files, 'mcp.json'));
  object(object(mcp.mcpServers)['remote-device-hub']).headers = { Authorization: 'Bearer fixture' };
  files.set('mcp.json', canonicalJson(mcp)); assert.throws(() => validate(files), /headers/);
  const clean = sourceFiles(SOURCE); clean.set('owner-password.local.txt', Buffer.from('not a secret'));
  assert.throws(() => validate(clean), /Unexpected public files/);
  assert.throws(() => localPath('./../private.png'), /escapes/);
});
test('incomplete drafts stay explicit and deterministic, never contain App bindings', t => {
  const root = temporary(t), source = join(root, 'remote-device-hub'); cpSync(SOURCE, source, { recursive: true });
  const path = join(source, 'plugin.json'), manifest = parseJson(readFileSync(path)); delete object(openai(manifest).review).demo_recording_url;
  writeFileSync(path, canonicalJson(manifest));
  assert.throws(() => build(source, join(root, 'dist')), /Incomplete/);
  const [archive, report] = build(source, join(root, 'dist'), true);
  assert.match(basename(archive), /-draft.zip$/); assert.equal(report.submission_ready, false);
  assert.ok(report.missing_materials.includes('verified_demo_recording_url'));
  const original = readFileSync(archive); build(source, join(root, 'dist'), true); assert.deepEqual(readFileSync(archive), original);
  const actual = archiveContents(original); assert.ok(actual.has('skills/remote-device-operations/SKILL.md')); assert.ok(!actual.has('.app.json'));
});
test('public source rejects dangling symlinks', t => {
  const root = temporary(t), source = join(root, 'remote-device-hub'); cpSync(SOURCE, source, { recursive: true });
  symlinkSync(join(root, 'private'), join(source, 'leak.md')); assert.throws(() => sourceFiles(source), /symlink/);
});
test('positive review cases require observable expected behavior', () => {
  const files = sourceFiles(SOURCE), manifest = parseJson(requiredFile(files, 'plugin.json'));
  const positive = object(object(openai(manifest).review).test_cases).positive; assert.ok(Array.isArray(positive));
  delete object(positive[0]).expected_behavior; files.set('plugin.json', canonicalJson(manifest));
  assert.throws(() => validate(files), /Incomplete positive/);
});
test('malformed external JSON fails closed', () => {
  for (const content of ['null', '[]', '{"name":3}', '{"extensions":null}']) {
    const files = sourceFiles(SOURCE); files.set('plugin.json', Buffer.from(content)); assert.throws(() => validate(files));
  }
});
