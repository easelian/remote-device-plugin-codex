import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { ROOT, canonicalJson, object, parseJson, type JsonObject } from '../scripts/common.js';
import {
  readCompatibilityManifest,
  readPluginManifest,
  readReleaseRecord,
} from '../scripts/models.js';

test('typed manifests retain unknown fields and the original canonical bytes', () => {
  const source = join(ROOT, 'plugins/remote-device-hub');
  const manifest = parseJson(readFileSync(join(source, 'plugin.json')));
  manifest.future_metadata = { label: '设备', enabled: true };
  const bytes = canonicalJson(manifest);
  assert.deepEqual(canonicalJson(readPluginManifest(bytes)), bytes);

  const overlay = readFileSync(join(source, '.codex-plugin/plugin.json'));
  assert.deepEqual(readCompatibilityManifest(overlay), parseJson(overlay));
});

test('typed record parsing accepts existing Python records without rewriting fields', () => {
  const directory = join(ROOT, 'releases');
  const names = readdirSync(directory).filter((name) => /^plugin-.*\.json$/.test(name));
  assert.ok(names.length > 0);
  for (const name of names) {
    const bytes = readFileSync(join(directory, name));
    const record = readReleaseRecord(bytes);
    assert.deepEqual(record, parseJson(bytes));
    assert.equal(typeof record.build.python, 'string');
    assert.equal(typeof record.artifact.bytes, 'number');
  }
});

test('malformed release states, nested metadata and event evidence fail at the boundary', () => {
  const bytes = readFileSync(join(ROOT, 'releases/plugin-connected-1.2.2.json'));
  const mutations: ((record: JsonObject) => void)[] = [
    (record) => {
      record.stage = 'finished';
    },
    (record) => {
      object(record.build).profile = 'public';
    },
    (record) => {
      object(record.artifact).bytes = -1;
    },
    (record) => {
      object(record.source).files = { 'plugin.json': 7 };
    },
    (record) => {
      record.checks = { 'archive-readback': 'success' };
    },
    (record) => {
      record.events = [{ stage: 'prepared', at: 'now', evidence: [{ path: 'proof' }] }];
    },
  ];
  for (const mutate of mutations) {
    const record = parseJson(bytes);
    mutate(record);
    assert.throws(() => readReleaseRecord(canonicalJson(record)), /Invalid release record/);
  }
});
