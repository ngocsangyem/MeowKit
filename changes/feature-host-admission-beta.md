---
section: Features
---
- `mewkit host` (beta): `status` samples machine load and prints a verdict; `run` puts a heavy build or test through one machine-wide fair queue at low priority and returns within a bounded wait, with exit 75 and `NOT VERIFIED` when the command has not finished; `jobs` waits for, reads and cancels jobs; `watch` tells each worktree which processes load the host; `clean` removes MeowKit's own stale host state and `status --caches` names Rust `target/` directories to clean. Settings `host.enabled`, `host.auto_clean` and `host.max_heavy` live in `~/.meowkit/config.yaml` only. See [Host Admission](/guide/host-admission).
- New observer `host-pressure` (Claude Code only, `hooks.host-pressure: false` turns it off). The opt-in completion check credits `mewkit host run -- <cmd>` as `<cmd>`, and `mewkit host jobs wait <id>` only for a job that ended with 0 on the current file tree.
- `mk:verify` and `mk:orchestrate` route full suites through `mewkit host run` and hold dispatch while the host is saturated.
