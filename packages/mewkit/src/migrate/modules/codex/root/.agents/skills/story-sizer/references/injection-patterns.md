# Rule-1 Injection Patterns (mirror of `injection-rules.md` Rule 1)

<!-- source: .agents/skills/rule-injection-rules.md Rule 1 -->
<!-- audit cadence: quarterly OR on every model-tier upgrade per skill-authoring-rules.md Rule 3 -->

This file is a working copy of the Rule-1 inventory from `.agents/skills/rule-injection-rules.md`. The auto-create dry-run (`references/auto-create-gating.md` Check 2) scans every suggested summary and description for these substrings; ANY match ABORTS the batch with the offending pattern quoted in the abort message.

## Why a working copy

Rule-1 is the always-loaded list, but performing substring matching on a long, prose-shaped rules file at gate-check time is brittle. This file collapses the inventory into a deterministic, machine-readable list. When `injection-rules.md` Rule 1 changes, this file MUST be updated in the same commit.

## Patterns (case-insensitive substring match)

- `ignore previous instructions`
- `ignore your previous instructions`
- `ignore all previous instructions`
- `disregard your rules`
- `disregard the previous instructions`
- `forget your rules`
- `forget everything you were told`
- `you are now`
- `from now on you are`
- `act as if you are`
- `pretend you are`
- `pretend to be`
- `new system prompt`
- `system prompt:`
- `override your safety`
- `bypass your safety`
- `jailbreak`
- `roleplay as`
- `role-play as`

## What this protects

Auto-create writes user-paste content into the Jira `summary` and `description` fields. Without this scan, a malicious paste could craft strings that downstream agents (assignees reading the ticket, automation hooks, AI summarizers) would re-parse as instructions. Aborting the batch is preferable to silently emitting content with those triggers.

## False-positive handling

If a legitimate ticket needs a phrase containing one of these substrings, the user must:

1. Reword the summary/description (typically the simplest path).
2. OR ABORT auto-create and create the ticket manually via `mk:jira-issue create`, accepting the risk explicitly.

There is NO `--force` flag, NO `--allow-pattern` flag — every pattern match aborts the batch by design.
