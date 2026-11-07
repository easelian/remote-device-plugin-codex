# Maintenance and packaging

Maintain plugin content only in `plugins/remote-device-hub/`. The Server, Protocol, and Agent have separate repositories. Changes here do not deploy the Hub or update device Agents.

## Build and validate

Use Node.js 22 or later and Python 3. Run from the repository root:

```sh
npm ci
npm run style:check
npm run typecheck
npm test
npm run dev:prepare
npm run dev:check
npm run package:draft
```

The build removes stale emitted modules under `.build/tooling/` before compiling current TypeScript sources. Tests cover canonical metadata, isolated development generation, archive readback, immutability, traversal and symlink rejection, and public-package credential exclusion. The fixed archive fixture contains only serialization and ZIP interoperability samples; it is not a copy of the plugin.

`dev:check` requires the intended Codex executable on PATH. It proves component discovery only. Use the separate [installation and account validation procedure](chatgpt.md) to verify installation, OAuth, and actual tools.

After installation and OAuth, `npm run dev:verify` checks the installed version and cache hashes, opens an ephemeral read-only Codex session, verifies the connection belongs to `rdh-development`, and calls `list_devices`. Its report contains counts, not device identifiers or file contents. It refuses stale installs, another plugin's connection, missing OAuth, and unsuccessful tool responses. Python regression checks exercise those refusal paths and run as part of `npm test`.

## Generated local marketplace

`npm run dev:prepare` replaces only its marked `.build/development/` tree. It writes a marketplace catalog, a plugin copy, and `development.json` with canonical-source and generated-file hashes. Unknown directories or symlinks at the output path are refused. Do not edit generated files or the Codex installation cache.

The canonical MCP configuration declares OAuth DCR and `devices:control`. For the current Codex 0.167 local loader, generation removes the per-server `extensions` field and validates a connection containing only `type` and `url`. The client must still discover and complete OAuth against the Hub. This adapter does not disable Hub authentication, embed credentials, or change the public upload.

Install or refresh with `npm run dev:install`. Installation uses the user's official Codex configuration and plugin cache. It does not overwrite other marketplace entries or publish an account plugin. The local marketplace is named `rdh-development`; the plugin identity remains `remote-device-hub`.

## Existing account-bound development connection

`integrations/chatgpt/connected-app.json` retains an existing account-specific App binding. It is not part of the canonical plugin or any public ZIP. If that App is still accessible to the intended account, generate the local development copy with:

```sh
npm run dev:prepare -- --app-binding integrations/chatgpt/connected-app.json
codex plugin marketplace add ./.build/development
codex plugin add remote-device-hub@rdh-development --json
npm run dev:check
```

This substitutes the supplied App binding for direct MCP discovery only in generated files. It does not prove that the App is authorized or usable. `npm run dev:install` regenerates the default direct-MCP configuration; use the explicit commands above for an App-bound test. Do not copy a publisher's App ID into another user's setup.

## Public ZIPs

`npm run package:draft` writes replaceable draft ZIPs and reports under `dist/`. `npm run package` requires complete package metadata and writes an immutable candidate ZIP. Change the canonical version before changing an existing candidate. Both builds read only the canonical source, so neither can accidentally package the generated local authentication adapter or an account binding.

Inspect the report's `missing_materials` and `package_metadata_complete`. `submission_ready` remains false because local packaging cannot establish portal scans, reviewer access, legal attestations, approval, or publication. Keep those checks distinct from the local artifact checksum.

## Brand

`plugins/remote-device-hub/assets/icon.png` is the shared 256 × 256 product icon. Sync it from `brand`; both outputs use the same bytes. The under-10,000-byte asset limit is this repository's constraint, not a platform-wide limit. Ordinary builds do not need the sibling brand checkout.
