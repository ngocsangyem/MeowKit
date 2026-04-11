# Pre-Screen (Layer 0-1)

Run BEFORE mode selection (Step 0). Fast-fail on unfinished plans. **Never rejects — always returns for amendment with actionable guidance.**

## Layer 0: Placeholder Scan

Scan plan BODY text for anti-patterns indicating unfinished thinking.

### Flag Patterns

```
"TBD", "implement later", "similar to [X]",
"add appropriate", "handle edge cases" (without concrete examples),
"if time permits", "pending approval"
```

### Exclusions (do NOT flag these)

- Lines starting with `##` or `###` (headers like "## TODO List" are legitimate plan-creator output)
- Lines inside fenced code blocks (``` delimiters)
- Lines in "NOT in scope" or "Deferred" sections (vague language is expected for deferred items)

### Mode-Aware Exceptions

- **REDUCTION mode:** Skip placeholder scan entirely — sparse plans are expected
- **HOLD mode:** "TBD" in deferred sections is acceptable

### If Patterns Found

List flagged items with file locations. Present:

> "These sections need specifics before CEO review can evaluate:
> - [flagged item 1] at [location]
> - [flagged item 2] at [location]
>
> Run `/meow:plan` to amend, or proceed with known gaps."

AskUserQuestion: "Plan has [N] unfinished sections. How to proceed?"
- **"Amend first"** → stop review, user returns to plan-creator
- **"Proceed with gaps"** → continue to Layer 1, note gaps in final verdict

### Anchors

**PASS:** Plan with 0 flagged patterns in body text → proceed to Layer 1.

**AMEND:** Plan step says "add appropriate error handling" with no specifics → return with "Specify which errors (network timeout, auth failure, rate limit) and handling strategy (retry, fallback, user notification)."

---

## Layer 1: Structural Completeness

Check plan has required sections per plan-creator template:

- [ ] Problem statement (who has the problem, what is it)
- [ ] Success criteria (binary pass/fail, measurable)
- [ ] Technical approach (how, not just what)
- [ ] Scope (explicit in/out)
- [ ] Risk assessment (≥3 risks with mitigations)

### If Section Missing

AskUserQuestion: "Plan is missing: [section list]. How to proceed?"
- **"Amend (return to plan-creator)"** → stop review
- **"Proceed anyway"** → continue, note gaps in final verdict

---

## Layer 1b: Coverage Mapping (Manual)

Read requirements from problem statement. Read tasks from plan phases. Check each requirement maps to ≥1 task. Report as table:

```markdown
| Requirement | Mapped Task(s) | Status |
|-------------|---------------|--------|
| User can reset password | Phase 2, Step 3 | ✅ COVERED |
| Email notification sent | — | ❌ GAP |
| Rate limiting on login | Phase 1, Step 5 | ✅ COVERED |
```

### If Gaps Found

Present coverage table to user. AskUserQuestion: "[N] requirements have no mapped tasks. How to proceed?"
- **"Amend plan"** → stop review
- **"Accept gaps"** → continue, note in final verdict

### If Plan Has No Explicit Requirements List

Extract implied requirements from problem statement. Note: "Requirements extracted from prose — not an explicit list. Consider adding a Requirements section to the plan."

---

## Integration

Pre-screen runs as the FIRST step of CEO review, before mode selection (Step 0). The flow:

```
User invokes /meow:plan-ceo-review [plan-path]
  → Layer 0: Placeholder scan
  → Layer 1: Structural completeness
  → Layer 1b: Coverage mapping
  → Step 0: Mode selection (EXPANSION/SELECTIVE/HOLD/REDUCTION)
  → Step 0.5: Two-lens evaluation
  → Sections 1-11: Deep review
  → Verdict + handoff
```

If any pre-screen layer surfaces issues, user decides: amend or proceed. Pre-screen NEVER blocks autonomously.
