---
name: mk:investigate
preamble-tier: 2
version: 1.0.0
description: |
  Systematic debugging with root cause investigation. Four phases: investigate,
  analyze, hypothesize, implement. Iron Law: no fixes without root cause.
  Use when asked to "debug this", "fix this bug", "why is this broken",
  "investigate this error", or "root cause analysis".
  Proactively suggest when the user reports errors, unexpected behavior, or
  is troubleshooting why something stopped working.
  NOT for applying fixes without investigation (see mk:fix); NOT for
  step-by-step evidence-based reasoning (see mk:sequential-thinking).
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
  - WebSearch
hooks:
  PreToolUse:
    - matcher: "Edit"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/bin/check-freeze.sh"
          statusMessage: "Checking debug scope boundary..."
    - matcher: "Write"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/bin/check-freeze.sh"
          statusMessage: "Checking debug scope boundary..."
source: gstack
---

<!-- Split for progressive disclosure (checklist #11, #14): 497 → ~65 lines -->
<!-- References loaded just-in-time, not all upfront -->

# Systematic Debugging

> **Path convention:** Commands below assume cwd is `$CLAUDE_PROJECT_DIR` (project root). Prefix paths with `"$CLAUDE_PROJECT_DIR/"` when invoking from subdirectories.

**Iron Law: NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST.**

## Skill wiring

- **Reads memory:** `.claude/memory/fixes.md`, `.claude/memory/architecture-decisions.md`
- **Writes memory:** `.claude/memory/fixes.md` with `##note:` prefix (diagnosis records only — the fix itself is persisted by `mk:fix`)

## Plan-First Gate

Investigation precedes planning for bug fixes:

1. Confirm root cause FIRST (Iron Law)
2. After root cause confirmed → invoke `mk:plan-creator --type bugfix` if fix affects > 2 files

Skip: Investigation itself doesn't need a plan — it produces the input for planning.

## When to Use

- User reports errors, bugs, unexpected behavior
- "debug this", "fix this bug", "why is this broken"
- "investigate this error", "root cause analysis"
- Troubleshooting why something stopped working

## Process

1. **Run preamble** — load `references/preamble.md` and execute the startup bash block
2. **Collect symptoms** — read error messages, stack traces, reproduction steps
3. **Investigate root cause** — load `references/debugging-methodology.md` and follow Phase 1-3. For recurring patterns or complex failures, load `references/rca-method-selection.md` for methodology selection. Load `references/rca-anti-patterns.md` to avoid common RCA mistakes.
4. **Lock scope** — optionally invoke `mk:freeze <target-dir>` first to restrict edits to the affected module. The `check-freeze.sh` hook is installed but without an explicit `mk:freeze` invocation it is a no-op (all edits allowed).
5. **Implement fix** — follow Phase 4 from debugging methodology
6. **Verify** — reproduce original scenario, run test suite, output DEBUG REPORT
7. **Run shared protocols** — load `references/shared-protocols.md` for completion status + telemetry

## References

Load **only when executing** the corresponding step — not upfront.

| Reference                                                             | When to load                    | Content                                                                     |
| --------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------- |
| **[preamble.md](./references/preamble.md)**                           | Step 1 — skill startup          | Session init, env detection, upgrade check                                  |
| **[debugging-methodology.md](./references/debugging-methodology.md)** | Steps 2-6 — investigation + fix | 5-phase debugging: investigate → analyze → hypothesize → implement → verify |
| **[shared-protocols.md](./references/shared-protocols.md)**           | Step 7 — completion             | AskUserQuestion format, completion status, telemetry, contributor mode      |

### Specialized Techniques (load based on bug type)

| Bug type | Load reference | What it adds |
|----------|---------------|-------------|
| Deep stack trace errors | `references/root-cause-tracing.md` | Backward trace: symptom → cause → ROOT CAUSE |
| Server/CI/DB incidents | `references/system-investigation.md` | 5-step system investigation methodology |
| CI/CD failures, log correlation | `references/log-analysis.md` | Filter → timeline → pattern → cross-source |
| Performance issues | `references/performance-diagnostics.md` | Quantify → layer isolation → bottleneck |
| Post-fix validation | `references/reporting-standards.md` | Enhanced DEBUG REPORT with timeline + recommendations |
| Test pollution | Run `scripts/find-polluter.sh <file> <test-pattern>` | Bisection to find which test creates unwanted state |
| Defense-in-depth | See `mk:fix/references/prevention-gate.md` | 4-layer validation (DRY — shared with mk:fix) |

## Constraints

- **Read-only until hypothesis confirmed** — no edits until root cause identified
- **3-strike rule** — if 3 hypotheses fail, STOP and escalate
- **Minimal diff** — fix root cause with fewest files/lines possible
- **Regression test required** — must fail without fix, pass with fix
- **>5 files touched** — AskUserQuestion about blast radius before proceeding

## Hooks

- **Iron Law enforcement**: No fixes without confirmed root cause — this is a process constraint, not a technical hook
- The skill gates Phase 3 (Fix) behind Phase 1 (Investigate) completion
- If root cause cannot be confirmed after 3 hypotheses, escalate to human
- **Scope-locking hook**: Installs a `PreToolUse` hook on Edit/Write that delegates to `mk:freeze` to scope edits to the investigation target. Deactivation follows freeze's semantics — end the session or start a new one to clear it.
- **Interaction with mk:careful**: If mk:careful is active, debugging commands that touch state will still prompt for confirmation. This is expected — do not bypass.

## Gotchas

- **Confirming hypothesis without disproving alternatives**: Finding evidence FOR a theory doesn't mean it's correct → Actively test at least one alternative hypothesis before concluding
- **Log timestamps in wrong timezone**: Server logs in UTC, local comparison in local time → Normalize all timestamps to UTC before correlation

## Delegation: `mk:web-to-markdown`

When investigation requires fetching an arbitrary external URL (e.g. a vendor error page,
a remote log endpoint, a referenced issue URL), this skill delegates to
`mk:web-to-markdown` via the `--wtm-accept-risk` flag.

- **Without `--wtm-accept-risk`:** `mk:web-to-markdown` refuses cross-skill delegation.
  External URL resolution falls back to Context7 / chub / WebSearch only.
- **With `--wtm-accept-risk`:** delegation proceeds through all security layers
  (SSRF guard, injection scanner, DATA boundary, secret scrub). The flag is a conscious
  trust-boundary crossing — the caller acknowledges the target URL may contain prompt
  injection and that the skill's defenses are best-effort.
- Delegation example: `.claude/skills/.venv/bin/python3 .claude/skills/web-to-markdown/scripts/fetch_as_markdown.py "<url>" --wtm-accept-risk --caller mk:investigate`
