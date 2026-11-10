import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import {
  ROOT,
  canonicalJson,
  fingerprint,
  hashes,
  isMain,
  isSymlink,
  parseJson,
  requiredFile,
  type Files,
  type JsonObject,
} from './common.js';
import { sourceFiles } from './plugin_source.js';
import { validatePlugin } from './app_contract.js';
import { openai } from './models.js';

export const MARKETPLACE = 'rdh-development';
const GENERATED = 'development.json';

export function developmentFiles(source: Files): Files {
  validatePlugin(source);
  const files = new Map(source);
  const manifest = parseJson(requiredFile(source, 'plugin.json'));
  // Codex 0.167 discovers registered Apps only through the same compatibility
  // manifest used by OpenAI's installed plugins. Do not ship a root manifest:
  // its presence masks the compatibility manifest even when it has no overlay.
  const compatibility: JsonObject = { ...manifest, ...openai(manifest), skills: './skills' };
  delete compatibility.$schema;
  delete compatibility.extensions;
  files.delete('plugin.json');
  files.set('.codex-plugin/plugin.json', canonicalJson(compatibility));
  return files;
}

export function prepare(root = ROOT): JsonObject {
  const source = sourceFiles(join(root, 'plugins/remote-device-hub'));
  const [manifest] = validatePlugin(source);
  const files = developmentFiles(source);
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
    authentication: 'registered-app',
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
  if (args.length) {
    throw new Error(
      'No connection mode options are supported; configure the required App in plugins/remote-device-hub/.app.json',
    );
  }
  console.log(JSON.stringify(prepare(ROOT), null, 2));
}

if (isMain(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
