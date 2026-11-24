# RCA method selection

Pick the lightest method that fits. Default to 5 Whys.

## 5 Whys (default)

Start with the symptom and ask why until you reach a systemic gap (a missing test, a missing validation, unclear ownership) rather than a person. Stop there, or after about five whys.

Example: payment failed, Stripe returned 402, the card had expired, the renewal notice was never sent, the email timeout was not retried, no retry logic exists (root cause).

## Fishbone (when 5 Whys stalls)

Use it when 5 Whys gives different causes on different runs, or two people trace to different causes, or the failure spans three or more systems. List contributing causes under People, Process, Technology, Environment, Materials and Measurement, then test the strongest from each.

## Beyond a bug investigation

An 8D report (recurring failure, three or more occurrences) and fault-tree analysis (safety-critical or data-loss paths) are incident-management methods. Name them in the report as a recommendation for the owning team; this skill does not run them.
