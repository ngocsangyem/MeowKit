# Validation Question Framework

Generate 3-5 critical questions from plan content before Gate 1. Runs in hard/deep/parallel/two modes (skipped in fast).

## Question Categories

### 1. Architecture

**Detection keywords:** database, schema, API, endpoint, microservice, monolith, cache, queue, component, layer, service, middleware

- "Why {chosen approach} instead of {obvious alternative}?"
- "What happens if {external dependency} is unavailable?"
- "Is {component} the right abstraction level?"

**Section mapping:** answers propagate to → phase `## Architecture`

### 2. Assumptions

**Detection keywords:** assume, expect, should be, will be, always, never, guaranteed, available, stable, compatible

- "The plan assumes {X}. Is this still true?"
- "Phase {N} depends on {Y} being available. Who confirms this?"
- "The technical approach assumes {pattern}. Does the codebase follow this?"

**Section mapping:** answers propagate to → phase `## Key Insights` (with "Validated:" prefix)

### 3. Scope

**Detection keywords:** MVP, defer, future, nice-to-have, optional, stretch, out of scope, in scope, phase 2

- "Phase {N} includes {Y}. Is this in scope or should it be deferred?"
- "The plan doesn't mention {related concern}. Intentional exclusion?"
- "Is {deliverable} needed for MVP or can it be a follow-up?"

**Section mapping:** answers propagate to → plan.md `## Constraints` (In Scope / Out of Scope)

### 4. Risk

**Detection keywords:** risk, fail, break, downtime, migration, rollback, data loss, backward compat, breaking change

- "What's the fallback if {risk} materializes?"
- "Phase {N} has no risks listed. What could go wrong?"
- "The highest risk is {X}. Is the mitigation sufficient?"

**Section mapping:** answers propagate to → phase `## Risk Assessment`

### 5. Tradeoffs

**Detection keywords:** tradeoff, trade-off, versus, vs, instead of, alternative, simpler, faster, technical debt, compromise

- "This approach trades {simplicity} for {flexibility}. Acceptable?"
- "Faster implementation means {technical debt}. OK for now?"
- "Using {library} adds a dependency. Worth the tradeoff?"

**Section mapping:** answers propagate to → phase `## Key Insights`

## Question Generation Rules

1. Read plan.md + all phase files
2. Scan for detection keywords above — matched categories get priority
3. Identify: unstated assumptions, missing alternatives, vague scope boundaries
4. Generate 3-5 questions (budget from hook injection, default: 5)
5. Prioritize: architecture > assumptions > scope > risk > tradeoffs
6. Skip questions where the answer is obvious from the plan content

## Question Format Rules

- Each question MUST have 2-4 concrete options (not open-ended)
- Mark the recommended option with "(Recommended)" suffix
- "Other" option is automatic — always appended, don't include explicitly
- Group related questions (max 4 per AskUserQuestion call)

## Recording Rules

For each answered question, record in plan.md `## Validation Log`:

```markdown
### Q{N}: {full question text}
**Category:** {Architecture | Assumptions | Scope | Risk | Tradeoffs}
**Options presented:** {list all options}
**Answer:** {selected option or custom text}
**Rationale:** {user's reasoning if provided, or "—"}
**Impact:** {which phase sections were updated}
```

## Answer Propagation

After user answers:
1. Map answer category to target section (see section mapping above)
2. Update affected phase file's target section with clarification
3. Update "Risk Assessment" if risk tolerance changed
4. Add `"Validated: {summary}"` to phase Overview
5. If answer reveals scope change: update plan.md Constraints (In Scope / Out of Scope)
