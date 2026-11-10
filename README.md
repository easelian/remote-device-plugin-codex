# Remote Device Hub for ChatGPT and Codex

![Remote Device Hub](plugins/remote-device-hub/assets/icon.png)

Remote Device Hub by Easelian connects ChatGPT and Codex to enrolled Linux, macOS, and Windows devices. The plugin supplies operational skills and a **required registered App dependency**. The App supplies authenticated tools; the Hub and device Agent enforce account and device permissions.

[Website](https://easelian.com/) · [Source](https://github.com/easelian/remote-device-plugin-codex) · [Support](https://easelian.com/contact)

## Installable plugin

`plugins/remote-device-hub/` is the only maintained plugin source, currently version `1.4.0`:

```text
plugins/remote-device-hub/
  plugin.json
  .app.json
  skills/remote-device-operations/
  assets/icon.png
  LICENSE
```

The maintained portable manifest declares `extensions.com.openai.apps: "./.app.json"`. The dependency is required, matching the App dependency pattern used by OpenAI's plugins. The generated local package uses `.codex-plugin/plugin.json`, as OpenAI’s installed plugins do, because the tested Codex 0.167 loader does not discover App references from the portable manifest. It has no `mcp.json`, local server process, direct server URL, or direct-MCP fallback. Local installation describes where the plugin files come from; it does not require a local or directly configured MCP server.

The registered App currently referenced by the source is an individual RDH integration, not a public listing. Check access and authorization for the intended account. Do not distribute an individual App ID as a universally accessible integration. A new RDH account connects through the App's normal authorization flow; it does not need a new App definition.

## Develop and validate

Use Node.js 22 or later, Python 3, and a Codex client supporting plugins and Apps. Run from this repository:

```sh
npm ci
npm run style:check
npm run typecheck
npm test
npm run dev:prepare
npm run dev:check
```

`dev:prepare` generates the local `rdh-development` marketplace and emits the official `.codex-plugin/plugin.json` compatibility layout without changing its App connection. `dev:check` uses the actual Codex loader to check the required App ID and the absence of direct MCP servers. It does not install or authorize the App.

When installation is intended:

```sh
npm run dev:install
npm run dev:status
```

Open Remote Device Hub in the client's plugin manager and complete its **Connect** flow using the intended RDH account. Then run:

```sh
npm run dev:connection
npm run dev:verify
```

`dev:connection` verifies App availability, the committed callable App runtime, and an actual read-only `list_devices` call. `dev:verify` additionally checks the installed plugin version and file hashes. The checks identify tools by the registered App ID, not a similar display name. If multiple eligible connections are exposed, select the intended account in the host or pass its explicit `--connection-id` to the verification command. Missing App access never falls back to a direct server connection.

After installation or updates, use a new chat and confirm the actual returned device list. Reload the desktop client if it retains an old package. [Installation and acceptance](docs/chatgpt.md) explains the evidence and migration boundaries.

## Public directory submission

The current public submission API accepts a remote MCP descriptor, but rejects ZIPs containing registered App references. Therefore submission is an **export step**, not another installation mode:

```sh
npm run package:draft
npm run package
```

The exporter reads the same skills and metadata, removes `.app.json` and its manifest reference, and adds the portal-only descriptor from `integrations/openai/submission-mcp.json`. That descriptor retains OAuth DCR, `devices:control`, and disabled OIDC defaults. It is never copied into the installed plugin. Upload the resulting `dist/remote-device-hub-public-<version>[-draft].zip` through the public submission workflow, not the local marketplace.

The strict command requires complete package metadata and refuses to change an existing candidate under the same version. Neither command uploads, publishes, installs, or changes the App. [Submission preparation](docs/publication/submission.md) covers domain verification, review and public release.

## Architecture and maintenance

The App may communicate with the Hub over MCP. Removing the plugin's direct-MCP mode does not remove the Hub's protocol or change device enrollment, permissions, or Agent deployment. File roots constrain file tools; shell commands execute with the Agent OS user's authority.

See [maintenance and architecture](docs/maintenance.md) for source ownership, official references, App identity and validation. The repository and plugin are licensed under [Apache-2.0](LICENSE). The product icon is maintained through the [brand instructions](assets/branding/remote-device-hub/README.md).
