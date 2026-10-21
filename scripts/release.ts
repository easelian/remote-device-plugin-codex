import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { archiveContents, createArchive, sameFiles } from './archive.js';
import {
  ROOT,
  canonicalJson,
  containedFile,
  digest,
  fingerprint,
  fullMatch,
  hashes,
  httpsUrl,
  immutableWrite,
  isContainedRelativePath,
  isMain,
  isSymlink,
  object,
  parseJson,
  requiredFile,
  text,
  utf8,
  validatePng,
  type Files,
  type JsonObject,
} from './common.js';

export {
  canonicalJson,
  containedFile,
  digest,
  fingerprint,
  immutableWrite,
  validatePng,
  ROOT,
} from './common.js';
export { archiveContents } from './archive.js';
import {
  isCheckResult,
  isStage,
  readCompatibilityManifest,
  readPluginManifest,
  readReleaseRecord,
} from './models.js';
import type {
  CompatibilityManifest,
  OpenAIExtension,
  PluginManifest,
  Profile,
  ReleaseRecord,
  SourceState,
  Stage,
} from './models.js';
export type { Profile, Stage } from './models.js';
export const REQUIRED_CHECKS = [
  'archive-readback',
  'detail-icon',
  'composer-icon',
  'reload-persistence',
  'account-reuse',
] as const;
export const SKILL_FILES = [
  'skills/remote-device-operations/SKILL.md',
  'skills/remote-device-operations/references/files.md',
  'skills/remote-device-operations/references/processes.md',
  'skills/remote-device-operations/references/recovery.md',
] as const;
export const PLUGIN = join(ROOT, 'plugins/remote-device-hub');
export function openai(manifest: PluginManifest): OpenAIExtension;
export function openai(manifest: JsonObject): JsonObject;
export function openai(manifest: JsonObject): JsonObject {
  return object(object(manifest.extensions)['com.openai']);
}
export function validateMcp(data: JsonObject): void {
  const servers = object(data.mcpServers);
  if (Object.keys(servers).length === 0) {
    throw new Error('Standalone plugin requires named MCP servers');
  }
  for (const value of Object.values(servers)) {
    const server = object(value);
    const url = httpsUrl(server.url);
    if (server.type !== 'streamable-http' || url.search || url.hash) {
      throw new Error('Use credential-free HTTPS Streamable HTTP MCP URLs');
    }
  }
}
function manifestAt(source: string): [PluginManifest, CompatibilityManifest | null] {
  if (isSymlink(source)) {
    throw new Error('Plugin source may not be a symlink');
  }
  const manifest = readPluginManifest(readFileSync(join(source, 'plugin.json')));
  const { name, version } = manifest;
  if (basename(source) !== name || !fullMatch(/[a-z][a-z0-9-]{0,63}/, name)) {
    throw new Error('Plugin directory and manifest name must match');
  }
  if (!fullMatch(/\d+\.\d+\.\d+/, version)) {
    throw new Error('Use a numeric semantic version');
  }
  const ext = openai(manifest);
  const ui = ext.interface;
  if ([...text(ui.shortDescription)].length > 30) {
    throw new Error('Plugin shortDescription exceeds 30 characters');
  }
  if ('apps' in ext || existsSync(join(source, '.app.json'))) {
    throw new Error('Canonical plugin source must not depend on a registered App identity');
  }
  const overlayPath = join(source, '.codex-plugin/plugin.json');
  const overlay = existsSync(overlayPath)
    ? readCompatibilityManifest(readFileSync(overlayPath))
    : null;
  if (
    overlay &&
    (overlay.name !== name || overlay.version !== version || !jsonEqual(overlay.interface, ui))
  ) {
    throw new Error('Root and compatibility manifests differ');
  }
  if (overlay && 'apps' in overlay) {
    throw new Error('Canonical compatibility manifest must not bind an App identity');
  }
  if (['hooks', 'skills', 'onboardingSkill'].some((key) => key in ext)) {
    throw new Error('Only the explicit plugin allowlist is supported');
  }
  return [manifest, overlay];
}
function jsonEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((item: unknown, index) => jsonEqual(item, right[index]))
    );
  }
  if (
    left &&
    right &&
    typeof left === 'object' &&
    typeof right === 'object' &&
    !Array.isArray(left) &&
    !Array.isArray(right)
  ) {
    const a = object(left);
    const b = object(right);
    return (
      Object.keys(a).length === Object.keys(b).length &&
      Object.entries(a).every(([key, value]) => Object.hasOwn(b, key) && jsonEqual(value, b[key]))
    );
  }
  return false;
}
export function pluginFiles(
  source = PLUGIN,
  profile: Profile = 'standalone',
  root = ROOT,
): [PluginManifest, Files] {
  const [manifest, overlay] = manifestAt(source);
  const ext = openai(manifest);
  const ui = ext.interface;
  const files: Files = new Map();
  if (existsSync(join(source, 'skills'))) {
    for (const name of SKILL_FILES) {
      const [path, data] = containedFile(source, `./${name}`);
      utf8(data);
      files.set(path, data);
    }
    if (
      !utf8(requiredFile(files, SKILL_FILES[0])).startsWith(
        '---\nname: remote-device-operations\ndescription: ',
      )
    ) {
      throw new Error('Invalid operations skill frontmatter');
    }
  }
  for (const key of ['composerIcon', 'composerIconDark', 'logo', 'logoDark']) {
    if (key in ui) {
      const [path, data] = containedFile(source, ui[key]);
      validatePng(key, data);
      files.set(path, data);
    }
  }
  if (profile === 'standalone') {
    const [path, data] = containedFile(source, './mcp.json');
    validateMcp(parseJson(data));
    files.set(path, data);
  } else if (profile === 'connected') {
    const [, data] = containedFile(root, './integrations/chatgpt/connected-app.json');
    const apps = object(parseJson(data).apps);
    if (
      !Object.keys(apps).length ||
      Object.values(apps).some(
        (item) => !fullMatch(/(?:asdk_app_|connector_|templated_apps_).+/, text(object(item).id)),
      )
    ) {
      throw new Error('Connected profile requires verified existing App IDs');
    }
    files.set('.app.json', data);
    ext.apps = './.app.json';
    ext.requires_local_executor = false;
    if (overlay) {
      overlay.apps = './.app.json';
      overlay.requires_local_executor = false;
    }
  } else {
    throw new Error('Unknown plugin profile');
  }
  files.set('plugin.json', canonicalJson(manifest));
  if (overlay) {
    files.set('.codex-plugin/plugin.json', canonicalJson(overlay));
  }
  return [manifest, files];
}
export function renderIcons(source = PLUGIN): Files {
  return new Map([...pluginFiles(source)[1]].filter(([name]) => name.startsWith('assets/')));
}
function gitValue(root: string, ...args: string[]): string | null {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}
export function sourceState(files: Files, root = ROOT): SourceState {
  const head = gitValue(root, 'rev-parse', 'HEAD');
  const status = head
    ? gitValue(root, 'status', '--porcelain', '--', ...[...files.keys()].sort())
    : null;
  return {
    git_commit: head,
    git_tree: gitValue(root, 'rev-parse', 'HEAD^{tree}'),
    working_tree: head === null ? 'unversioned' : status ? 'dirty' : 'clean',
    sha256: fingerprint(files),
    files: hashes(files),
  };
}
function now(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');
}
export function recordPath(version: string, channel: string, root = ROOT): string {
  if (!fullMatch(/[a-z][a-z0-9-]*/, channel)) {
    throw new Error('Channel must be a lowercase identifier');
  }
  if (!fullMatch(/\d+\.\d+\.\d+/, version)) {
    throw new Error('Use a numeric semantic version');
  }
  return join(root, 'releases', `plugin-${channel}-${version}.json`);
}
export function savePrepared(
  version: string,
  artifact: string,
  sourceFiles: Files,
  channel: string,
  profile: Profile,
  root = ROOT,
): string {
  const path = recordPath(version, channel, root);
  const data = readFileSync(artifact);
  const artifactSha = digest(data);
  const sourceSha = fingerprint(sourceFiles);
  immutableWrite(`${artifact}.sha256`, Buffer.from(`${artifactSha}  ${basename(artifact)}\n`));
  if (existsSync(path) || isSymlink(path)) {
    const [, existing] = loadRecord(relative(root, path), root);
    if (
      existing.artifact.sha256 !== artifactSha ||
      existing.source.sha256 !== sourceSha ||
      existing.build.profile !== profile
    ) {
      throw new Error('Release record differs; increase the plugin version');
    }
    return path;
  }
  const record: ReleaseRecord = {
    schema_version: 2,
    component: 'plugin',
    channel,
    version,
    created_at: now(),
    stage: 'prepared',
    source: sourceState(sourceFiles, root),
    build: {
      node: process.versions.node,
      builder: '.build/tooling/scripts/release.js',
      builder_sha256: digest(readFileSync(fileURLToPath(import.meta.url))),
      builder_files: Object.fromEntries(
        ['release.js', 'common.js', 'archive.js', 'models.js'].map((name) => [
          name,
          digest(readFileSync(fileURLToPath(new URL(name, import.meta.url)))),
        ]),
      ),
      profile,
    },
    artifact: {
      path: relative(root, artifact).split('\\').join('/'),
      sha256: artifactSha,
      bytes: data.length,
    },
    identities: {},
    checks: {},
    events: [{ stage: 'prepared', at: now() }],
  };
  immutableWrite(path, canonicalJson(record));
  return path;
}
export function buildPlugin(
  profile: Profile = 'standalone',
  channel: string = profile,
  root = ROOT,
): string {
  const [manifest, files] = pluginFiles(join(root, 'plugins/remote-device-hub'), profile, root);
  const inputs: Files = new Map(
    [...files]
      .filter(([name]) => name !== '.app.json')
      .map(([name, data]) => [`plugins/remote-device-hub/${name}`, data]),
  );
  if (profile === 'connected') {
    inputs.set('integrations/chatgpt/connected-app.json', requiredFile(files, '.app.json'));
  }
  const version = manifest.version;
  const record = recordPath(manifest.version, channel, root);
  if (existsSync(record) || isSymlink(record)) {
    const [, existing] = loadRecord(relative(root, record), root);
    if (existing.component !== 'plugin' || existing.build.profile !== profile) {
      throw new Error('Use a distinct channel for each plugin profile');
    }
    if (
      existing.source.sha256 !== fingerprint(inputs) ||
      !sameFiles(archiveContents(readFileSync(join(root, existing.artifact.path))), files)
    ) {
      throw new Error('Plugin renderer changed the recorded artifact; increase the plugin version');
    }
    return record;
  }
  const archive = createArchive(files);
  if (!sameFiles(archiveContents(archive), files)) {
    throw new Error('Plugin archive checksum/readback failed');
  }
  const artifact = join(root, 'dist', `remote-device-hub-plugin-${profile}-${version}.zip`);
  immutableWrite(artifact, archive);
  return savePrepared(version, artifact, inputs, channel, profile, root);
}
export function loadRecord(reference: string, root = ROOT): [string, ReleaseRecord] {
  const raw = resolve(root, reference);
  if (isSymlink(raw)) {
    throw new Error('Record must be directly under releases/');
  }
  const path = realpathSync(raw);
  if (dirname(path) !== realpathSync(join(root, 'releases'))) {
    throw new Error('Record must be directly under releases/');
  }
  const record = readReleaseRecord(readFileSync(path));
  const metadata = record.artifact;
  const artifact = resolve(root, metadata.path);
  if (isSymlink(artifact) || realpathSync(dirname(artifact)) !== realpathSync(join(root, 'dist'))) {
    throw new Error('Artifact must be directly under dist/');
  }
  if (digest(readFileSync(artifact)) !== metadata.sha256) {
    throw new Error('Artifact checksum no longer matches its release');
  }
  return [path, record];
}
export interface RecordResult {
  record: string;
  stage: Stage;
  host: string;
  evidence: string[];
  check: string[];
  note: string;
}
export function recordResult(args: RecordResult, root = ROOT): void {
  const [path, record] = loadRecord(args.record, root);
  const transitions: Record<Stage, readonly Stage[]> = {
    prepared: ['prepared', 'uploaded', 'published'],
    uploaded: ['uploaded', 'published', 'verified'],
    published: ['published', 'verified'],
    failed: ['uploaded', 'published'],
    verified: ['verified'],
  };
  if (args.stage !== 'failed' && !transitions[record.stage].includes(args.stage)) {
    throw new Error('Unsupported or backwards release transition');
  }
  if (!args.host || !args.evidence.length) {
    throw new Error('Specify the actual host and attach evidence');
  }
  const checks = { ...record.checks };
  for (const item of args.check) {
    const separator = item.indexOf('=');
    const key = item.slice(0, separator);
    const value = item.slice(separator + 1);
    if (separator < 1 || !isCheckResult(value)) {
      throw new Error('Check result must be passed, failed, or unverified');
    }
    Object.defineProperty(checks, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  if (args.stage === 'verified' && REQUIRED_CHECKS.some((key) => checks[key] !== 'passed')) {
    throw new Error('Required checks have not all passed');
  }
  const evidence = args.evidence.map((reference) => {
    const raw = resolve(root, reference);
    if (isSymlink(raw)) {
      throw new Error('Evidence must be an existing file within this project');
    }
    const entry = realpathSync(raw);
    const rel = relative(realpathSync(root), entry);
    if (!lstatSync(entry).isFile() || !isContainedRelativePath(rel)) {
      throw new Error('Evidence must be an existing file within this project');
    }
    return { path: rel.split('\\').join('/'), sha256: digest(readFileSync(entry)) };
  });
  record.stage = args.stage;
  record.checks = checks;
  record.events.push({
    stage: args.stage,
    at: now(),
    host: args.host,
    checks,
    evidence,
    note: args.note,
  });
  const temporary = path.replace(/\.json$/, '.tmp');
  writeFileSync(temporary, canonicalJson(record), { flag: 'wx' });
  renameSync(temporary, path);
}
export function main(args = process.argv.slice(2)): void {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      profile: { type: 'string', default: 'standalone' },
      channel: { type: 'string' },
      stage: { type: 'string' },
      host: { type: 'string' },
      evidence: { type: 'string', multiple: true },
      check: { type: 'string', multiple: true },
      note: { type: 'string', default: '' },
    },
  });
  mkdirSync(join(ROOT, '.build'), { recursive: true });
  mkdirSync(join(ROOT, 'dist'), { recursive: true });
  const [command, reference] = positionals;
  if (positionals.length !== 2) {
    throw new Error(
      'Usage: release build plugin [--profile standalone|connected] | check RECORD | record RECORD --stage STAGE --host HOST --evidence FILE',
    );
  }
  if (command === 'build' && reference === 'plugin') {
    if (values.profile !== 'standalone' && values.profile !== 'connected') {
      throw new Error('Unknown plugin profile');
    }
    console.log(`Prepared: ${relative(ROOT, buildPlugin(values.profile, values.channel))}`);
  } else if (command === 'check' && reference) {
    const [, record] = loadRecord(reference);
    console.log(`Checksum OK; stage=${record.stage}; artifact=${record.artifact.path}`);
  } else if (command === 'record' && reference) {
    const stage = values.stage;
    if (!isStage(stage)) {
      throw new Error('Invalid release stage');
    }
    recordResult({
      record: reference,
      stage,
      host: values.host ?? '',
      evidence: values.evidence ?? [],
      check: values.check ?? [],
      note: values.note,
    });
  } else {
    throw new Error('Unknown release command');
  }
}
if (isMain(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`Release rejected: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
