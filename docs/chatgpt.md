# ChatGPT integration and private web testing

The current entry point is the [Remote Device Hub App](https://chatgpt.com/plugins/plugin_asdk_app_6ac9b1c6f14c8191a89b4858d1c265a3), without a Skill. It is the only installed Remote Device Hub entry in settings and reuses the existing OAuth account. Its permission setting is **Allow read-only tools**: reads do not require confirmation; changes do. Select **Try in chat** to start a new conversation. Public publication remains on hold.

## Connection and versions

App ID `asdk_app_6ac9b1c6f14c8191a89b4858d1c265a3` connects to `https://mcp.xdistribute.site/mcp`. The development App details page shows `1.0.0`; the deployed server is still Hub 0.8.0. These versions are independent. The App page version does not identify the Hub code version. The Hub uses SDK 2.3.0 to support MCP `2026-07-28` while retaining stateless transport, OAuth, and device access checks.

Following the decision to remove the Skill first, the additional private package `plugins_6ac993be7294819188f638f4e00f2b5d` was uninstalled and updated to **1.2.3**. The update removed `remote-device-operations/SKILL.md` and three reference files while preserving the original `.app.json` connection, identity, assets, and private visibility. It did not switch to the direct MCP connection proposed in the preceding candidate. This uninstalled package is no longer the daily web entry point.

**Having one installed entry does not mean all historical Personal directory records were deleted.** Personal / Created by you still shows the uninstalled 1.2.3 private package and the older `Plugin_c037faee8bac8191af422bb13e5ae020` (1.1.1). The observed management menu offered edit, download, and version upload, but no option to delete the cloud package record. Successful uninstallation must not be described as cloud-record deletion.

See [`channels.json`](../integrations/chatgpt/channels.json) for entry-point state. The removal and web validation are recorded in [Web acceptance without the Skill](../releases/evidence/plugin-without-skill-20261010.json). The preceding [single-entry attempt with the complete Skill](../releases/evidence/plugin-single-entry-20261010.json) is retained as history. Its direct MCP candidate and recovery package were not uploaded; the later decision superseded the pending proposal.

## Permissions and operation confirmation

Removing the Skill stops loading its device-selection, file-change, and process-management instructions. The Hub and Agent still enforce device ownership, roots, `allow_write`, `allow_shell`, parameter bounds, and hash conflicts. The App continues to expose file, command, and process tools. Available operations depend on device configuration and OAuth permissions. Shell commands use the Agent operating-system account permissions; file roots do not provide a shell sandbox.

The ChatGPT App setting **Allow read-only tools** is independent of the Skill. During this validation, the App displayed a native Write File approval card with **Allow once / Deny**. The server subsequently recorded one successful write, and readback matched the content and hash. Tool approval does not replace server permission checks. Selecting **Allow all tools** changes native prompting behavior. The removed Skill conversation flow must not be treated as an enforced approval mechanism.

## Optional integration source and builds

`plugins/remote-device-hub/` retains the optional 1.2.2 Skill source for possible restoration or other clients. It is not a runtime dependency of the current web App. `public/remote-device-hub/` remains a separate, unsubmitted public draft. Do not upload either Skill-bearing source directory as the current web entry point unless the user requests Skill restoration.

```bash
npm ci
npm test
npm run release -- build plugin --profile standalone
```

The builder collects only allowlisted files and records the ZIP hash. Building does not install a plugin, change the web App, deploy the Hub, or publish publicly. `standalone` uses remote MCP and OAuth DCR without a private App ID. `connected` references the existing App through [`connected-app.json`](../integrations/chatgpt/connected-app.json). Neither build substitutes for target-client acceptance. Historical version inputs and artifacts are immutable. See [Public-submission materials](publication/submission-1.2.0.md).

## Acceptance records

Distinguish package save/readback, web-client Skill loading, actual MCP calls, and Agent side-effect inspection. Health checks, OAuth success, and local tests do not establish web acceptance. A network error does not prove that an operation did not execute.

### Private App without the Skill

- [Cloud readback](../releases/evidence/plugin-without-skill-1.2.3-readback.json): the 1.2.3 private package contains no Skill files, preserves the original App binding, and is uninstalled.
- [Web and independent audit](../releases/evidence/plugin-without-skill-20261010.json): reads through the App entry point, observation of a native write approval card, inspection of one write and readback, and another read in a new conversation after Skill removal.

The first ordinary read in the new conversation returned an internal error. Proxy logs in the same window contained one HTTP 408 with upstream `-`. A subsequent explicit new read succeeded with matching content and hash. Timing correlation is not request-level attribution and does not establish a fully stable connection. An out-of-root read returned `agent_error` without leaking the marker file, but the error did not expose the specific rejection reason.

The native approval card disappeared before automation opened its details. The audit then showed exactly one successful write. Automation did not click approval, and the approver identity was not observed. File state collected afterward is not proof of the state while approval was pending. The dedicated device recorded three successful `device_info` calls, three successful `read_file` calls, one successful `write_file`, and one failed read. The temporary device was revoked; the Agent, synthetic files, and credentials were cleaned up. Audit records remain.

### Version 1.2.2 with Hub 0.8.0

- [Private-package cloud readback](../releases/evidence/plugin-private-1.2.2-readback.json): the package ID remained unchanged, the deleted App binding was restored, and installation was confirmed.
- [Updated web acceptance](../releases/evidence/plugin-private-1.2.2-hub-0.8.0-web-tests.json): conversation, native approval arguments, file checks before and after approval, audit, and cleanup.
- [Earlier 0.7.1 web record](../releases/evidence/plugin-private-1.2.2-web-tests.json): functional operations passed, but a protocol-version issue still caused HTTP 400 responses.
- [1.2.2 release record](../releases/plugin-connected-1.2.2.json): private upload, readback, and acceptance evidence.

The updated validation used dedicated device `rdh-web-080-20261010` and synthetic files. Reads succeeded without supplying `length`. With writes and shell disabled, bypass attempts were refused. Preview-only authorization did not modify the file. After conversational confirmation, writing still waited for native approval. The target, content, and SHA-256 were checked before selecting **Allow once**. Server audit confirmed exactly one write; readback matched content and hash.

Three subsequent read-only calls succeeded without additional retries. The approximately 330-second window contained 57 proxy HTTP 200 responses and one HTTP 401 that was not individually attributed, with no HTTP 400 or 5xx responses. The temporary device was revoked; the Agent, synthetic files, and credentials were cleaned up. The dedicated web-test tab was retained. This limited window does not establish long-term network availability.

The complete local server suite passed 539 tests, with one platform-specific skip. It covered old and new MCP protocols, cross-user denial, token revocation, roots, and read-length bounds. Web acceptance used one account and does not replace all public-release cases.

### Historical 1.2.0 records

- [1.2.0 cloud-package readback](../releases/evidence/plugin-private-1.2.0-readback.json): version, private visibility, App binding, and Skill content.
- [1.2.0 web permission and confirmation tests](../releases/evidence/plugin-private-1.2.0-web-tests.json): actual conversation, independent file inspection, audit records, and temporary-device cleanup.
- [Local regression tests](../releases/evidence/plugin-private-1.2.0-tests.json): 20 integration tests passed; 534 server tests passed with one platform-specific skip.
- [Earlier web connection test](../releases/evidence/plugin-web-connection-20261010.json): the automatically generated App package returned an internal error on the first attempt and succeeded on a second read-only query.
- [1.2.0 release record](../releases/plugin-connected-1.2.0.json): acceptance evidence and check status.

Private web acceptance on 2026-10-10 used dedicated device `rdh-web-ro-20261010`:

| Scenario | Observed result |
| --- | --- |
| File writes and shell disabled | After reading the Skill and checking capabilities, the web client refused file changes, commands, and shell bypasses. Direct Codex calls to write and process tools also returned `agent_error`. |
| Writes enabled, preview authorized only | The web client read the synthetic file, showed the actual diff, and waited for confirmation. Independent inspection found an unchanged hash and zero successful mutations. |
| Explicit replacement confirmation | The web client used the observed SHA-256 to write `confirmed-web-test` followed by one LF and read it back. Independent file inspection and audit confirmed exactly one successful write and no successfully started process. |
| Cleanup | The temporary device was revoked, the Agent stopped, and synthetic files and credentials deleted. Audit records and the dedicated web-test tab were retained. |

The preview first encountered an MCP connection failure. A subsequent read was rejected because the assistant supplied `length=1048576`. Reading succeeded only after explicitly setting `offset=0, length=128`; this pass therefore included manual parameter correction. `read_file` allows files up to 1 MiB, but each read has a maximum `length` of 65536 bytes and defaults to 32768. Omit `length` for small files; read larger files in chunks. The 1.2.0 package was not modified again for this test.

No native approval card was observed during that 1.2.0 acceptance run; it verified conversational preview and explicit confirmation. A separate out-of-root read timed out without a matching audit record and remains unverified. Cross-user isolation and the full public-submission suite were not tested, so these results do not establish public-release readiness.

Tests used only dedicated devices and synthetic files. Temporary devices were revoked and Agents stopped afterward. Connection failures, timeouts, and uncovered cases must remain in evidence. A single pass does not establish stability or compatibility with all clients.

Historical 1.1.1 update and icon-validation limits remain in `releases/plugin-connected-1.1.1.json` and `releases/evidence/plugin-*-1.1.1-20261001.json`. They describe the state at that time, not the current entry point.
