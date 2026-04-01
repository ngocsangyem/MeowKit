# Validation Question Framework

Generate 3-5 critical questions from plan content before Gate 1. Hard mode only.

## Question Categories

### 1. Architecture
- "Why {chosen approach} instead of {obvious alternative}?"
- "What happens if {external dependency} is unavailable?"
- "Is {component} the right abstraction level?"

### 2. Assumptions
- "The plan assumes {X}. Is this still true?"
- "Phase {N} depends on {Y} being available. Who confirms this?"
- "The technical approach assumes {pattern}. Does the codebase follow this?"

### 3. Scope
- "Phase {N} includes {Y}. Is this in scope or should it be deferred?"
- "The plan doesn't mention {related concern}. Intentional exclusion?"
- "Is {deliverable} needed for MVP or can it be a follow-up?"

### 4. Risk
- "What's the fallback if {risk} materializes?"
- "Phase {N} has no risks listed. What could go wrong?"
- "The highest risk is {X}. Is the mitigation sufficient?"

### 5. Tradeoffs
- "This approach trades {simplicity} for {flexibility}. Acceptable?"
- "Faster implementation means {technical debt}. OK for now?"
- "Using {library} adds a dependency. Worth the tradeoff?"

## Question Generation Rules

1. Read plan.md + all phase files
2. Identify: unstated assumptions, missing alternatives, vague scope boundaries
3. Generate 3-5 questions (budget from hook injection, default: 5)
4. Prioritize: architecture > assumptions > scope > risk > tradeoffs
5. Skip questions where the answer is obvious from the plan content

## Answer Propagation

After user answers:
1. Update affected phase file's "Key Insights" with clarification
2. Update "Risk Assessment" if risk tolerance changed
3. Add `"Validated: {summary}"` to phase Overview
