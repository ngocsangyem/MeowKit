---
title: "mk:investigate"
description: "Systematic debugging with root cause investigation. Four phases: investigate, analyze, hypothesize, implement. Iron Law: no fixes without root cause."
---

# mk:investigate

## What This Skill Does

Performs systematic root cause debugging with a strict methodology: investigate symptoms, analyze patterns, form and test hypotheses, and only then implement a fix. Enforces the **Iron Law** -- no fixes without confirmed root cause. Hooks prevent edits until investigation is complete. Produces a structured DEBUG REPORT with symptom, root cause, fix scope, and evidence. Hands off to `mk:fix` for implementation if a fix is needed.

## When to Use

- User reports errors, bugs, or unexpected behavior
- "debug this", "fix this bug", "why is this broken"
- "investigate this error", "root cause analysis"
- Troubleshooting why something stopped working
- **NOT** for applying fixes without investigation -- use `mk:fix` (which internally invokes investigate)
- **NOT** for step-by-step evidence-based reasoning -- use `mk:sequential-thinking` (which investigate delegates to for hypothesis testing)
- **NOT** for being stuck on approach/design -- use `mk:problem-solving`

## Core Capabilities

- **5-phase debugging methodology:** Investigate -> Analyze -> Hypothesize -> Implement -> Verify
- **Read-only until hypothesis confirmed:** `mk:freeze` hook blocks Edit/Write during investigation
- **3-strike rule:** After 3 failed hypotheses, stops and escalates to human
- **Minimal diff enforcement:** Fix root cause with fewest files/lines possible
- **Regression test required:** Every fix must have a test that fails without it, passes with it
- **Blast radius check:** If >5 files touched, prompts user before proceeding
- **Specialized technique dispatch:** Routes to deep stack trace analysis, system investigation, log analysis, or performance diagnostics based on bug type
- **Pattern library:** Recognizes common failure patterns (race conditions, nil propagation, state corruption, integration failures, configuration drift, stale cache)
- **Memory integration:** Reads `.claude/memory/fixes.md` and `.claude/memory/architecture-decisions.md`; writes diagnosis records
- **Protocol compliance:** Follows shared protocols for AskUserQuestion format, completeness principle, telemetry, completion status

## Workflow

1. **Preamble** -- Session initialization, environment detection, upgrade check
2. **Collect symptoms** -- Read error messages, stack traces, reproduction steps from user
3. **Investigate root cause** -- Follow 5-phase debugging methodology:
   - **Phase 1 (Investigate):** Collect errors, traces, reproduction steps, relevant files. Check recent changes with `git log`
   - **Phase 2 (Analyze):** Trace backward from symptom to cause. Check TODOS.md and git log for prior fixes in same area
   - **Phase 3 (Hypothesize):** Delegate to `mk:sequential-thinking` to generate and test hypotheses with evidence. Apply 3-strike rule
   - **Phase 4 (Implement):** Apply minimal fix addressing root cause only. Regression test required. Blast radius check at 5 files
   - **Phase 5 (Verify):** Reproduce original scenario, run test suite, produce DEBUG REPORT
4. **Scope lock** -- Optionally invoke `mk:freeze` to restrict edits to affected module
5. **Produce DEBUG REPORT** -- Symptom, root cause, fix details, evidence, regression test reference, completion status

### Specialized Technique Routing

Based on bug type, the skill loads specialized reference files:

| Bug Type | Technique | What It Provides |
|----------|-----------|-----------------|
| Deep stack traces | Root cause tracing (`root-cause-tracing.md`) | Backward trace: symptom -> cause -> ROOT CAUSE |
| Server/CI/DB incidents | System investigation (`system-investigation.md`) | 5-step system investigation methodology |
| CI/CD failures | Log analysis (`log-analysis.md`) | Filter -> timeline -> pattern -> cross-source |
| Performance issues | Performance diagnostics (`performance-diagnostics.md`) | Quantify -> layer isolation -> bottleneck |
| Post-fix validation | Reporting standards (`reporting-standards.md`) | Enhanced report with timeline + recommendations |
| Test pollution | Bisection script (`find-polluter.sh`) | Find which test creates unwanted state |
| Defense-in-depth | Prevention gate (shared with `mk:fix`) | 4-layer validation |

## Constraints

- **Iron Law:** No edits until root cause is confirmed -- process gate, not just a suggestion
- **3-strike rule:** If 3 hypotheses fail, STOP and escalate -- do not keep guessing
- **Minimal diff:** Fix root cause with fewest files and lines possible
- **Regression test:** Must fail without fix, pass with fix
- **Blast radius:** If >5 files would be touched, prompt user first

## Usage

```bash
/mk:investigate "login fails after token refresh"
/mk:investigate "intermittent timeout on payment endpoint"
```

## Example Prompt

> "Users report that the search page returns 500 errors when filtering by date range. /mk:investigate 'search date filter 500 error'"

The skill collects the error trace, reads the search controller code, checks recent git changes, forms hypotheses (missing date validation, timezone parsing issue, SQL query error), tests each with evidence, confirms root cause is an unhandled null date range parameter, applies a minimal guard clause fix, writes a regression test, and produces a DEBUG REPORT.

## Common Use Cases

- **Production bug investigation:** Systematic root cause analysis of reported errors
- **Intermittent failure debugging:** Pattern analysis for race conditions, timing issues
- **Regression hunting:** `git log` analysis to find which commit introduced the bug
- **Performance degradation:** Quantify impact, isolate bottleneck layer, identify cause
- **Post-incident analysis:** Structured investigation of what broke and why

## Pro Tips

- **Don't skip the hypothesis phase** -- the Iron Law exists because symptom-fixing creates whack-a-mole debugging
- **The skill delegates to `mk:sequential-thinking`** for structured hypothesis testing -- this is by design
- **Check `TODOS.md` and prior fixes** -- many bugs are recurrences of previous issues
- **Use `mk:freeze` for complex modules** -- scope-lock prevents accidentally touching unrelated files
- **3 strikes and escalate** -- if you've tested 3 wrong hypotheses, your mental model is wrong; get fresh perspective
- **The skill writes to `.claude/memory/fixes.md`** -- these diagnosis records build institutional knowledge over time

> **Canonical source:** `.claude/skills/investigate/SKILL.md`
