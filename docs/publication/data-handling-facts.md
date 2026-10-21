# Remote Device Hub privacy-policy facts (unpublished)

This document supports preparation of an actual privacy policy. It is not an effective public policy and does not establish the operator's legal identity or commitments. Before publication, supply the operator, public contact details, service regions, and confirmed retention and deletion policies.

## Implementation and deployment facts before the repository split

These facts were imported from migration baseline `73fc37b`. Verify Server behavior against the target release. Recheck deployment details such as Cloudflare, Nginx, and retention periods in the actual environment. They are not live-validation results from this repository split.

- Google sign-in receives and validates identity claims. Account records include the identity provider, subject, email, and internal user ID.
- Device pairing stores the device ID, name, owning user, and a hash of the Agent credential. Users can operate only their own devices.
- Execution requests, file contents, and command results pass through the Hub and are returned to ChatGPT through tool calls.
- Cloudflare terminates HTTPS at the edge and connects to the origin over certificate-verified HTTPS. Both Cloudflare and the Hub can therefore process plaintext requests. Do not advertise end-to-end encryption between a user device and ChatGPT.
- Commands run with the Agent operating-system user permissions. File tools are restricted to named roots; those roots do not provide a shell sandbox.
- Central audit records identify the user, client, device, operation type, timestamp, and outcome. At this historical baseline, retention covered approximately the most recent 10001 records across the site, with no automatic deletion-by-age commitment. Request bodies and command results were not stored as audit-table columns.
- Expiring session and authorization records are managed by the state store. Expired records are cleaned during later writes, which is not a guarantee of scheduled physical erasure.
- Users can revoke devices or grants through account and device management. The operator must separately define and implement full account-data deletion and backup-deletion timelines.
- At this baseline, Nginx security access logs included time, source address, HTTP method, path, and status, excluding query strings, cookies, and tokens. A public policy must describe server-log and backup retention according to actual operational configuration.

## Claims that must not be invented before publication

Do not supply a nonexistent support email, claim public review approval, state that data never passes through third parties, or promise an automatic deletion period that has not been implemented. Website, support, privacy, and terms links must be publicly accessible and consistent with the verified publisher identity.
