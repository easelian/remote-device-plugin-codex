# Remote Device Hub 1.2.0 public-submission preparation

This directory prepares a public plugin ZIP for OpenAI Platform. The current deliverable is a draft: publisher identity, an actual demo recording, and web-client acceptance are incomplete. It is not ready for review submission. Building does not create a private plugin, upload a draft, or deploy the Hub.

## Scope

The user approved Linux/macOS device status, file reads and writes, command execution, and process management, with improved permission checks and operation confirmation. The intended audience covers all countries and regions allowed by the platform. The business model includes a free allowance and paid subscriptions.

Source was copied from the macOS `remote-device-integrations` repository at baseline `1e4fed768d5aeced9aa66cdebb047b89b90e9acf`. Public source is under `public/remote-device-hub/`, retaining the `remote-device-hub` package name, existing light/dark icons, and version `1.2.0`. The user subsequently requested private web acceptance first: `plugins/remote-device-hub/` was synchronized to `1.2.0`, and the connected profile reused the App authorized on 2026-10-10. The public directory remained an independent draft without a private App binding.

## Added materials and actual limits

- `plugin.json`: English listing copy, a translation entry, four product links, all-region configuration, release notes, and five positive plus three negative review cases.
- `mcp.json`: the existing public Streamable HTTP MCP URL, OAuth DCR, and the actual `devices:control` scope.
- `skills/remote-device-operations/`: device selection, capability and permission checks, target verification before changes, current file hashes, command lifecycles, and recovery from unknown outcomes.
- A standalone builder that rejects private App bindings, credential fields, fixed authentication headers, unexpected files, and symbolic links, then reads back the ZIP and records its SHA-256. Incomplete materials produce only files with a `-draft` suffix.

The Hub and Agent already enforce account ownership, device revocation, file roots, `allow_write` / `allow_shell`, and SHA-256 conflict protection. This Skill improves assistant workflows. MCP annotations declare dangerous-tool side effects to the host; they do not add a server-enforced per-operation approval credential. Prompts also depend on host permission settings and existing user authorization. Shell commands still use the Agent operating-system user permissions, and file roots do not constrain shell access.

Local changes in sibling `remote-device-server/` adjusted MCP instructions, `get_billing_status`, and allowance errors to return current entitlements and balances without transaction links or upgrade prompts. The standalone website retained its billing entry points and rules. At the time of this preparation, those changes were not deployed. The ZIP does not contain server Python code.

## Public pages and billing disclosures

On 2026-10-10, curl from the development machine retrieved and inspected the following Remote Device Hub pages. All returned HTTP 200:

| Purpose | Verified URL |
| --- | --- |
| Website | https://mcp.xdistribute.site/ |
| Support form | https://mcp.xdistribute.site/contact |
| Privacy policy | https://mcp.xdistribute.site/privacy |
| Terms of service | https://mcp.xdistribute.site/terms |

The operator was still identified as the Remote Device Hub individual developer and must match the final verified individual or company name. This check verified page accessibility and content only. It did not submit another support ticket or verify legal identity.

The website explicitly stated that testing was free and purchases were unavailable. Submission copy retains that distinction. The approved free allowance and paid subscriptions describe the business model, not enabled purchasing. `review.commerce=false` means the plugin itself does not transact; `commerce_description` also discloses the external service subscription model. It does not mean the entire service is permanently free.

Under the public rules cited by this preparation, the plugin may use existing subscription entitlements but must not promote upgrades, present purchase flows, or provide direct checkout links. If allowance is insufficient, explain current entitlements without switching tools or accounts to bypass limits.

On macOS, curl retrieved OAuth metadata with HTTP 200; discovery, DCR, PKCE S256, and scope matched configuration. Python urllib with its default client received Cloudflare 1010 from the same URL. Some macOS web requests also timed out. Successful requests from the development machine do not establish accessibility for every review client. Actual Portal connections and scans still require validation before formal review.

## Build and local validation

Run from this repository root:

```bash
npm ci
npm test
npm run submission -- --allow-incomplete
```

Outputs under `dist/` include the plugin ZIP, `.zip.sha256`, and `.report.json`. `missing_materials` lists materials not yet included in the ZIP. After supplying them, rebuild without `--allow-incomplete`; missing items then cause failure. `submission_ready` remains `false` because local scripts cannot replace identity verification, demo playback, web-client tests, Portal scans, or final declarations.

Server acceptance records are in the sibling project:

- `remote-device-server/releases/evidence/plugin-public-1.2.0-server-tests.txt`
- `remote-device-server/releases/evidence/plugin-public-1.2.0-contract-tests.txt`

Those tests use an isolated local OAuth → HTTP MCP → Hub → Agent chain. They are neither ChatGPT web acceptance nor a review recording.

## Demo environment and recording

Create a dedicated review account and an isolated, low-privilege Linux Agent without real user data. Use the existing Agent installation and pairing flow to provide:

- `review-linux`: online, with root `workspace`, writes and shell enabled. `README.txt` contains `review-ready` followed by a newline; `review-example.txt` does not exist.
- `review-readonly`: online, with `allow_write=false` and synthetic files only. Use it to verify that the assistant does not bypass disabled writes through shell commands.
- `review-offline`: paired but offline, to verify that the assistant neither fabricates execution results nor switches to another device.

Reviewers should not have to register, install, or configure devices. Put credentials only in the Portal review-access fields, never in the ZIP, documentation, or public listing. Record the login URL, necessary steps, and actual available permissions. Confirm that reviewers can sign in and complete cases from the public internet.

In a working ChatGPT web development connection, demonstrate the five positive cases in `plugin.json`: list devices, read the example file, create and update an example file, run a command with fixed output, and inspect and terminate a test process created by the demonstration. Then demonstrate the three negative cases, showing actual permission or availability limits without unauthorized side effects. Reset only this isolated data before recording again.

Rehearse first to resolve sign-in failures and unavailable tools. The Computer plugin can help operate the visible page, but screen-control capability does not establish recording capability; confirm recording tools first. Alternatively, a maintainer can start the system recorder and follow the prompts. Requests, real tool results, and versions must be legible. Avoid recording credentials or unrelated pages.

Replay the entire saved recording to inspect every flow, audio/video quality, and sensitive information. Host it at a URL reviewers can watch directly, then set `extensions.com.openai.review.demo_recording_url` to that actual URL. Scripts, screenshots, and local logs do not replace a recording. All eight review cases currently remain **Not run in ChatGPT**.

## Remaining work

1. Supply the actual individual or company name and complete Platform identity verification. Set `author.name` and `interface.developerName` accordingly and synchronize operator details on policy pages.
2. Deploy validated server changes, restore a working development connection, and complete the web cases with the isolated account.
3. Record and verify the demo, supply its actual URL, and rebuild the ZIP.
4. Prepare dedicated review access and verify both free-allowance and existing-subscription states.
5. When upload is explicitly requested, select the correct organization and project, upload the ZIP, and complete domain verification, OAuth, tool scanning, and material checks. The publisher must complete the actual declarations.

The public ZIP excludes old `apps` / `.app.json` bindings. Preserve any official binding generated by Portal after MCP conversion. Draft upload, review submission, approval, and publication are distinct states. Record only states actually reached.

Remote shell and user-device file access may require product-specific review. Explain authorization scope and isolation to OpenAI. Existing OAuth declares only `devices:control` and does not provide OIDC UserInfo for enterprise domain restrictions. Ordinary OAuth success does not establish support for that enterprise policy.

## Official references

- [Submission and publication](https://developers.openai.com/plugins/deploy/submission)
- [Package layout and MCP authentication](https://developers.openai.com/plugins/build/plugins)
- [Commerce and subscription rules](https://developers.openai.com/plugins/plugin-guidelines#commerce-and-monetization)
- [OAuth and enterprise domain restrictions](https://developers.openai.com/plugins/build/auth#support-workspace-domain-restrictions)
- [Review requirements for local execution and file access](https://developers.openai.com/plugins/guides/submit-claude-plugin#complete-the-submission-requirements)
