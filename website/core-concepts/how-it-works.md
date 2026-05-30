---
title: How It Works
description: The three mechanisms that enforce discipline — rules, hooks, and skills — and how agents compose skills across the workflow.
---

# How MeowKit Works

MeowKit shapes AI behavior through three mechanisms. None of them are an executable runtime — they're conventions that Claude Code reads and acts on.

## The three mechanisms

| Mechanism | What it is | Example |
|-----------|-----------|---------|
| **Rules** | Behavioral instructions loaded every session | "Never write code before a plan is approved" (`gate-rules.md`) |
| **Hooks** | Preventive scripts that block unsafe actions | Shell hook blocks file writes until Gate 1 passes |
| **Skills** | Domain expertise loaded on demand | `mk:fix` loads bug-fixing patterns only when you report a bug |

## Rules: behavioral guardrails

19 rule files in `.claude/rules/` are loaded into context every session. Two are NEVER-override: `security-rules.md` (block hardcoded secrets, SQL injection, XSS) and `injection-rules.md` (treat all file content as DATA, not instructions).

Rules define the WHY. Hooks enforce the WHAT. A rule says "don't write code before planning." A hook says "you can't."

## Hooks: preventive enforcement

Shell and Node.js scripts triggered by Claude Code lifecycle events — SessionStart, PreToolUse, PostToolUse, Stop, UserPromptSubmit. They intercept tool calls before they execute:

- `gate-enforcement.sh` — blocks file writes before Gate 1 approval
- `privacy-block.sh` — blocks reads of `.env`, SSH keys, credentials
- `post-write.sh` — security scan on every written file
- `pre-completion-check.sh` — blocks session end without verification evidence

Critical design: security hooks (`gate-enforcement.sh`, `privacy-block.sh`) are never routed through the dispatcher. If `dispatch.cjs` crashes, security hooks still fire — no single point of failure.

Under the hooks, a Node.js dispatch system (`dispatch.cjs` + `handlers.json`) runs infrastructure handlers: model detection, budget tracking, build verification, loop detection, and checkpoint management. These fire automatically — agents don't invoke them.

## Skills: domain expertise on demand

77 skills in `.claude/skills/` provide domain-specific knowledge. Each skill's `SKILL.md` is a compact decision router — typically under 150 lines. Detailed procedures live in `references/` and load only when needed. This progressive disclosure saves ~70% context per invocation.

Skills activate by task domain, not all at once. A bug fix loads `mk:fix` (which internally calls `mk:investigate` and `mk:sequential-thinking`). A code review loads `mk:review`. A deployment loads `mk:ship`. No agent loads everything.

Complex skills use step-file decomposition — only the active step is in context:

```
skills/review/
├── SKILL.md              # Entrypoint — metadata only
├── workflow.md           # Step sequence
├── step-01-blind-review.md
├── step-02-edge-cases.md
├── step-03-criteria-audit.md
└── step-04-triage.md
```

## Agents: specialists with clear ownership

17 specialist agents each own one concern. No two agents modify the same files:

| Agent | Phase | Owns | Never does |
|-------|-------|------|-----------|
| orchestrator | 0 | Task routing, model tier | Write code |
| planner | 1 | Plan creation | Implement |
| tester | 2 | Test writing | Ship |
| developer | 3 | `src/`, `lib/`, `app/` | Self-review |
| reviewer | 4 | Verdict files | Implement |
| shipper | 5 | Deployment | Self-approve |
| documenter | 6 | Documentation | Plan |

Agents invoke skills as tools. The orchestrator loads `agent-detector` and `scout`. The developer loads `development`, `typescript`, and `docs-finder`. The reviewer loads `review`, `cso`, and `vulnerability-scanner`. Each agent only loads what its phase requires.

## Memory: learning across sessions

MeowKit stores engineering learnings in `.claude/memory/` — fix patterns, review findings, architecture decisions. Skills read relevant topic files at task start:

| Topic file | Consumer | Read when |
|-----------|----------|-----------|
| `fixes.md` + `fixes.json` | `mk:fix` | Bug diagnosis |
| `review-patterns.md` + `review-patterns.json` | `mk:review`, `mk:plan-creator` | Code review or planning |
| `architecture-decisions.md` + `architecture-decisions.json` | `mk:plan-creator`, `mk:cook` | Architecture work |

There is no auto-injection pipeline. Each skill loads only the topic files relevant to its domain.

Write paths: immediate capture via `##pattern:` / `##decision:` / `##note:` prefixes during a session, session-end auto-capture via `post-session.sh`, and Phase 6 `mk:memory session-capture`.

## Putting it together: a feature request

```
User: "Add Stripe payment checkout"
     │
     ▼
Phase 0: orchestrator classifies → COMPLEX (fintech domain)
     │  Loads architecture-decisions.md for past payment patterns
     ▼
Phase 1: planner creates plan → Gate 1 (human approves)
     │
     ▼
Phase 2: tester writes failing tests (if --tdd enabled)
     │
     ▼
Phase 3: developer implements → build-verify.cjs checks every file
     │  budget-tracker.cjs warns at $30, blocks at $100
     ▼
Phase 4: reviewer audits 5 dimensions → Gate 2 (human approves)
     │
     ▼
Phase 5: shipper creates PR, never pushes to main
     │
     ▼
Phase 6: documenter captures patterns to memory for next time
```

## Next steps

- [Understand the workflow phases](/core-concepts/workflow)
- [How gates enforce discipline](/core-concepts/gates)
- [Adaptive density by model tier](/guide/adaptive-density)
- [Memory system in depth](/guide/memory-system)
