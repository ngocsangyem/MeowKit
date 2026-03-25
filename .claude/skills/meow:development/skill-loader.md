# Skill: On-Demand Skill Loading

**Purpose:** Load only the skills relevant to the current task domain. Never load all skills at once — this wastes context and increases noise.

## When to Use

Invoke this skill at the start of every task to determine which domain-specific skills to load.

## Domain Detection Rules

Analyze the files being touched in the current task. Use the following rules to determine which skills to load:

### Rule 1: NestJS Backend
**Trigger:** Task touches `.ts` files in a NestJS context (files in `src/` with decorators like `@Module`, `@Controller`, `@Injectable`, or files in directories named `modules/`, `controllers/`, `services/`, `guards/`, `pipes/`, `dtos/`).

**Load these skills:**
- `development/code-patterns.md` (NestJS section)
- `review/security-checklist.md` (NestJS section)
- `testing/red-green-refactor.md`
- `documentation/api-sync.md`

### Rule 2: Vue Frontend
**Trigger:** Task touches `.vue` files, or `.ts` files in a Vue context (files importing from `vue`, `pinia`, `vue-router`).

**Load these skills:**
- `development/code-patterns.md` (Vue 3 section)
- `review/security-checklist.md` (Vue 3 section)
- `testing/visual-qa.md`
- `testing/red-green-refactor.md`

### Rule 3: Swift / iOS
**Trigger:** Task touches `.swift` files, `*.xcodeproj`, `Package.swift`, or `*.xib`/`*.storyboard` files.

**Load these skills:**
- `development/code-patterns.md` (Swift section)
- `review/security-checklist.md` (Swift section)
- `testing/red-green-refactor.md`

### Rule 4: Database / Migrations
**Trigger:** Task touches migration files, `.sql` files, or Supabase-related config (`supabase/`, RLS policies, database types).

**Load these skills:**
- `review/security-checklist.md` (Supabase section)
- `planning/adr-generation.md` (schema changes deserve ADRs)

### Rule 5: Planning / Architecture
**Trigger:** Task is a planning request, design discussion, or architectural decision.

**Load these skills:**
- `planning/premise-challenge.md`
- `planning/plan-template.md`
- `planning/adr-generation.md`

### Rule 6: Shipping / Deployment
**Trigger:** Task involves deploying, creating PRs, releasing, or rolling back.

**Load these skills:**
- `shipping/ship-pipeline.md`
- `shipping/canary-deploy.md`
- `shipping/rollback-protocol.md`

## Always-Loaded Skills

These skills are loaded for EVERY task regardless of domain:
- `memory/session-capture.md` (captures learnings)
- `development/tdd-enforcement.md` (enforces test-first)

## Steps to Execute

1. Read the task description or user request.
2. Identify which files will be touched (or ask if unclear).
3. Match files against the detection rules above.
4. Load ONLY the matched skills into context.
5. If multiple domains are detected (e.g., NestJS + Vue for a full-stack feature), load skills for all relevant domains.
6. Log which skills were loaded and why.

## Anti-Patterns

- **Never** load all skills at once "just in case."
- **Never** load Swift skills when working on a web project.
- **Never** skip the always-loaded skills.
- If unsure which domain applies, ask the human rather than guessing.
