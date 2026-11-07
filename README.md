# Remote Device Hub for ChatGPT and Codex

![Remote Device Hub](plugins/remote-device-hub/assets/icon.png)

Remote Device Hub by Easelian connects ChatGPT and Codex to Linux and macOS devices that you enroll and authorize. It provides an operations skill and an authenticated MCP connection for device status, files, shell commands, and Agent-managed processes.

[Website](https://easelian.com/) · [Source](https://github.com/easelian/remote-device-plugin-codex) · [Support](https://easelian.com/contact)

Each user signs in to their own Hub account and pairs their own devices. Available operations depend on device permissions and capabilities. File roots constrain file tools; shell commands run with the Agent operating-system account's permissions.

## One plugin source

`plugins/remote-device-hub/` is the only maintained plugin source. Its portable `plugin.json`, OAuth configuration in `mcp.json`, skill files, product icon, and Apache-2.0 license are used for both local development and public submission. The plugin name is `remote-device-hub` and the current version is `1.3.14`.

| Output | Purpose | Generated location |
| --- | --- | --- |
| Local marketplace | Install and test the complete plugin with Codex | `.build/development/` |
| Public draft ZIP | Inspect the upload package and missing review materials | `dist/remote-device-hub-public-1.3.14-draft.zip` |
| Public submission ZIP | Upload a candidate after required package metadata is complete | `dist/remote-device-hub-public-1.3.14.zip` |

Generated files are not a second source. Edit the canonical directory, then regenerate. The local adapter currently removes only per-server OAuth extension metadata because Codex 0.167 rejects it; Codex discovers OAuth from the Hub instead. The public ZIP retains the explicit OAuth DCR declaration and `devices:control` scope. Authentication is still required in both flows.

## Develop and install locally

Use Node.js 22 or later, Python 3, and a Codex client with `plugin marketplace` and `plugin add` support. Run from this repository:

```sh
npm ci
npm run style:check
npm test
npm run dev:prepare
npm run dev:check
npm run dev:install
npm run dev:status
```

`dev:prepare` generates the `rdh-development` marketplace. `dev:check` asks the actual Codex loader to read it; it does not install, authorize, or call a device. `dev:install` regenerates the source, registers the marketplace, and installs `remote-device-hub@rdh-development` through the official Codex commands. It changes the current user's local Codex installation. It does not publish to a workspace or the public directory.

Open the installed development plugin in the desktop client and complete its Connect flow. The Hub authorization page explains the requested access before sign-in. Continue or cancel, then confirm access for the intended account. Run `npm run dev:verify` to check the installed files, OAuth status, and a real `list_devices` call. Then start a new conversation with this plugin enabled and ask which of your devices are online. Judge success from an actual result, including a legitimate empty list.

Repeat `dev:install` after edits and start a new conversation; restart the desktop client if it retains old files. Check the installed version and source rather than editing the plugin cache. See [installation, OAuth, and tool validation](docs/chatgpt.md) for full steps and cleanup.

## Prepare public submission

```sh
npm run package:draft
npm run package
```

The draft command writes a ZIP, SHA-256 checksum, and report even when review materials are incomplete. The strict command fails on missing required package metadata and refuses to replace a candidate ZIP with different bytes under the same version. Both inspect the resulting archive. Neither command uploads or publishes anything.

A complete package still needs portal connection checks, domain verification, review, and publication. The user has confirmed Easelian business verification; select that verified identity in the portal. See [submission preparation](docs/publication/submission.md).

## Brand and maintenance

Easelian is the publisher and Remote Device Hub is the product. Both outputs use the same solid blue Access mark on a transparent background, exported from the sibling `brand` repository. The mark combines an open device outline with a diagonal connection reaching a central hub. Company artwork is reserved for the company identity. [Brand instructions](assets/branding/remote-device-hub/README.md) describe synchronization.

See [maintenance](docs/maintenance.md) for generated output, existing account-bound development connections, and validation. The repository and plugin are licensed under [Apache-2.0](LICENSE).
