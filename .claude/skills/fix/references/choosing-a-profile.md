# Choosing a profile

Default to **standard**. Move down or up only on the evidence below; ask the user only when escalation is unclear.

| Profile | Use when | Escalate when |
|---|---|---|
| quick | The cause is already known, one or two files, an obvious fix location (a lint error, a slip in a runtime path, a typo in logic) | The cause is unclear, the failure is intermittent without bounded evidence, or the blast radius exceeds two files: go to standard before editing |
| standard | A bug, failing test or red CI whose cause needs diagnosis, across a few files | A contract or the architecture changes, research is needed, or the fix touches a system-wide path: go to deep |
| deep | System-wide impact, an architecture decision, performance or security issues needing research | none |

Production code, security fixes and architecture changes are good candidates for `--review` (pause at each step). Two or more independent issues in different areas are a reason for `--parallel`, with one proof per issue.

A build, compile or type-check failure is not a profile question: it belongs to `mk:build-fix`.
