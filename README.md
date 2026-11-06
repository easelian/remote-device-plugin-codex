# Remote Device Hub for ChatGPT and Codex

![Remote Device Hub](plugins/remote-device-hub/assets/icon.svg)

Remote Device Hub by EaseLian connects ChatGPT and Codex to Linux and macOS devices that you enroll and authorize. The plugin provides an operations skill and an authenticated MCP connection for device status, files, shell commands, and Agent-managed processes.

[Remote Device Hub](https://rdh.easelian.com) · [Source](https://github.com/easelian/remote-device-plugin-codex) · [Support](https://rdh.easelian.com/contact)

Each user signs in to their own Hub account and pairs their own devices. Available operations depend on the selected device's permissions and capabilities. File roots constrain file tools; shell commands run with the Agent operating-system account's permissions.

## Packages

| Source | Purpose | Connection | Icon |
| --- | --- | --- | --- |
| `plugins/remote-device-hub/` | Codex standalone package | MCP type and URL; OAuth discovery by the client | SVG |
| `public/remote-device-hub/` | Public submission source | MCP with explicit OAuth dynamic client registration | 256 × 256 PNG |
| `integrations/chatgpt/connected-app.json` | Connected build profile | Registered App identity | SVG |

The plugin name is `remote-device-hub`. Source manifests use version `1.3.12`. The Codex package contains a portable manifest and a `.codex-plugin/plugin.json` compatibility manifest with matching identity and presentation. The public upload excludes account-specific App bindings.

## Build and validate

Use Node.js 22 or later. Run from the repository root:

```sh
npm ci
npm run style:check
npm test
npm run package:standalone
npm run check:codex
```

The standalone archive is `dist/remote-device-hub-plugin-standalone-1.3.12.zip`. Its integrity manifest is written under `.build/release/`. The loader check must report `loaded_mcp_servers: ["remote-device-hub"]` and `passed: true`. It checks discovery without installing the plugin, authorizing a Hub account, or calling a device tool.

For public-submission materials, use `npm run package:draft` to generate a ZIP and readiness report under `dist/`. `npm run package` requires all mandatory metadata and fails when materials are missing. Building does not upload, submit, or publish a plugin. See [submission preparation](docs/publication/submission.md).

## Connect and use

Install the package through the client's supported plugin flow, authorize your Hub account, and call `list_devices`. An empty list means the account has no visible devices. Follow the Agent setup and pairing instructions on the Hub website, then query again.

If Codex shows the plugin as installed but does not expose its MCP tools, verify the `plugins."<plugin-name>@<marketplace-name>".enabled` setting in the user config and start a new conversation. Native Codex OAuth uses a loopback redirect, which the Hub Auth service must allow.

Select a device returned by the service and inspect its roots and permissions before running file or process operations. Verify writes with readback and jobs with their returned status. See [ChatGPT and Codex verification](docs/chatgpt.md) for separate loader, authorization, and device-call checks.

## Brand assets and license

The icons use the Remote Device Hub product artwork: an off-white desktop display with an upper-right opening, centered lock, and short key with two teeth on a fixed charcoal badge. The same two-color icon works on light and dark surfaces without host theme selection. EaseLian is the publisher. The standalone package uses SVG. Public submission requires PNG and includes the same artwork at 256 × 256 pixels. Each icon is below 10,000 bytes. See [asset export instructions](assets/branding/remote-device-hub/README.md).

The repository and plugin packages use Apache License 2.0. The full [LICENSE](LICENSE) is included in each package.

## Development

Skills are maintained in `plugins/remote-device-hub/skills/` and synchronized with the public source. Scripts parse manifests and build deterministic ZIPs. Fixed test inputs verify canonical JSON, file hashes, archive bytes, and release-record checks independently of the listing text.

`npm run format` formats scripts and tests. `npm run style:check` checks formatting and lint rules; `npm run lint` runs only the linter. Biome uses two-space indentation, single quotes, semicolons, trailing commas, and explicit type imports. Generated files and fixed fixtures are outside its formatting scope. See [maintenance](docs/maintenance.md).

## Deployment addresses

MCP and public-listing URLs are generated from the Server repository's `deploy/config.json`. With sibling checkouts, run:

```sh
python3 ../remote-device-server/scripts/sync-deployment.py
python3 ../remote-device-server/scripts/sync-deployment.py --check
```

The generator also accepts `--project remote-device-plugin-codex` with an explicit `--workspace` parent directory. Builds use the generated manifests and do not require the Server checkout. Registered account Apps are managed separately through their platform connection settings.
