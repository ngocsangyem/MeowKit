# Skill: On-Demand Skill Loading

**Purpose:** Load only the skills relevant to the current task domain. Never load all skills at once — this wastes context and increases noise.

## When to Use

Invoke this skill at the start of every task to determine which domain-specific skills to load.

## Domain Detection Rules

Analyze the files being touched in the current task. Use the following rules to determine which skills to load.

**Path convention:** All references use `.claude/skills/meow:{domain}/references/{file}.md`

### Rule 1: NestJS Backend
**Trigger:** Task touches `.ts` files in a NestJS context (files in `src/` with decorators like `@Module`, `@Controller`, `@Injectable`, or files in directories named `modules/`, `controllers/`, `services/`, `guards/`, `pipes/`, `dtos/`).

**Load these references:**
- `.claude/skills/meow:development/references/code-patterns.md` (NestJS section)
- `.claude/skills/meow:review/references/adversarial-review.md`
- `.claude/skills/meow:testing/references/red-green-refactor.md`
- `.claude/skills/meow:document-release/references/general-documentation.md`

### Rule 2: Vue Frontend
**Trigger:** Task touches `.vue` files, or `.ts` files in a Vue context (files importing from `vue`, `pinia`, `vue-router`).

**Load these references:**
- `.claude/skills/meow:development/references/code-patterns.md` (Vue 3 section)
- `.claude/skills/meow:testing/references/visual-qa.md`
- `.claude/skills/meow:testing/references/red-green-refactor.md`

### Rule 3: Swift / iOS
**Trigger:** Task touches `.swift` files, `*.xcodeproj`, `Package.swift`, or `*.xib`/`*.storyboard` files.

**Load these references:**
- `.claude/skills/meow:development/references/code-patterns.md` (Swift section)
- `.claude/skills/meow:testing/references/red-green-refactor.md`

### Rule 4: Database / Migrations
**Trigger:** Task touches migration files, `.sql` files, or Supabase-related config (`supabase/`, RLS policies, database types).

**Load these references:**
- `.claude/skills/meow:plan-creator/references/adr-generation.md` (schema changes deserve ADRs)

### Rule 5: Planning / Architecture
**Trigger:** Task is a planning request, design discussion, or architectural decision.

**Load these references:**
- `.claude/skills/meow:plan-creator/references/scope-challenge.md`
- `.claude/skills/meow:plan-creator/references/adr-generation.md`

### Rule 6: Shipping / Deployment
**Trigger:** Task involves deploying, creating PRs, releasing, or rolling back.

**Load these references:**
- `.claude/skills/meow:ship/SKILL.md` — unified ship pipeline (merge base, tests, review, PR)

## Always-Loaded References

These are loaded for EVERY task regardless of domain:
- `.claude/skills/meow:memory/references/session-capture.md` (captures learnings)
- `.claude/skills/meow:development/references/tdd-enforcement.md` (enforces test-first)

## Steps to Execute

1. Read the task description or user request.
2. Identify which files will be touched (or ask if unclear).
3. Match files against the detection rules above.
4. Load ONLY the matched references into context.
5. If multiple domains are detected (e.g., NestJS + Vue for a full-stack feature), load references for all relevant domains.
6. Log which references were loaded and why.

## Anti-Patterns

- **Never** load all skills at once "just in case."
- **Never** load Swift skills when working on a web project.
- **Never** skip the always-loaded references.
- If unsure which domain applies, ask the human rather than guessing.
