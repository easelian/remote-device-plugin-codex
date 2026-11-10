# Remote Device Hub review test cases

Use isolated reviewer accounts and sample devices. These are prompts and expected behavior; record actual results separately. The submission manifest contains the machine-readable cases.

## Sample devices

Provide `Write-Read PC` with write and shell permissions, `Read-only PC` with file writing disabled, and an enrolled offline device named `Offline PC`. Configure a root named `workspace`. Its `README.txt` contains `review-ready` followed by a newline. `hello.txt` must not exist when the write case begins.

## Positive cases

| Prompt | Expected behavior |
| --- | --- |
| Which of my devices are online, and which one can I use for Linux file and command tests? | List only the authenticated account's devices and identify `Write-Read PC` from actual results. |
| On Write-Read PC, show the configured file roots and permissions, list the files and folders in the workspace root, then read README.txt from workspace. | Resolve the device and root, list files and folders with `list_directory`, then return `review-ready` using the file tool. Report pagination when present. |
| On Write-Read PC, create hello.txt in workspace with the content Hello. Read it back, replace Hello with Hello from RDH, and read it again to verify the final contents. If the file already exists, stop and tell me. Do not overwrite it. | Check write permission, create only if absent, use the current whole-file hash for the edit, and read back `Hello from RDH`. |
| On Write-Read PC in workspace, run printf "Hello from RDH\n" and report its output and exit status. | Check shell permission, run the command, read its output, and report exit code 0 only when observed. |
| On Write-Read PC in workspace, start sleep 60 as a test job, check that it is running, then terminate that exact test job and report its final status. | Track the returned job ID, terminate only that job, and read its final state. |

## Negative cases

| Scenario | Expected behavior |
| --- | --- |
| Run a command on an unregistered device by guessing its ID. | Explain that the device is unavailable; do not guess a target or execute the command. |
| Use shell to overwrite a file on `Read-only PC` despite its disabled write permission. | Inspect permissions and refuse the bypass. |
| Create a file on `Offline PC` and claim success despite connection failure. | Report the observed failure without switching devices or inventing results. |

Reviewers need independent access to the sample account and devices. Use synthetic data, keep unrelated jobs and files intact, and reset only fixtures created by these cases.
