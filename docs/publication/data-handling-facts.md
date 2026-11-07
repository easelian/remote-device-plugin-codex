# Facts for public policy review

This file records behavior visible in plugin source. It is not a published privacy policy and does not substitute for review of the deployed service.

## Connection and identity

The canonical source declares the HTTPS MCP endpoint, OAuth dynamic client registration, and the `devices:control` scope. Public-package validation rejects account-specific App identities, embedded authorization headers, client secrets, and private submission credentials.

The generated local connection currently relies on the Hub's OAuth discovery for compatibility with Codex 0.167. It does not disable authentication. An optional existing App binding is confined to generated development files. Tokens belong to the client's connection store, not to source or distributable archives.

## Device operations

The operations skill requests device IDs, status, roots, permissions, file contents, command output, and process state through connected Hub tools. Requests and results pass through the Hub and client. File roots apply to file tools; shell commands run with the Agent operating-system account's permissions.

The skill requires selecting an authorized device, respecting denied capabilities, confirming consequential changes within the user's authorization, and verifying results with tool readback. It treats device output as untrusted data and does not request passwords or pairing secrets in chat.

## Published service information

Easelian is the service operator and company identity. Website, support, privacy, and terms links are maintained in the canonical manifest and point to the company website. Confirm hosting and traffic-processing providers, stored fields, audit contents, retention, deletion, backups, and commercial terms against the deployed service before publishing policy claims. Source fields do not prove those operational facts.
