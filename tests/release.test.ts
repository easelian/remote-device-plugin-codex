import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, win32 } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { archiveContents, createArchive, sameFiles } from '../scripts/archive.js';
import { ROOT, canonicalJson, containedFile, digest, fingerprint, immutableWrite, isContainedRelativePath, object, parseJson, requiredFile, type Files } from '../scripts/common.js';
import { PLUGIN, REQUIRED_CHECKS, SKILL_FILES, buildPlugin, loadRecord, openai, pluginFiles, recordResult, renderIcons, savePrepared, validatePng, type RecordResult } from '../scripts/release.js';

function temporary(t: { after(fn: () => void): void }): string {
  const root = mkdtempSync(join(tmpdir(), 'rdh-release-')); t.after(() => rmSync(root, { recursive: true, force: true })); return root;
}
function fixture(root: string): void {
  cpSync(PLUGIN, join(root, 'plugins/remote-device-hub'), { recursive: true });
  cpSync(join(ROOT, 'integrations'), join(root, 'integrations'), { recursive: true });
}

test('immutable artifacts reject changed bytes and symlinks', t => {
  const root = temporary(t), file = join(root, 'artifact.zip');
  immutableWrite(file, Buffer.from('same')); immutableWrite(file, Buffer.from('same'));
  assert.throws(() => immutableWrite(file, Buffer.from('changed')), /Refusing/);
  symlinkSync(file, join(root, 'linked.zip')); symlinkSync(join(root, 'missing'), join(root, 'dangling.zip'));
  for (const name of ['linked.zip', 'dangling.zip']) assert.throws(() => immutableWrite(join(root, name), Buffer.from('same')), /Refusing/);
});
test('component references reject traversal, private paths and symlinks', t => {
  const root = temporary(t);
  for (const path of ['./../secret', './state/private.json', '/secret', './.env', './', './assets/../secret', './a\\b']) assert.throws(() => containedFile(root, path));
  writeFileSync(join(root, 'private'), 'secret'); symlinkSync(join(root, 'private'), join(root, 'linked'));
  assert.throws(() => containedFile(root, './linked'), /symlinks/);
});
test('profiles preserve separate transport and App contracts and shared skill bytes', () => {
  const [standalone, files] = pluginFiles();
  assert.equal(standalone.version, '1.2.2'); assert.ok(!files.has('.app.json')); assert.ok(!('apps' in openai(standalone)));
  assert.equal(object(object(parseJson(requiredFile(files, 'mcp.json')).mcpServers)['remote-device-hub']).type, 'streamable-http');
  const [connected, connectedFiles] = pluginFiles(PLUGIN, 'connected');
  assert.equal(openai(connected).apps, './.app.json'); assert.equal(openai(connected).requires_local_executor, false);
  assert.ok(connectedFiles.has('.app.json')); assert.ok(!connectedFiles.has('mcp.json')); assert.ok(!connectedFiles.has('.mcp.json'));
  assert.equal(parseJson(requiredFile(connectedFiles, '.codex-plugin/plugin.json')).requires_local_executor, false);
  for (const name of SKILL_FILES) {
    assert.deepEqual(requiredFile(files, name), requiredFile(connectedFiles, name));
    assert.deepEqual(requiredFile(files, name), readFileSync(join(ROOT, 'public/remote-device-hub', name)));
  }
});
test('allowlist excludes unrelated private files', t => {
  const root = temporary(t); fixture(root);
  const source = join(root, 'plugins/remote-device-hub'), expected = pluginFiles(source)[1];
  writeFileSync(join(source, 'owner-password.local.txt'), 'secret');
  symlinkSync(join(source, 'owner-password.local.txt'), join(source, 'unused-link'));
  assert.ok(sameFiles(pluginFiles(source)[1], expected));
});
test('both profiles produce deterministic archives and retain immutable release records', t => {
  const root = temporary(t); fixture(root);
  for (const profile of ['standalone', 'connected'] as const) {
    const record = buildPlugin(profile, `fixture-${profile}`, root), [, metadata] = loadRecord(relative(root, record), root);
    const artifact = join(root, String(object(metadata.artifact).path)), bytes = readFileSync(artifact), saved = readFileSync(record);
    assert.ok(sameFiles(archiveContents(bytes), pluginFiles(join(root, 'plugins/remote-device-hub'), profile, root)[1]));
    assert.equal(buildPlugin(profile, `fixture-${profile}`, root), record);
    assert.deepEqual(readFileSync(artifact), bytes); assert.deepEqual(readFileSync(record), saved);
  }
});
test('same-version renderer changes and artifact corruption are refused', t => {
  const root = temporary(t); fixture(root);
  const record = buildPlugin('standalone', 'fixture', root), [, metadata] = loadRecord(relative(root, record), root);
  const path = join(root, 'plugins/remote-device-hub/plugin.json'), original = readFileSync(path), manifest = parseJson(original);
  manifest.description = 'changed'; writeFileSync(path, canonicalJson(manifest));
  assert.throws(() => buildPlugin('standalone', 'fixture', root), /renderer changed/);
  writeFileSync(path, original);
  writeFileSync(join(root, String(object(metadata.artifact).path)), 'corrupt');
  assert.throws(() => buildPlugin('standalone', 'fixture', root), /checksum/);
});
test('ZIP readback rejects duplicate names, traversal and corrupt CRC', () => {
  const files: Files = new Map([['a', Buffer.from('one')], ['b', Buffer.from('two')]]);
  const archive = createArchive(files);
  assert.ok(sameFiles(archiveContents(archive), files));
  const duplicate = Buffer.from(archive);
  // Same-length replacement in both the local header and central directory.
  for (let offset = duplicate.indexOf('remote-device-hub/b'); offset !== -1; offset = duplicate.indexOf('remote-device-hub/b')) duplicate.write('remote-device-hub/a', offset);
  assert.throws(() => archiveContents(duplicate), /Duplicate/);
  assert.throws(() => archiveContents(createArchive(new Map([['../outside', Buffer.from('x')]]))), /Unexpected/);
  const corrupt = Buffer.from(archive), central = corrupt.indexOf(Buffer.from('504b0102', 'hex'));
  corrupt.writeUInt32LE(0, 14); corrupt.writeUInt32LE(0, central + 16);
  assert.throws(() => archiveContents(corrupt), /checksum/);
  assert.throws(() => archiveContents(Buffer.alloc(3)), /Invalid ZIP/);
});
test('CLI builds and checks a record in an isolated checkout', t => {
  const root = temporary(t); fixture(root);
  cpSync(join(ROOT, '.build/tooling/scripts'), join(root, '.build/tooling/scripts'), { recursive: true });
  cpSync(join(ROOT, 'package.json'), join(root, 'package.json'));
  const cli = join(root, '.build/tooling/scripts/release.js');
  const built = spawnSync(process.execPath, [cli, 'build', 'plugin', '--profile', 'standalone', '--channel', 'cli-test'], { cwd: root, encoding: 'utf8' });
  assert.equal(built.status, 0, built.stderr);
  const checked = spawnSync(process.execPath, [cli, 'check', 'releases/plugin-cli-test-1.2.2.json'], { cwd: root, encoding: 'utf8' });
  assert.equal(checked.status, 0, checked.stderr); assert.match(checked.stdout, /Checksum OK/);
});
for (const size of [9999, 10000, 10001]) test(`release icon boundary ${size}`, () => {
  const icon = [...renderIcons().values()][0]; assert.ok(icon);
  const data = Buffer.concat([icon, Buffer.alloc(size - icon.length)]);
  if (size < 10000) validatePng('composerIcon', data); else assert.throws(() => validatePng('composerIcon', data), /below 10000 bytes/);
});
test('release state requires evidence and all checks, rejects backwards transitions and escaping evidence', t => {
  const root = temporary(t), artifact = join(root, 'dist/a.zip'); mkdirSync(dirname(artifact)); writeFileSync(artifact, 'artifact');
  const record = savePrepared('1.2.2', artifact, new Map([['plugin.json', Buffer.from('source')]]), 'fixture', 'standalone', root);
  writeFileSync(join(root, 'proof.txt'), 'proof');
  const args: RecordResult = { record: relative(root, record), stage: 'published', host: 'local', evidence: ['proof.txt'], check: [], note: '' };
  assert.throws(() => recordResult({ ...args, evidence: [] }, root), /attach evidence/);
  recordResult(args, root);
  assert.throws(() => recordResult({ ...args, stage: 'prepared' }, root), /backwards/);
  args.stage = 'verified'; assert.throws(() => recordResult(args, root), /Required checks/);
  args.check = REQUIRED_CHECKS.map(key => `${key}=passed`);
  const outside = join(temporary(t), 'outside-proof.txt'); writeFileSync(outside, 'outside');
  assert.throws(() => recordResult({ ...args, evidence: [outside] }, root), /Evidence/);
  assert.throws(() => recordResult({ ...args, evidence: [relative(root, outside)] }, root), /Evidence/);
  symlinkSync(join(root, 'proof.txt'), join(root, 'linked'));
  assert.throws(() => recordResult({ ...args, evidence: ['linked'] }, root), /Evidence/);
  recordResult(args, root);
  const saved = parseJson(readFileSync(record)); assert.equal(saved.stage, 'verified');
  assert.ok(Array.isArray(saved.events)); const event = object(saved.events.at(-1)); assert.ok(Array.isArray(event.evidence));
  assert.equal(object(event.evidence[0]).sha256, digest(Buffer.from('proof')));
  symlinkSync(record, join(root, 'releases/linked.json'));
  assert.throws(() => loadRecord('releases/linked.json', root), /directly under releases/);
});
test('evidence containment rejects Windows parent paths and other drives', () => {
  const root = 'C:\\project';
  for (const outside of ['C:\\outside\\proof.txt', 'C:\\project-extra\\proof.txt', 'D:\\proof.txt']) {
    assert.equal(isContainedRelativePath(win32.relative(root, outside)), false);
  }
  assert.equal(isContainedRelativePath(win32.relative(root, 'C:\\project\\evidence\\proof.txt')), true);
  assert.equal(isContainedRelativePath('../outside'), false);
  assert.equal(isContainedRelativePath('evidence/proof.txt'), true);
});
test('canonical JSON preserves UTF-8, indentation, order and trailing newline', () => {
  assert.equal(canonicalJson({ title: '设备 😀', items: ['x', true, null], empty: {} }).toString(), '{\n  "title": "设备 😀",\n  "items": [\n    "x",\n    true,\n    null\n  ],\n  "empty": {}\n}\n');
  assert.equal(fingerprint(new Map([['b', Buffer.from('2')], ['a', Buffer.from('1')]])), fingerprint(new Map([['a', Buffer.from('1')], ['b', Buffer.from('2')]])));
});
test('Python golden fixture preserves canonical bytes, profile hashes and ZIP format', () => {
  const golden = parseJson(readFileSync(join(ROOT, 'tests/fixtures/python-compatibility.json')));
  const profiles = object(golden.profiles);
  for (const profile of ['standalone', 'connected'] as const) {
    const expected = object(profiles[profile]), [manifest, files] = pluginFiles(PLUGIN, profile);
    assert.deepEqual(manifest, expected.manifest); assert.equal(fingerprint(files), expected.fingerprint);
    assert.deepEqual(Object.fromEntries([...files].map(([name, data]) => [name, digest(data)])), expected.hashes);
  }
  const samples = golden.canonical_samples; assert.ok(Array.isArray(samples));
  for (const entry of samples) {
    const sample = object(entry); assert.ok(sample.input !== undefined); assert.equal(typeof sample.output_base64, 'string');
    assert.deepEqual(canonicalJson(sample.input), Buffer.from(String(sample.output_base64), 'base64'));
  }
  const zip = Buffer.from(String(golden.zip_base64), 'base64');
  const contents = new Map(Object.entries(object(golden.zip_contents)).map(([name, data]) => [name, Buffer.from(String(data), 'base64')]));
  assert.ok(sameFiles(archiveContents(zip), contents));
  assert.deepEqual(createArchive(contents), zip);
});
