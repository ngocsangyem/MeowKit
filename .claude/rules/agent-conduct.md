# Agent Conduct

Two-tier merge of four prior conduct rules: file naming, response output format, context ordering, and search-before-building. Tier A preserves rationale verbatim for behavioral rules consumed by orchestrator/agents (no hook enforcement). Tier B compresses rationale for hook-enforceable or model-default rules.

This file replaces:
- `naming-rules.md`
- `output-format-rules.md`
- `context-ordering-rules.md`
- `search-before-building-rules.md`

---

## Tier A — Behavioral, orchestrator-consumed (rationale preserved)

### A1. Subagent Status Protocol

> Source: `output-format-rules.md` Rule 5 — preserved verbatim because the orchestrator depends on this exact schema.

Every subagent MUST end its response with a structured status block:

```
**Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
**Summary:** [1-2 sentence summary of what was accomplished]
**Concerns/Blockers:** [if applicable — omit if DONE with no concerns]
```

#### Status Definitions

| Status                 | Meaning                        | Controller Action                                                                                      |
| ---------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| **DONE**               | Task completed successfully    | Proceed to next step                                                                                   |
| **DONE_WITH_CONCERNS** | Completed but flagged doubts   | If correctness concern → address before review. If tech debt → note, proceed.                          |
| **BLOCKED**            | Cannot complete task           | Assess blocker → provide more context / break task down / escalate to user. NEVER retry same approach. |
| **NEEDS_CONTEXT**      | Missing information to proceed | Provide missing context → re-dispatch                                                                  |

#### Handling Rules

- NEVER ignore BLOCKED or NEEDS_CONTEXT — something must change before retry
- NEVER force same approach after BLOCKED — try: more context → simpler task → escalate
- If subagent fails 3+ times on same task → escalate to user, don't retry blindly
- DONE_WITH_CONCERNS about file growth or tech debt → note for future, proceed now
- DONE_WITH_CONCERNS about correctness or security → address before review

WHY: Vague "I'm done" handoffs force the controller to investigate completion state. Structured status codes eliminate ambiguity and enable automatic routing decisions.

### A2. Project Context First

> Source: `context-ordering-rules.md` Rule 4 — verbatim.

When `docs/project-context.md` exists, ALWAYS load it BEFORE task-specific context. This file is the agent "constitution" — tech stack, conventions, anti-patterns, testing approach.

WHY: Ensures all agents share the same understanding of project conventions. Without it, agents infer independently and make conflicting assumptions about stack, patterns, and coding standards. Loading it first grounds all subsequent decisions in project reality.

### A3. Document Eureka Moments

> Source: `search-before-building-rules.md` Rule 4 — verbatim.

When Layer 3 reasoning reveals a genuine insight — something that contradicts the conventional approach with evidence:

- Name it: "EUREKA: Everyone does X because they assume [assumption]. But [evidence] suggests that's wrong here."
- Log it in `.claude/memory/lessons.md` for future sessions
- This is the highest-value output of the search process

WHY: First-principles insights are rare and valuable. If not documented, they're lost when context resets.

---

## Tier B — Hook-enforceable / model-default (rationale compressed)

### B1. File Naming (a.k.a. naming-rules)

ALWAYS use kebab-case for file names with descriptive names.

| Platform | Element | Convention | Example |
|---|---|---|---|
| TypeScript | vars/fns | camelCase | `getUserById` |
| TypeScript | classes/types | PascalCase | `UserService` |
| TypeScript | constants | UPPER_SNAKE_CASE | `MAX_RETRY` |
| TypeScript | files | kebab-case | `user.service.ts` |
| Vue | components | PascalCase | `UserAvatar` |
| Vue | composables | camelCase + `use` prefix | `useAuth` |
| Vue | files | kebab-case | `user-avatar.vue` |
| Swift | vars/fns | camelCase | `fetchUser()` |
| Swift | types/protocols | PascalCase | `UserRepository` |
| Swift | enum cases | lowerCamelCase | `.authenticated` |
| DB | tables | snake_case plural | `order_items` |
| DB | columns | snake_case | `created_at` |

Pattern files: NestJS `feature.service.ts` / `feature.controller.ts` / `feature.module.ts` / `action-name.dto.ts`; Vue `FeatureName.vue`; Swift view `FeatureNameView.swift`.

WHY: Self-documenting names make Grep/Glob output usable without opening files.

### B2. Response Structure (after code changes)

Every response that ships code MUST include:
1. **What changed** — 1-2 sentences
2. **Why** — link to plan/bug/user request
3. **File refs** — `path:line` for every modified file (e.g., `src/auth.ts:42`)
4. **Open questions** — unresolved decisions

Example:

```
Changed the session timeout from 5min to 24hr in the auth middleware.
Why: Fixes #123 — users were getting logged out during normal work sessions.
Files: src/middleware/auth.ts:15, src/config/session.ts:8
Open: Should we add a "remember me" checkbox, or apply 24hr universally?
```

NEVER respond with only "I'm done" or "Task complete" — always include what changed and current state.

Suggest next steps only when natural; don't invent them.

WHY: Structured responses let users review changes in under 30 seconds (codex-prompt-guide).

### B3. Context Ordering

When constructing prompts/plans/handoffs:
- **Long content first, query last** — background/code/refs at TOP, specific instruction at BOTTOM. Anthropic measured up to 30% quality lift on multi-document inputs (claude-prompting-best-practices).
- **Context before constraint** — explain WHAT and WHY before stating a NEVER. Pair every NEVER with an INSTEAD.
- **Self-contained documents** — every plan file / handoff readable cold by an agent with zero prior context. Required: WHAT (goal), WHERE (file paths), WHY (problem), STATUS (done/next).

WHY: Context windows reset; plans must survive both reset and handoff (codex-prompt-guide).

### B4. Search Before Building (3-layer framework)

Identify which knowledge layer applies:
- **Layer 1 — Tried and true.** Standard patterns. ALWAYS check if the runtime/framework/language already provides this.
- **Layer 2 — New and popular.** Current best practices. Search and cross-reference; popularity is not correctness.
- **Layer 3 — First principles.** Original observations. Document as EUREKAs (see A3).

ALWAYS search before: introducing a new dependency · implementing an unfamiliar pattern · solving a novel problem · making an architectural decision. Search means: codebase Grep/Glob → official docs → community.

NEVER skip search because "I know how to do this." For non-trivial research (library evaluation, architectural comparison), route to the **researcher** agent — research output pollutes the implementation context.

WHY: The cost of checking is near-zero; the cost of not checking is reinventing something worse.

### B5. Plan Status on Resumption

When resuming work on an existing plan, ALWAYS start the response with:
- Current plan status (which phases done / in-progress / blocked)
- What you are about to work on next
- Any blockers discovered

WHY: Resumption context prevents duplicate work and missed steps.

### B6. Claude Code Context Hygiene

Treat context as a limited resource:

- Explore first, then plan, then code for non-trivial work.
- Scope file reads and searches narrowly; use subagents for broad investigations.
- Put long context before the specific request in plans and handoffs.
- Keep always-loaded guidance concise; move domain-specific procedures into skills.
- Prefer deterministic verification (tests, build output, screenshots, runtime checks) over plausibility.
- After two repeated corrections on the same issue, refine the prompt/plan instead of accumulating more failed context.

WHY: Claude Code performance degrades as context fills. MeowKit's skill, rule, hook, and step-file architecture exists to load the right context just in time.

---

## Source Provenance

| Source rule | Bytes | Survives in | Notes |
|---|---|---|---|
| `naming-rules.md` | 1791 | B1 | Platform tables preserved (per-platform searchability) |
| `output-format-rules.md` | 4208 | A1 (Rule 5 verbatim) + B2 (Rules 1–3) + B5 (Rule 4) | Subagent status schema preserved exact |
| `context-ordering-rules.md` | 2642 | A2 (Rule 4 verbatim) + B3 (Rules 1–3) | |
| `search-before-building-rules.md` | 3005 | A3 (Rule 4 verbatim) + B4 (Rules 1–3) | |
| `best-practices-claude-code.md` | 590 lines | B6 | Context hygiene, plan-first flow, verification |
| **Sum sources** | **11,646** | | |
