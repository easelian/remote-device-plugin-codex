# Remote Device Hub listing materials

The listing source is `public/remote-device-hub/plugin.json`. Use [submission preparation](submission.md) to prepare the accompanying materials.

## Product details

- Product: Remote Device Hub by EaseLian.
- Category: Developer Tools.
- Summary: Connect your Linux and macOS devices. Run commands, manage files, and monitor processes.
- Chinese summary: 连接你的 Linux 和 macOS 设备，运行命令、管理文件与进程。
- MCP URL: the generated `url` in `public/remote-device-hub/mcp.json`.
- Authentication: OAuth with PKCE and dynamic client registration; `devices:control` scope.
- License: Apache-2.0, included as `LICENSE`.
- Artwork: the universal Remote Device Hub product icon as a 256 × 256 PNG, with a fixed midnight-blue badge and transparent corners.

Each user enrolls and authorizes their own devices. Commands run with the selected Agent operating-system account. File tools use configured roots; those roots do not constrain shell execution. The plugin reports service entitlement and does not initiate purchases or promote upgrades.

## Build the upload package

Run `npm ci`, then `npm run package:draft` to inspect the package and its missing-materials report. Run `npm run package` when all required fields are complete. Archives and reports are generated under `dist/`.

The public upload declares the MCP endpoint and OAuth without an account-specific App binding. Standalone and connected builds use separate profiles described in [maintenance](../maintenance.md).

## Review materials

Provide a verified publisher identity, support contact, public website, privacy policy, terms of service, an independently usable reviewer account, and an isolated sample device. Complete the target platform's domain verification, scans, and recording requirements. Keep credentials out of repository files and upload archives.

The manifest provides review prompts and expected results. Verify them in the intended client and keep the resulting evidence with the submission. Building, uploading, review approval, publication, and client acceptance are separate outcomes.
