# Trigger Registry

Canonical registry of every meowkit skill, its activation triggers, callers, and the user phrases that surface it. New for the harness plan (Phase 6) — single source of truth so skills can't become orphaned.

## Schema

| Field | Meaning |
|---|---|
| **Skill** | Skill name (e.g., `mk:harness`) |
| **Trigger** | Auto-activation pattern OR explicit user invocation |
| **Caller** | Which agent/skill/hook/user invokes this |
| **User phrases** | Natural-language phrases that surface this skill |
| **Outputs** | Files / paths the skill writes |

## Harness Pipeline Skills (Phases 1–5)

| Skill | Trigger | Caller | User phrases | Outputs |
|---|---|---|---|---|
| `mk:harness` | User invocation; auto-suggest on green-field "build me a X" intent | User; orchestrator routing | "build me a kanban app", "make a retro game maker", "create a SaaS dashboard", "autonomous build" | `tasks/harness-runs/{run-id}/run.md` + all per-step artifacts |
| `mk:plan-creator` | `/mk:plan` or `/mk:cook`; harness step-01 | User; `mk:harness`; `mk:cook` | "create a plan", "plan this feature", "draft a spec" | `tasks/plans/{date-slug}/plan.md` + phase files |
| `mk:plan-creator --product-level` | step-00 of plan-creator detects green-field intent; harness step-01 | `mk:plan-creator`; `mk:harness` step-01 | "build a kanban app" (auto-detected); explicit `--product-level` flag | `tasks/plans/{date-slug}/plan.md` (product spec form, no phase files) |
| `mk:sprint-contract` | Harness step-02 (FULL density); pre-developer for any sprint-driven build | `mk:harness` step-02; user via `/mk:sprint-contract` | "draft a sprint contract", "negotiate scope for sprint" | `tasks/contracts/{date}-{slug}-sprint-{N}.md` |
| `mk:rubric` | Loaded by `mk:evaluate` step-01; user via `/mk:rubric` | `evaluator` agent; user | "load rubric", "compose rubric preset", "validate rubric" | Composed prompt fragment to stdout |
| `mk:evaluate` | Harness step-04; post-developer handoff | `mk:harness` step-04; `evaluator` agent | "evaluate this build", "grade the running app", "verify against the spec" | `tasks/reviews/{date-slug}-evalverdict.md` + `evidence/` directory |

## Existing Skills (Pre-Harness — Just Documented Here)

| Skill | Trigger | Caller | User phrases |
|---|---|---|---|
| `mk:cook` | User invocation; harness MINIMAL short-circuit | User; `mk:harness` step-00 (MINIMAL only) | "implement this feature", "fix this bug", "make this change" |
| `mk:summary` | User invocation (Phase 9 inspector) | User | "show conversation summary", "clear summary cache", "/mk:summary", "/mk:summary --clear", "/mk:summary --status" |
| `mk:review` | User invocation; pre-ship Gate 2 | User; `shipper` agent; `reviewer` agent | "review this", "code review", "check before shipping" |
| `mk:fix` | User invocation; simple bugs | User | "fix this", "/mk:fix" |
| `mk:scale-routing` | Auto on every Phase 0 (orient); harness step-00 | `orchestrator` agent; `mk:harness` step-00 | (auto — no user phrase) |
| `mk:scout` | Pre-review on COMPLEX changes; user via `/mk:scout` | `reviewer` agent; user | "scout the codebase", "find related files" |
| `mk:agent-browser` | User invocation; `mk:evaluate` step-03 for frontend probes | `evaluator` agent; user | "navigate to", "click on", "test this URL" |
| `mk:playwright-cli` | User invocation; `mk:evaluate` step-03 for scripted flows | `evaluator` agent; user | "run playwright script", "automated browser test" |

## Rubric Library Triggers (Phase 2)

Each rubric is loaded by `mk:rubric load <name>` or as part of a composition preset.

| Rubric | Loaded by preset | Loaded by direct `load` |
|---|---|---|
| `product-depth` | `frontend-app`, `backend-api`, `cli-tool`, `fullstack-product` | yes |
| `functionality` | All 4 presets | yes |
| `design-quality` | `frontend-app`, `fullstack-product` | yes |
| `originality` | `frontend-app`, `fullstack-product` | yes |
| `code-quality` | `backend-api`, `cli-tool`, `fullstack-product` | yes (NOT in pruned `frontend-app`) |
| `craft` | `fullstack-product` | yes (NOT in pruned `frontend-app`, `backend-api`, `cli-tool`) |
| `ux-usability` | `cli-tool`, `fullstack-product` | yes (NOT in pruned `frontend-app`, `backend-api`) |

## Hook Triggers (Existing + Phase 6 Extension)

| Hook | Event | Purpose |
|---|---|---|
| `gate-enforcement.sh` | PreToolUse (Edit / Write) | Block source-code edits before Gate 1 plan + Phase 4 sprint contract |
| `privacy-block.sh` | PreToolUse (Read) | Block sensitive file reads (`.env`, credentials) |
| `project-context-loader.sh` | SessionStart | Auto-load `docs/project-context.md` into agent context |
| `post-session.sh` | Stop | (Phase 6 extension) Detect model version change → flag dead-weight audit needed |

## Forward References (Phases 7–9 — Pending)

| Skill / Hook | Phase | Status |
|---|---|---|
| `post-write-build-verify.sh` middleware | 7 | **Shipped 260408** — auto compile/lint per file extension, hash-cached, env-isolated |
| `post-write-loop-detection.sh` middleware | 7 | **Shipped 260408** — warn at N=4, escalate at N=8 edits to same file |
| `pre-completion-check.sh` middleware | 7 | **Shipped 260408** — Stop hook hard gate, JSON block decision when no verification evidence |
| `mk:trace-analyze` | 8 | **Shipped 260408** — `/mk:trace-analyze`, scatter-gather over `.claude/memory/trace-log.jsonl`, HITL gate mandatory |
| `mk:benchmark` | 8 | **Shipped 260408** — `/mk:benchmark run [--full]`, quick tier 5 tasks ≤$5, full tier 6 tasks ≤$30 |
| `conversation-summary-cache.sh` middleware | 9 | **Shipped 260408** — dual-event hook (Stop summarizes via detached `nohup` `claude -p --model haiku` background worker, UserPromptSubmit injects cached summary as user-visible context). Throttled by size + event gap + growth delta. Cleared on session change by `project-context-loader.sh`. User-facing inspector: `/mk:summary`. Env-var configurable. |

## Maintenance

This file is the **canonical source** for skill discovery. Add a row whenever a new skill ships. Remove a row when a skill is pruned.

**CI lint (not yet scheduled):** a linter that greps `.claude/skills/*/SKILL.md` and verifies each name has a row here would prevent skill drift. Currently a manual grep before merge. Not pinned to any phase — a future plan can pick it up if drift becomes a real problem.

## See Also

- `.claude/skills/SKILLS_INDEX.md` — operational skill index (different schema; this file is for discovery, that file for runtime metadata)
- `.claude/agents/AGENTS_INDEX.md` — agent registry
- `.claude/rules/RULES_INDEX.md` — rule load order
- `docs/meowkit-rules.md` §2 — canonical valid `subagent_type` list
