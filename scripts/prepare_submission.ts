import { validateHubMcp } from './submission_mcp.js';
import { validatePlugin } from './app_contract.js';
import { SOURCE, sourceFiles, validateContent } from './plugin_source.js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';
import { archiveContents, createArchive, sameFiles } from './archive.js';
import {
  ROOT,
  canonicalJson,
  digest,
  hashes,
  immutableWrite,
  isMain,
  parseJson,
  requiredFile,
  utf8,
  type Files,
  type Json,
  type JsonObject,
} from './common.js';
import { openai, type PluginManifest } from './models.js';
export { localPath } from './common.js';
export { SOURCE, sourceFiles } from './plugin_source.js';
export const SUBMISSION_MCP = join(ROOT, 'integrations/openai/submission-mcp.json');
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
      if (['apps', 'hooks'].includes(key)) {
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
    if (name.endsWith('.json') || name.endsWith('.md')) {
      const content = utf8(requiredFile(files, name));
      if (/\b(?:plugin_)?(?:asdk_app_|connector_|templated_apps_)[a-zA-Z0-9_-]+/.test(content)) {
        throw new Error(`Account-specific registered App ID in public upload: ${name}`);
      }
    }
  }
  const result = validateContent(files, ['mcp.json']);
  const mcp = parseJson(requiredFile(files, 'mcp.json'));
  checkForbidden(result[0]);
  checkForbidden(mcp);
  validateHubMcp(mcp);
  return result;
}

// Public submission requires a service URL, not an account-specific App reference.
// This archive is an input to the portal; it is never used by dev:install.
export function submissionFiles(source: Files, mcp: JsonObject): Files {
  validatePlugin(source);
  validateHubMcp(mcp);
  const files = new Map(source);
  const manifest = parseJson(requiredFile(files, 'plugin.json'));
  delete openai(manifest).apps;
  files.set('plugin.json', canonicalJson(manifest));
  files.delete('.app.json');
  files.set('mcp.json', canonicalJson(mcp));
  validate(files);
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
  distribution: 'public-directory';
  account_bound: false;
  clean_chatgpt_account_verified: false;
  note: string;
  files: JsonObject;
}
export function build(
  source: string,
  destination: string,
  allowIncomplete = false,
): [string, SubmissionReport] {
  const files = submissionFiles(sourceFiles(source), parseJson(readFileSync(SUBMISSION_MCP)));
  const [manifest, gaps] = validate(files);
  if (gaps.length && !allowIncomplete) {
    throw new Error(`Incomplete submission materials: ${gaps.join(', ')}`);
  }
  mkdirSync(destination, { recursive: true });
  const version = manifest.version;
  const archive = join(
    destination,
    `remote-device-hub-public-${version}${allowIncomplete ? '-draft' : ''}.zip`,
  );
  const bytes = createArchive(files);
  // A published-version candidate must not silently change under the same name.
  if (allowIncomplete) {
    writeFileSync(archive, bytes);
  } else {
    immutableWrite(archive, bytes);
  }
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
    distribution: 'public-directory',
    account_bound: false,
    clean_chatgpt_account_verified: false,
    note: 'An author upload is not an installed cross-account release. Publication identity, demo, reviewer access, Portal checks, approval, publication, and clean ChatGPT/Codex account acceptance must be verified separately.',
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
