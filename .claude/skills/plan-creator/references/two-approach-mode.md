# Two-Approach Mode Reference

## When to Use

Use `--two` when the task involves a **genuine architectural trade-off** where both options are viable:
- Monolith vs microservices
- Synchronous vs asynchronous processing
- Server-side rendering vs client-side rendering
- Do NOT use for: implementation details, style choices, or when one option is clearly better

## Approach File Template

Generate `plan-approach-a.md` and `plan-approach-b.md` in `{plan-dir}/`:

```markdown
# Approach {A|B}: {Name}

## Goal
{One sentence: what this approach achieves}

## Architecture
{How the system is structured under this approach}

## Pros
- {Concrete advantage}
- {Concrete advantage}

## Cons
- {Concrete trade-off or limitation}
- {Concrete trade-off or limitation}

## Effort Estimate
{S | M | L | XL} — {brief justification}

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| {risk} | L/M/H | L/M/H | {mitigation} |
```

## Trade-Off Matrix Template

Generate `trade-off-matrix.md` in `{plan-dir}/`:

```markdown
# Trade-Off Matrix

| Dimension | Approach A | Approach B |
|-----------|-----------|-----------|
| Effort | | |
| Risk | | |
| Maintainability | | |
| Performance | | |
| Reversibility | | |
```

## Selection Flow (step-04)
After semantic checks pass on BOTH approach files, present via AskUserQuestion:

```json
{
  "questions": [{
    "question": "Select the implementation approach",
    "header": "Approach Selection",
    "options": [
      { "label": "Approach A: {name}", "description": "{1-line summary from approach file}" },
      { "label": "Approach B: {name}", "description": "{1-line summary from approach file}" }
    ],
    "multiSelect": false
  }]
}
```

## Post-Selection Actions

1. Selected → generate `plan.md` + `phase-XX-*.md` files from it.
2. Non-selected → move to `{plan-dir}/archived/` (preserve, do not delete).
3. Set `selected_approach = "a"` or `"b"` in session state.
4. Red-team (step-05) reviews ONLY the selected approach's phase files.
5. Add `selected_approach` to `.plan-state.json` in step-08.
