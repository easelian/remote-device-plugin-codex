# Remote Device Hub listing materials

Use [review preparation](submission.md) for the current submission checklist and [CHANGELOG.md](../../CHANGELOG.md) for version changes.

## Product details

- English name: Remote Device Hub
- Chinese name: 远程设备中心
- Summary: Connect your Linux and macOS devices. Run commands, manage files, and monitor processes.
- Chinese summary: 连接你的 Linux 和 macOS 设备，运行命令、管理文件与进程。
- Category: Productivity
- MCP URL: the generated `url` in `public/remote-device-hub/mcp.json`
- Authentication: OAuth, PKCE S256, `devices:control`
- Supported platforms: Linux and macOS

Remote Device Hub connects ChatGPT or another MCP client to Linux and macOS computers that a user enrolls and authorizes. It can list devices, inspect directories, run terminal commands, read and edit files, and manage Agent processes. Commands run with the selected device Agent account. Shell commands are not sandboxed by the file root configuration; production deployments should use a dedicated account and operating-system isolation.

## Build the upload package

The public source is `public/remote-device-hub/`. From the repository root, run `npm ci`, then `npm run package:draft` while required materials are incomplete. Run `npm run package` once they are complete. The package and readiness report are generated under `dist/` and can be removed after use.

Compatibility builds use `npm run release -- build plugin --profile standalone` or the explicitly selected `connected` profile after `npm run build`. Their integrity manifests are temporary output under `.build/release/`. These commands do not upload a plugin or deploy the MCP service.

## Review materials

Before a future submission, maintainers must supply:

- A verified publisher identity, support email, and product homepage.
- Publicly accessible privacy policy and terms of service.
- A demo account and device isolated from production.
- Domain verification, scan results, and final identity from the actual submission system.
- The package to upload and the required client/device checks; keep generated reports outside version control.

Submission for review is distinct from public publication. Even after approval, the publisher must explicitly publish on the target platform. Record building, uploading, deployment, and runtime validation separately.

Official references:

- <https://developers.openai.com/plugins/deploy/submission>
- <https://developers.openai.com/plugins/build/plugins>
- <https://developers.openai.com/apps-sdk/>
