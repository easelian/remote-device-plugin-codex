# Remote Device Hub listing materials

Maintain listing metadata in `plugins/remote-device-hub/plugin.json`. The same source supplies local development and public submission; do not edit generated copies.

## Product details

- Product: Remote Device Hub.
- Publisher: EaseLian.
- Website: https://easelian.com/.
- Support: https://easelian.com/contact.
- Privacy: https://easelian.com/privacy.
- Terms: https://easelian.com/terms.
- Category: Developer Tools.
- MCP URL: `https://rdh.easelian.com/mcp`, declared in the canonical `mcp.json`.
- Authentication: OAuth with dynamic client registration and `devices:control` scope. Set `oidcEnabled: false` and `defaultScopes: []` so website OIDC discovery does not add `openid email` to MCP authorization.
- License: Apache-2.0, included as `LICENSE`.
- Artwork: the shared 256 × 256 transparent gray-and-blue Remote Device Hub product icon. Company logos identify EaseLian separately.

Each user enrolls and authorizes their own devices. Commands run with the selected Agent operating-system account. File tools use configured roots; those roots do not constrain shell execution. The plugin reports service entitlement and does not initiate purchases or promote upgrades. Keep advertised capabilities aligned with the deployed service and verified client workflows.

## Build and review

Run `npm ci`, then `npm run package:draft` to inspect the ZIP and missing-materials report. Use `npm run package` when package metadata is complete. Generated ZIPs contain the canonical OAuth declaration and exclude account-specific App bindings, local marketplace catalogs, development reports, and credentials.

Follow [submission preparation](submission.md) to prepare reviewer access, real test results, an accessible video, domain verification, and portal checks. Do not count a populated field or a successful local build as proof of those external steps.
