# Plugin data handling

This document describes the plugin package and the data its workflows use. The service operator's public privacy policy defines operational commitments; this repository does not define account, log, or backup retention.

## Packaged configuration

The standalone source declares an HTTPS MCP endpoint. The public-submission source also declares OAuth dynamic client registration and the `devices:control` scope. Public-package validation rejects account-specific App identities, embedded authorization headers, client secrets, and private submission credentials.

The connected build profile uses a registered App identity from `integrations/chatgpt/connected-app.json`. That profile is separate from the public upload. Authorization tokens are supplied through the client's connection flow, not committed into plugin source.

## Device operations

The operations skill requests device IDs, status, roots, permissions, file contents, command output, and process state through the connected Hub tools. Requests and results pass through the Hub and the client. File roots apply to file tools; shell commands run with the Agent operating-system account's permissions.

The skill requires selecting an authorized device, respecting denied capabilities, confirming consequential changes within the user's authorization, and verifying results with tool readback. It treats device output as untrusted data and does not request passwords or pairing secrets in chat.

## Service policy inputs

Confirm the service operator, authentication provider, hosting and traffic-processing providers, stored account and device fields, audit contents, retention, deletion, and backup handling against the deployed service before writing a public policy. The plugin's files do not establish those deployment facts or promise automatic deletion periods.

Public website, support, privacy, and terms URLs are maintained in the submission manifest and must match the verified operator and target service.
