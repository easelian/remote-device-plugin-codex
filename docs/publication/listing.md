# Remote Device Hub listing materials

The approved release scope covered the service, Agent, public downloads, and npm. The integration ZIP was distributed as a download; ChatGPT public-store submission was outside that scope. Each channel's publication result and validation evidence are recorded separately in the [2026-10-01 release validation record](../../../remote-device-server/docs/release-validation-20261001.md).

## Product details

- English name: Remote Device Hub
- Chinese name: 远程设备中心
- Summary: Connect your Linux and macOS devices. Run commands, manage files, and monitor processes.
- Chinese summary: 连接你的 Linux 和 macOS 设备，运行命令、管理文件与进程。
- Category: Productivity
- MCP URL: `https://mcp.xdistribute.site/mcp`
- Authentication: OAuth, PKCE S256, `devices:control`
- Supported platforms: Linux and macOS

Remote Device Hub connects ChatGPT or another MCP client to Linux and macOS computers that a user enrolls and authorizes. It can list devices, inspect directories, run terminal commands, read and edit files, and manage Agent processes. Commands run with the selected device Agent account. Shell commands are not sandboxed by the file root configuration; production deployments should use a dedicated account and operating-system isolation.

## Component release lines

These materials describe the independent standalone plugin `1.1.1` release line. Server, Protocol, and Agent artifacts are built by their own repositories. This repository produces only a plugin ZIP without an App binding or an explicitly selected connected-profile ZIP.

Current records and download-readback evidence under `releases/` establish whether an integration package reached the public download directory. A published download does not imply upload or submission to the ChatGPT store, nor replace client acceptance of icons and plugin pages.

## Plugin profiles

The standalone plugin declares its real HTTPS Streamable HTTP MCP URL in `plugins/remote-device-hub/mcp.json` and does not declare an App ID. Run `npm ci` and `npm run build` from the repository root, then build:

```bash
npm run release -- build plugin \
  --profile standalone
```

Use the connected profile only when explicitly reusing an existing ChatGPT/App connection. It reads the existing App identity from `integrations/chatgpt/connected-app.json`:

```bash
npm run release -- build plugin \
  --profile connected
```

App configuration is an optional adapter, not a dependency of the canonical plugin, Hub, or Agent. Builds create artifacts and prepared records only. They do not create or upload a private plugin, replace the daily entry point, or deploy the MCP service.

## Review materials

Before a future submission, maintainers must supply:

- A verified publisher identity, support email, and product homepage.
- Publicly accessible privacy policy and terms of service.
- A demo account and device isolated from production.
- Domain verification, scan results, and final identity from the actual submission system.
- Artifact, version, checksum, build inputs, and client/device validation evidence for each step.

Submission for review is distinct from public publication. Even after approval, the publisher must explicitly publish on the target platform. Record building, uploading, deployment, and runtime validation separately.

## Private-plugin experiment limits

An earlier App-linked private-plugin update did not pass stable icon-persistence and page-readback acceptance. Its result metadata remains under `docs/history/release-records/`. After the service and download release, the user explicitly authorized updating the original private plugin. Connected `1.1.1` was saved under the same plugin ID; cloud files and version were read back, and the original App binding was preserved. See the [current integration and historical records](../chatgpt.md). Public-store submission has not been performed. Historical icon failures and old upload records do not identify the current cloud version. Record host UI icons and conversation reload behavior separately.

Official references:

- <https://developers.openai.com/plugins/deploy/submission>
- <https://developers.openai.com/plugins/build/plugins>
- <https://developers.openai.com/apps-sdk/>
