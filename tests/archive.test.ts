import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { archiveContents, createArchive, sameFiles } from '../scripts/archive.js';
import {
  ROOT,
  canonicalJson,
  immutableWrite,
  object,
  parseJson,
  type Files,
} from '../scripts/common.js';
import { readPluginManifest } from '../scripts/models.js';

test('immutable artifacts reject changed bytes and symlinks', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'rdh-archive-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const file = join(root, 'artifact.zip');
  immutableWrite(file, Buffer.from('same'));
  immutableWrite(file, Buffer.from('same'));
  assert.throws(() => immutableWrite(file, Buffer.from('changed')), /Refusing/);
  symlinkSync(file, join(root, 'linked.zip'));
  symlinkSync(join(root, 'missing'), join(root, 'dangling.zip'));
  for (const name of ['linked.zip', 'dangling.zip']) {
    assert.throws(() => immutableWrite(join(root, name), Buffer.from('same')), /Refusing/);
  }
});

test('ZIP readback rejects duplicate names, traversal and corrupt CRC', () => {
  const files: Files = new Map([
    ['a', Buffer.from('one')],
    ['b', Buffer.from('two')],
  ]);
  const archive = createArchive(files);
  assert.ok(sameFiles(archiveContents(archive), files));
  const duplicate = Buffer.from(archive);
  for (
    let offset = duplicate.indexOf('remote-device-hub/b');
    offset !== -1;
    offset = duplicate.indexOf('remote-device-hub/b')
  ) {
    duplicate.write('remote-device-hub/a', offset);
  }
  assert.throws(() => archiveContents(duplicate), /Duplicate/);
  assert.throws(
    () => archiveContents(createArchive(new Map([['../outside', Buffer.from('x')]]))),
    /Unexpected/,
  );
  const corrupt = Buffer.from(archive);
  const central = corrupt.indexOf(Buffer.from('504b0102', 'hex'));
  corrupt.writeUInt32LE(0, 14);
  corrupt.writeUInt32LE(0, central + 16);
  assert.throws(() => archiveContents(corrupt), /checksum/);
  assert.throws(() => archiveContents(Buffer.alloc(3)), /Invalid ZIP/);
});

test('fixed archive fixture verifies canonical JSON and ZIP interoperability', () => {
  const golden = parseJson(readFileSync(join(ROOT, 'tests/fixtures/archive.json')));
  assert.ok(Array.isArray(golden.canonical_samples));
  for (const entry of golden.canonical_samples) {
    const sample = object(entry);
    assert.ok(sample.input !== undefined);
    assert.deepEqual(
      canonicalJson(sample.input),
      Buffer.from(String(sample.output_base64), 'base64'),
    );
  }
  const zip = Buffer.from(String(golden.zip_base64), 'base64');
  const contents = new Map(
    Object.entries(object(golden.zip_contents)).map(([name, data]) => [
      name,
      Buffer.from(String(data), 'base64'),
    ]),
  );
  assert.ok(sameFiles(archiveContents(zip), contents));
  assert.deepEqual(createArchive(contents), zip);
});

test('manifest parsing preserves future metadata and rejects an unrecognized format', () => {
  const manifest = parseJson(readFileSync(join(ROOT, 'plugins/remote-device-hub/plugin.json')));
  manifest.future_metadata = { label: '设备', enabled: true };
  const bytes = canonicalJson(manifest);
  assert.deepEqual(canonicalJson(readPluginManifest(bytes)), bytes);
  manifest.$schema = 'unknown';
  assert.throws(() => readPluginManifest(canonicalJson(manifest)), /Invalid plugin manifest/);
});
