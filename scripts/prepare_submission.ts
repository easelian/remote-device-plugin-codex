import { mkdirSync, readFileSync, readdirSync, lstatSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';
import { archiveContents, createArchive, sameFiles } from './archive.js';
import {
  ROOT,
  canonicalJson,
  digest,
  fullMatch,
  hashes,
  httpsUrl,
  isMain,
  isSymlink,
  localPath,
  object,
  parseJson,
  requiredFile,
  text,
  utf8,
  validatePng,
  type Files,
  type Json,
  type JsonObject,
} from './common.js';
import { openai } from './release.js';
import { readPluginManifest, type PluginManifest } from './models.js';
export { localPath } from './common.js';
export const SOURCE = join(ROOT, 'public/remote-device-hub');
const URL_FIELDS = ['websiteURL', 'supportURL', 'privacyPolicyURL', 'termsOfServiceURL'];
function truthy(value: Json | undefined): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (value && typeof value === 'object') {
    return Object.keys(value).length > 0;
  }
  return Boolean(value);
}
export function checkForbidden(value: Json): void {
  if (Array.isArray(value)) {
    value.forEach(checkForbidden);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      if (['apps', 'hooks'].includes(key) && entry !== null) {
        throw new Error(`Public uploads must not contain ${key}`);
      }
      if (['clientSecret', 'test_credentials', 'reviewer_instructions'].includes(key)) {
        throw new Error(`Private submission field in ZIP: ${key}`);
      }
      if (key === 'headers' && truthy(entry)) {
        throw new Error('Public MCP configuration must not embed headers');
      }
      checkForbidden(entry);
    }
  }
}
export function validate(files: Files): [PluginManifest, string[]] {
  for (const name of files.keys()) {
    if (name.startsWith('/') || name.split('/').includes('..') || name.includes('\\')) {
      throw new Error('Unsafe archive path');
    }
    if (name === '.app.json' || name.split('/').some((part) => part.startsWith('.env'))) {
      throw new Error('Private file in public upload');
    }
  }
  const manifest = readPluginManifest(requiredFile(files, 'plugin.json'));
  const mcp = parseJson(requiredFile(files, 'mcp.json'));
  checkForbidden(manifest);
  checkForbidden(mcp);
  if (manifest.name !== 'remote-device-hub') {
    throw new Error('Preserve the existing plugin name');
  }
  if (!fullMatch(/\d+\.\d+\.\d+/, text(manifest.version))) {
    throw new Error('Expected semantic version');
  }
  const ext = openai(manifest);
  const ui = ext.interface;
  const gaps: string[] = [];
  for (const [key, limit] of [
    ['displayName', 30],
    ['shortDescription', 30],
    ['longDescription', 4000],
  ] as const) {
    const value = ui[key];
    if (typeof value !== 'string' || !value.trim() || [...value].length > limit) {
      throw new Error(`Invalid listing field: ${key}`);
    }
    if (key !== 'longDescription' && /[\n\r]/.test(value)) {
      throw new Error(`Listing field must be one line: ${key}`);
    }
  }
  const publisher = ui.developerName;
  if (!truthy(publisher) || publisher === 'App developer') {
    gaps.push('verified_publisher_name');
  } else if (
    typeof publisher !== 'string' ||
    [...publisher].length > 80 ||
    publisher.includes('\n')
  ) {
    throw new Error('Invalid developerName');
  }
  for (const key of URL_FIELDS) {
    if (!truthy(ui[key])) {
      gaps.push(key);
    } else {
      httpsUrl(ui[key]);
    }
  }
  const allowed = new Set(['plugin.json', 'mcp.json']);
  for (const key of ['logo', 'composerIcon', 'logoDark', 'composerIconDark']) {
    if (!(key in ui)) {
      if (key === 'logo' || key === 'composerIcon') {
        throw new Error(`Missing ${key}`);
      }
      continue;
    }
    const name = localPath(ui[key]);
    allowed.add(name);
    validatePng(name, requiredFile(files, name), key.startsWith('logo') ? 256 : 48);
  }
  for (const [name, data] of files) {
    if (name.startsWith('skills/')) {
      if (!name.endsWith('.md')) {
        throw new Error(`Unexpected skill asset: ${name}`);
      }
      allowed.add(name);
      if (name.endsWith('/SKILL.md')) {
        const skill = name.split('/').at(-2);
        const content = utf8(data);
        if (
          !content.startsWith('---\n') ||
          !content.includes(`\nname: ${skill}\n`) ||
          !content.includes('\ndescription: ')
        ) {
          throw new Error(`Invalid skill frontmatter: ${name}`);
        }
      }
    }
  }
  if (files.size !== allowed.size || [...files.keys()].some((name) => !allowed.has(name))) {
    throw new Error(
      `Unexpected public files: ${[...files.keys()]
        .filter((name) => !allowed.has(name))
        .sort()
        .join(', ')}`,
    );
  }
  const servers = object(mcp.mcpServers);
  if (Object.keys(servers).length !== 1 || !Object.hasOwn(servers, 'remote-device-hub')) {
    throw new Error('Expected the existing single Hub MCP server');
  }
  const server = object(servers['remote-device-hub']);
  httpsUrl(server.url);
  if (server.type !== 'streamable-http') {
    throw new Error('Expected remote Streamable HTTP transport');
  }
  const auth = object(object(object(server.extensions)['com.openai']).auth);
  if (auth.type !== 'oauth' || object(auth.client).mode !== 'dcr') {
    throw new Error('Preserve the Hub OAuth DCR configuration');
  }
  if (
    !Array.isArray(auth.baseScopes) ||
    auth.baseScopes.length !== 1 ||
    auth.baseScopes[0] !== 'devices:control'
  ) {
    throw new Error("Use the Hub's supported authorization scope");
  }
  const review = object(ext.review ?? {});
  const casesByKind = object(review.test_cases ?? {});
  for (const [kind, count] of [
    ['positive', 5],
    ['negative', 3],
  ] as const) {
    const cases = casesByKind[kind];
    if (!Array.isArray(cases) || cases.length !== count) {
      throw new Error(`Expected exactly ${count} ${kind} review cases`);
    }
    const fields =
      kind === 'positive'
        ? ['description', 'prompt', 'tools_triggered', 'expected_behavior']
        : ['description', 'prompt'];
    for (const item of cases) {
      const testCase = object(item);
      if (fields.some((key) => typeof testCase[key] !== 'string' || !testCase[key].trim())) {
        throw new Error(`Incomplete ${kind} review case`);
      }
    }
  }
  if (!truthy(review.demo_recording_url)) {
    gaps.push('verified_demo_recording_url');
  } else {
    httpsUrl(review.demo_recording_url);
  }
  if (!('commerce' in review)) {
    gaps.push('confirmed_commerce_declaration');
  } else if (typeof review.commerce !== 'boolean' || !truthy(review.commerce_description)) {
    throw new Error('Invalid commerce declaration');
  }
  const publication = object(ext.publication ?? {});
  if (!Array.isArray(publication.countries) || publication.countries.length !== 0) {
    throw new Error('User selected all platform-permitted countries');
  }
  if (!truthy(publication.release_notes)) {
    throw new Error('Missing release notes');
  }
  return [manifest, gaps];
}
export function sourceFiles(source: string): Files {
  if (isSymlink(source)) {
    throw new Error('Source must not be a symlink');
  }
  const files: Files = new Map();
  function visit(directory: string, prefix: string): void {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name);
      const relative = prefix + name;
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) {
        throw new Error(`Source contains symlink: ${name}`);
      }
      if (stat.isDirectory()) {
        visit(path, `${relative}/`);
      } else if (stat.isFile()) {
        files.set(relative, readFileSync(path));
      }
    }
  }
  visit(source, '');
  return files;
}
export interface SubmissionReport extends JsonObject {
  archive: string;
  version: string;
  sha256: string;
  format_checks: 'passed';
  package_metadata_complete: boolean;
  missing_materials: string[];
  submission_ready: false;
  note: string;
  files: JsonObject;
}
export function build(
  source: string,
  destination: string,
  allowIncomplete = false,
): [string, SubmissionReport] {
  const files = sourceFiles(source);
  const [manifest, gaps] = validate(files);
  if (gaps.length && !allowIncomplete) {
    throw new Error(`Incomplete submission materials: ${gaps.join(', ')}`);
  }
  mkdirSync(destination, { recursive: true });
  const version = manifest.version;
  const archive = join(
    destination,
    `remote-device-hub-public-${version}${gaps.length ? '-draft' : ''}.zip`,
  );
  const bytes = createArchive(files);
  // Public drafts retain the existing replaceable-output behavior, separate from immutable releases.
  writeFileSync(archive, bytes);
  const actual = archiveContents(readFileSync(archive));
  validate(actual);
  if (!sameFiles(actual, files)) {
    throw new Error('Archive content does not match source');
  }
  const sha = digest(bytes);
  writeFileSync(`${archive}.sha256`, `${sha}  ${basename(archive)}\n`);
  const report: SubmissionReport = {
    archive: basename(archive),
    version,
    sha256: sha,
    format_checks: 'passed',
    package_metadata_complete: gaps.length === 0,
    missing_materials: gaps,
    submission_ready: false,
    note: 'Local checks do not verify publication identity, policy content, demo playback, reviewer access, host behavior, deployment, or Portal scans.',
    files: hashes(files),
  };
  writeFileSync(archive.replace(/\.zip$/, '.report.json'), canonicalJson(report));
  return [archive, report];
}
export function main(args = process.argv.slice(2)): void {
  const { values } = parseArgs({
    args,
    options: { 'allow-incomplete': { type: 'boolean', default: false } },
  });
  const [, report] = build(SOURCE, join(ROOT, 'dist'), values['allow-incomplete']);
  console.log(JSON.stringify(report, null, 2));
}
if (isMain(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
