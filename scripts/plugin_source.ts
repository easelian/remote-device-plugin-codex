import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROOT,
  fullMatch,
  httpsUrl,
  isSymlink,
  localPath,
  object,
  requiredFile,
  text,
  utf8,
  validatePng,
  type Files,
  type Json,
} from './common.js';
import { openai, readPluginManifest, type PluginManifest } from './models.js';

export const SOURCE = join(ROOT, 'plugins/remote-device-hub');
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

// Shared content rules; runtime dependencies and portal transport are validated separately.
export function validateContent(
  files: Files,
  connectionFiles: string[],
): [PluginManifest, string[]] {
  for (const name of files.keys()) {
    if (name.startsWith('/') || name.split('/').includes('..') || name.includes('\\')) {
      throw new Error('Unsafe plugin path');
    }
  }
  const manifest = readPluginManifest(requiredFile(files, 'plugin.json'));
  if (manifest.name !== 'remote-device-hub') {
    throw new Error('Preserve the existing plugin name');
  }
  if (!fullMatch(/\d+\.\d+\.\d+/, text(manifest.version))) {
    throw new Error('Expected semantic version');
  }
  const ext = openai(manifest);
  const ui = ext.interface;
  const gaps: string[] = [];
  const categories = new Set([
    'Business & Operations',
    'Communication',
    'Creativity',
    'Data & Analytics',
    'Developer Tools',
    'Education & Research',
    'Entertainment',
    'Finance',
    'Healthcare',
    'Other',
    'Productivity',
    'Scientific Research',
    'Security',
    'Travel',
  ]);
  if (!categories.has(text(ui.category))) {
    throw new Error('Unsupported public plugin category');
  }
  if ('defaultPrompt' in ui) {
    const prompts = ui.defaultPrompt;
    if (
      !Array.isArray(prompts) ||
      prompts.length > 3 ||
      prompts.some(
        (prompt) =>
          typeof prompt !== 'string' ||
          !prompt.trim() ||
          /[\r\n]/.test(prompt) ||
          [...prompt].length > 128,
      )
    ) {
      throw new Error('Public defaultPrompt requires at most three nonblank single-line prompts');
    }
    const normalized = prompts.map((prompt) => text(prompt).trim().replace(/\s+/g, ' '));
    if (new Set(normalized).size !== normalized.length) {
      throw new Error('Public defaultPrompt entries must be unique');
    }
  }
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
  const allowed = new Set(['plugin.json', 'LICENSE', ...connectionFiles]);
  if (manifest.license !== 'Apache-2.0' || requiredFile(files, 'LICENSE').length === 0) {
    throw new Error('Public package requires Apache-2.0 and its LICENSE text');
  }
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
      `Unexpected plugin files: ${[...files.keys()]
        .filter((name) => !allowed.has(name))
        .sort()
        .join(', ')}`,
    );
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
