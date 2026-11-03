# Maintenance and packaging

This repository contains plugin sources, ChatGPT connection metadata, EaseLian assets, public-submission materials, and packaging tools. The Server, Protocol, and Agent have separate repositories.

## Local builds

With Node.js 22 or later, run from the repository root:

```sh
npm ci
npm run style:check
npm run typecheck
npm test
npm run package:standalone
npm run release -- build plugin --profile connected
npm run package:draft
```

Standalone packages use the MCP endpoint and client OAuth discovery. The connected profile uses the registered App identity in `integrations/chatgpt/connected-app.json` and is account-bound. Public submission uses `public/remote-device-hub/` and excludes that binding.

Packages are written to `dist/`; release integrity manifests are written to `.build/release/`. These are ignored build outputs. Release archives are immutable: change the manifest version before building different bytes under the same release name. Draft submission outputs are replaceable.

## Source consistency

Keep the portable and compatibility manifests aligned in name, version, author, license, and interface fields. Synchronize skill files between the standalone and public source trees. Both source trees include the repository's Apache-2.0 LICENSE.

Standalone icons are SVG. Public-submission icons are square PNGs, at least 256 × 256 pixels for the listing logo and 48 × 48 for the composer. Both use the universal Remote Device Hub product icon and remain below the project's 10,000-byte per-icon limit. [Brand instructions](../assets/branding/remote-device-hub/README.md) describe the source and PNG export.

## Validation

Tests cover package construction, archive readback, component containment, metadata, and release records. Fixed inputs verify canonical JSON bytes, profile hashes, and ZIPs with empty files, binary data, and Unicode filenames.

Run `npm run check:codex` against the intended Codex executable to verify MCP discovery. Then verify account authorization and a real `list_devices` call in each target client. Package validation and client acceptance are separate checks. [Submission preparation](publication/submission.md) covers the public workflow.
