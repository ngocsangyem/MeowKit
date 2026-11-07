# Agent Conduct — Extended Sections

Tier-A and Tier-B conduct sections that are NOT always-on. The always-on rule
`.claude/rules/agent-conduct.md` keeps A1 (subagent status protocol), A3 (eureka
entries) and B2 (response structure); the sections below are loaded just in time by
`mk:cook` and `mk:agent-detector` when an implementation or routing phase needs them.

Sections are verbatim from the pre-diet always-on rule, with internal rule paths
repointed to their current locations.

### A2. Project Context First

> Source: `context-ordering-rules.md` Rule 4 — verbatim.

When `docs/project-context.md` exists, ALWAYS load it BEFORE task-specific context. This file is the agent "constitution" — tech stack, conventions, anti-patterns, testing approach.

WHY: Loading project context first prevents conflicting convention guesses.

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

WHY: Self-documenting names make Grep/Glob useful without opening files.

### B3. Context Ordering

When constructing prompts/plans/handoffs:
- **Long content first, query last** — background/code/refs at TOP, specific instruction at BOTTOM. This improves multi-document task quality.
- **Context before constraint** — explain WHAT and WHY before stating a NEVER. Pair every NEVER with an INSTEAD.
- **Self-contained documents** — every plan file / handoff readable cold by an agent with zero prior context. Required: WHAT (goal), WHERE (file paths), WHY (problem), STATUS (done/next).

WHY: Plans must survive resets and handoffs.

### B4. Search Before Building (3-layer framework)

Identify which knowledge layer applies:
- **Layer 1 — Tried and true.** Standard patterns. ALWAYS check if the runtime/framework/language already provides this.
- **Layer 2 — New and popular.** Current best practices. Search and cross-reference; popularity is not correctness.
- **Layer 3 — First principles.** Original observations. Document as EUREKAs (see A3).

ALWAYS search before: introducing a new dependency · implementing an unfamiliar pattern · solving a novel problem · making an architectural decision. Search means: codebase Grep/Glob → official docs → community.

NEVER skip search because "I know how to do this." For non-trivial research (library evaluation, architectural comparison), route to the **researcher** agent — research output pollutes the implementation context.

WHY: Checking is cheap; rebuilding the wrong thing is not.

### B5. Plan Status on Resumption

When resuming work on an existing plan, ALWAYS start the response with:
- Current plan status (which phases done / in-progress / blocked)
- What you are about to work on next
- Any blockers discovered

WHY: Resumption context prevents duplicate work.

### B6. Host-Runtime Context Hygiene

Treat context as a limited resource:

- Explore first, then plan, then code for non-trivial work.
- Scope file reads and searches narrowly; use subagents for broad investigations.
- Put long context before the specific request in plans and handoffs.
- Keep always-loaded guidance concise; move domain-specific procedures into skills.
- Prefer deterministic verification (tests, build output, screenshots, runtime checks) over plausibility.
- After two repeated corrections on the same issue, refine the prompt/plan instead of accumulating more failed context.

For the per-phase × per-tier read-set and token ceiling that operationalizes this hygiene,
see `.claude/skills/agent-detector/references/context-budget-rules.md` (the Context-selection budget). B3/B6 set the ordering and
discipline; that rule sets how much to load per phase.

WHY: JIT-loaded context keeps host-runtime performance usable.
