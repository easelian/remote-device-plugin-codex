import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  ROOT,
  canonicalJson,
  fingerprint,
  fullMatch,
  hashes,
  isMain,
  isSymlink,
  object,
  parseJson,
  requiredFile,
  text,
  type Files,
  type JsonObject,
} from './common.js';
import { openai } from './models.js';
import { sourceFiles, validate } from './prepare_submission.js';
import { validateCodexHubMcp } from './mcp_contract.js';

export const MARKETPLACE = 'rdh-development';
const GENERATED = 'development.json';

export function developmentFiles(source: Files, binding?: JsonObject): Files {
  validate(source);
  const files = new Map(source);
  if (binding) {
    const apps = object(binding.apps);
    if (
      Object.keys(binding).length !== 1 ||
      Object.keys(apps).length !== 1 ||
      Object.values(apps).some((app) => {
        const entry = object(app);
        return (
          Object.keys(entry).length !== 1 ||
          !fullMatch(/(?:asdk_app_|connector_|templated_apps_)[a-zA-Z0-9_-]+/, text(entry.id))
        );
      })
    ) {
      throw new Error('Use exactly one existing registered App binding without credentials');
    }
    const manifest = parseJson(requiredFile(source, 'plugin.json'));
    openai(manifest).apps = './.app.json';
    files.set('plugin.json', canonicalJson(manifest));
    files.set('.app.json', canonicalJson(binding));
    files.delete('mcp.json');
  } else {
    // Codex 0.167 rejects per-server extensions. Let this local development
    // connection discover OAuth from the server; keep the source/upload intact.
    const mcp = parseJson(requiredFile(source, 'mcp.json'));
    delete object(object(mcp.mcpServers)['remote-device-hub']).extensions;
    validateCodexHubMcp(mcp);
    files.set('mcp.json', canonicalJson(mcp));
  }
  return files;
}

export function prepare(root = ROOT, binding?: JsonObject): JsonObject {
  const source = sourceFiles(join(root, 'plugins/remote-device-hub'));
  const [manifest] = validate(source);
  const files = developmentFiles(source, binding);
  const buildRoot = join(root, '.build');
  const destination = join(buildRoot, 'development');
  if (isSymlink(buildRoot) || isSymlink(destination)) {
    throw new Error('Development output must not be a symlink');
  }
  if (existsSync(destination)) {
    const marker = join(destination, GENERATED);
    if (
      isSymlink(marker) ||
      !existsSync(marker) ||
      parseJson(readFileSync(marker)).marketplace !== MARKETPLACE
    ) {
      throw new Error('Refusing to replace an unrecognized development directory');
    }
  }
  mkdirSync(buildRoot, { recursive: true });
  const staging = mkdtempSync(join(buildRoot, '.development-'));
  const report: JsonObject = {
    marketplace: MARKETPLACE,
    plugin: manifest.name,
    version: manifest.version,
    canonical_source: 'plugins/remote-device-hub',
    source_sha256: fingerprint(source),
    authentication: binding ? 'existing-app' : 'server-oauth-discovery',
    files: hashes(files),
    installed: false,
    note: 'Generated development files only. Installation, OAuth and actual tool calls are separate checks.',
  };
  try {
    for (const [name, bytes] of files) {
      const path = join(staging, 'plugins', manifest.name, name);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, bytes);
    }
    const catalogue = join(staging, '.agents/plugins/marketplace.json');
    mkdirSync(dirname(catalogue), { recursive: true });
    writeFileSync(
      catalogue,
      canonicalJson({
        name: MARKETPLACE,
        interface: { displayName: 'Easelian RDH Development' },
        plugins: [
          {
            name: manifest.name,
            source: { source: 'local', path: `./plugins/${manifest.name}` },
            policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
            category: 'Developer Tools',
          },
        ],
      }),
    );
    writeFileSync(join(staging, GENERATED), canonicalJson(report));
    // Only the marked, generated tree is replaced. The canonical source and
    // the user's installed cache/configuration are never edited here.
    rmSync(destination, { recursive: true, force: true });
    renameSync(staging, destination);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
  return report;
}

export function main(args = process.argv.slice(2)): void {
  const { values } = parseArgs({ args, options: { 'app-binding': { type: 'string' } } });
  const binding = values['app-binding']
    ? parseJson(readFileSync(resolve(values['app-binding'])))
    : undefined;
  console.log(JSON.stringify(prepare(ROOT, binding), null, 2));
}

if (isMain(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
