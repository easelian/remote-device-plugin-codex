# Plugin architecture and maintenance

## Source ownership

The canonical installable plugin is `plugins/remote-device-hub/`. Maintain its skills, listing metadata, assets and required App reference there. The Server and Agent repositories own tool behavior, OAuth enforcement, device connections and local permissions.

The package uses a portable `plugin.json` with the OpenAI `apps` extension and root `.app.json`. It declares one registered integration with `required: true`; the App supplies authenticated tools.

| Source | Purpose |
| --- | --- |
| `plugins/remote-device-hub/plugin.json` | Product identity, version, skills metadata and App reference |
| `plugins/remote-device-hub/.app.json` | Required RDH App identity; no credentials |
| `integrations/openai/submission-mcp.json` | Public portal transport/auth declaration only |
| `scripts/plugin_source.ts` | Shared content and file validation |
| `scripts/app_contract.ts` | Required App contract; rejects direct-MCP packages |
| `scripts/prepare_development.ts` | Generates a local marketplace from the App package |
| `scripts/prepare_submission.ts` | Projects that source into the portal's accepted upload format |
| `scripts/check_codex_plugin.py` | Loader, App-runtime and installed-package checks |

Local installation uses the required App reference. The development package and public submission export are generated from the same canonical source.

## Registered App identity

The source references the individual Remote Device Hub development App `asdk_app_6aef14393cd881919ab337bd3a080302`; keep `required: true` and package version `1.4.0`. The public submission App `asdk_app_6aee938018808191a76a3ea4d0dc579f` is separate and must not be changed here.

Metadata availability does not prove an authorized tool connection. The registered integration remains individual in scope. Confirm eligibility before using it from another OpenAI account. Public rollout must use the platform's approved integration identity; never distribute the publisher's OAuth credentials or infer that an individual ID is public. When replacing the integration after approval, update the one `.app.json` declaration and repeat loader, account and device tests.

### Reproducible development connection

For the local `1.4.0` development App, configure OAuth dynamic client registration (DCR) against the `auth.easelian.com` authorization domain for the MCP resource `https://rdh.easelian.com/mcp`. Disable website OIDC discovery (`oidcEnabled: false`), set `defaultScopes` to `["devices:control"]`, and leave `baseScopes` empty (`[]`). Automatic OIDC discovery adds `openid` and `email`, which the Hub rejects as `invalid_scope`; do not include those scopes. Complete login through the host's normal OAuth flow after saving this configuration.

## Build and checks

```sh
npm ci
npm run style:check
npm run typecheck
npm test
npm run dev:prepare
npm run dev:check
npm run package:draft
```

Tests enforce required App wiring, reject accidental direct-MCP files and credential fields, preserve source data during submission export, and verify archive integrity and immutable candidates. Runtime verification rejects another App's identically named tool, unavailable or disabled connections, ambiguous account selection, and non-read-only probes.

`dev:prepare` replaces only its marked `.build/development/` output. Generation converts only the root manifest into `.codex-plugin/plugin.json`; App bindings, skills, assets and licensing retain their bytes. The generated package deliberately omits root `plugin.json`, which masks App discovery in the tested Codex 0.167 loader. `dev:install` invokes the supported Codex marketplace/install commands; it does not modify another plugin, revoke OAuth grants or publish anything. Do not edit installed caches.

`dev:check` proves loader discovery only. `dev:connection` uses `app/read`, `app/installed` and the hosted App tool catalog. The probe requires an exact `connector_id` match and calls only `list_devices`. `dev:verify` also checks enabled installation, version and hashes. These CLI checks do not prove that an existing desktop chat has refreshed; perform a native call in the intended chat separately.

## Public submission export

Public portal uploads currently reject `.app.json` and `apps` references. The exporter removes only that wiring and inserts `integrations/openai/submission-mcp.json` into the upload copy. Metadata, prompts, skills, icons and licensing come from the canonical package. Both output validation and archive readback must pass. This export is never a `dev:install` input.

Preserve platform-generated bindings in the finalized hosted release. A local source change does not modify that release. Strict exports require complete package metadata; draft reports retain missing materials and never claim public-review readiness.

## Official references

- [Package structure and registered App references](https://developers.openai.com/plugins/build/plugins)
- [Public submission and the App-reference restriction](https://developers.openai.com/plugins/deploy/submission)
- [MCP reference validation errors](https://developers.openai.com/plugins/deploy/submission-errors)
- [Multiple account connections and profile metadata](https://developers.openai.com/plugins/build/auth#support-multiple-accounts)

An App reference does not implement account selection or a profile tool. Those features belong to the host and authenticated server respectively and must be tested in the target client.
