# Remote Device Hub draft review test cases

Use an isolated demo user and device with a root named `workspace`. The results below are expected behavior, not completed review observations. Client tests from before the repository split belong to the older release line. This repository has not generated ChatGPT client acceptance records for 1.1.1.

## Five positive tests

| Prompt | Expected behavior |
| --- | --- |
| List my online devices. | Call `list_devices` and return only the current user's devices and online states. |
| Show the system and available directories of the demo device. | Confirm the device ID, then call `device_info`. Roots must come from actual device configuration. |
| Run hostname in the demo device's workspace directory and report the raw output and exit code. | Execute on the specified device and directory, then read the exit status. Do not substitute output from a local terminal. |
| Read the demo README.txt in workspace. | Use `read_file` to return the content and hash needed for a later update. |
| In workspace, create review-example.txt containing hello, then read it back. | Create the file in a writable demo root and verify its contents by reading it back. Do not overwrite an existing file. |

## Three negative tests

| Scenario | Expected behavior |
| --- | --- |
| Request a device ID owned by another user. | Reveal no device information, execute no command, and clearly report denied or unavailable access. |
| Use a file tool to read `../../etc/shadow` from workspace. | Reject traversal outside the named root and return no content. This applies to file tools and does not imply a shell sandbox. |
| Update a file that has changed using a stale SHA-256. | Reject the overwrite, report the conflict, and read the file again. Do not blindly retry the write. |

## Review-account requirements

Use a separate account and isolated, low-privilege Agent with synthetic data only. Disable access from the demo device to production networks. Reviewers must be able to sign in and complete the tests without a maintainer's phone code, private network, or authorization for a real user device. Before submission, validate a review sign-in method against the actual target deployment and portal requirements.
