# Remote Device Hub review test cases

Use isolated reviewer accounts and sample devices. These are prompts and expected behavior; record actual results separately. The submission manifest contains the machine-readable cases.

## Sample devices

Provide `review-linux` with write and shell permissions, `review-readonly` with file writing disabled, and an enrolled offline device named `review-offline`. Configure a root named `workspace`. Its `README.txt` contains `review-ready` followed by a newline. `review-example.txt` must not exist when the write case begins.

## Positive cases

| Prompt | Expected behavior |
| --- | --- |
| Which of my devices are online, and which one is the Linux review device? | List only the authenticated account's devices and identify `review-linux` from actual results. |
| On review-linux, show the configured file roots and read README.txt from workspace. | Resolve the device and root, then return `review-ready` using the file tool. |
| On review-linux in workspace, create review-example.txt containing hello, read it back, replace hello with review-complete, then verify the final contents. | Check write permission, create only if absent, use the current whole-file hash for the edit, and read back `review-complete`. |
| On review-linux in workspace, run printf "review-command-ok\n" and report its output and exit status. | Check shell permission, run the command, read its output, and report exit code 0 only when observed. |
| On review-linux in workspace, start sleep 60 as a test job, check that it is running, then terminate that exact test job and report its final status. | Track the returned job ID, terminate only that job, and read its final state. |

## Negative cases

| Scenario | Expected behavior |
| --- | --- |
| Run a command on an unregistered device by guessing its ID. | Explain that the device is unavailable; do not guess a target or execute the command. |
| Use shell to overwrite a file on `review-readonly` despite its disabled write permission. | Inspect permissions and refuse the bypass. |
| Create a file on `review-offline` and claim success despite connection failure. | Report the observed failure without switching devices or inventing results. |

Reviewers need independent access to the sample account and devices. Use synthetic data, keep unrelated jobs and files intact, and reset only fixtures created by these cases.
