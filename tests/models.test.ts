import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { ROOT, canonicalJson, object, parseJson, type JsonObject } from '../scripts/common.js';
import {
  readCompatibilityManifest,
  readPluginManifest,
  readReleaseRecord,
} from '../scripts/models.js';

function recordFixture(runtime: 'python' | 'node' = 'node'): JsonObject {
  return {
    schema_version: 2,
    component: 'plugin',
    channel: 'fixture',
    version: '1.0.0',
    created_at: '2026-01-01T00:00:00Z',
    stage: 'prepared',
    source: {
      git_commit: null,
      git_tree: null,
      working_tree: '',
      sha256: 'a'.repeat(64),
      files: { 'plugin.json': 'b'.repeat(64) },
    },
    build: {
      [runtime]: runtime === 'python' ? '3.12.0' : '22.0.0',
      builder: `fixture.${runtime === 'python' ? 'py' : 'js'}`,
      builder_sha256: 'c'.repeat(64),
      profile: 'standalone',
    },
    artifact: { path: 'dist/fixture.zip', sha256: 'd'.repeat(64), bytes: 42 },
    identities: {},
    checks: {},
    events: [{ stage: 'prepared', at: '2026-01-01T00:00:00Z' }],
    future_metadata: { label: '设备', enabled: true },
  };
}

test('typed manifests retain unknown fields and the original canonical bytes', () => {
  const source = join(ROOT, 'plugins/remote-device-hub');
  const manifest = parseJson(readFileSync(join(source, 'plugin.json')));
  manifest.future_metadata = { label: '设备', enabled: true };
  const bytes = canonicalJson(manifest);
  assert.deepEqual(canonicalJson(readPluginManifest(bytes)), bytes);

  const overlay = readFileSync(join(source, '.codex-plugin/plugin.json'));
  assert.deepEqual(readCompatibilityManifest(overlay), parseJson(overlay));
});

test('typed record parsing accepts Python and Node records without rewriting fields', () => {
  for (const runtime of ['python', 'node'] as const) {
    const bytes = canonicalJson(recordFixture(runtime));
    const record = readReleaseRecord(bytes);
    assert.deepEqual(record, parseJson(bytes));
    assert.ok(typeof record.build.python === 'string' || typeof record.build.node === 'string');
    assert.equal(typeof record.artifact.bytes, 'number');
  }
});

test('malformed release states, nested metadata and event evidence fail at the boundary', () => {
  const bytes = canonicalJson(recordFixture());
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
