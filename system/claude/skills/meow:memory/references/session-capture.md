# Skill: Cross-Session Learning Persistence

**Purpose:** Capture key decisions, successful patterns, and corrections from each session so that learnings persist across sessions.

## When to Use

Invoke this skill at the END of every session, before the session closes. This is a mandatory step — no session ends without capture.

---

## Steps

### Step 1: Extract Key Decisions

Review the session and list every decision that was made:
- Technical choices (library selection, architecture patterns, API design)
- Process choices (workflow changes, tool configuration)
- Scope decisions (what was included/excluded)

Format:
```
- Decision: [what was decided]
  Context: [why this decision was made]
  Alternatives rejected: [what else was considered]
```

### Step 2: Extract Successful Patterns

Identify approaches that worked well in this session:
- Code patterns that solved problems efficiently
- Debugging approaches that found issues quickly
- Communication patterns that clarified requirements

### Step 3: Extract Corrections

Identify mistakes made during the session and the human's corrections:
- Incorrect assumptions that were corrected
- Wrong approaches that were redirected
- Misunderstood requirements that were clarified

These are the most valuable learnings — they prevent repeat mistakes.

### Step 4: Append to memory/lessons.md

Write to `memory/lessons.md` (create if it does not exist). This file is human-readable.

Format:
```markdown
## Session: YYYY-MM-DD — [Brief description of what was worked on]

### Decisions
- [Decision 1]
- [Decision 2]

### What Worked
- [Pattern 1]
- [Pattern 2]

### Corrections
- [Mistake → Correction]
- [Mistake → Correction]

---
```

Append new sessions at the bottom of the file. Do not modify previous session entries.

### Step 5: Update memory/patterns.json

Write to `memory/patterns.json` (create if it does not exist). This file is machine-readable.

**Schema:**
```json
{
  "patterns": [
    {
      "id": "unique-string-id",
      "type": "success" | "correction",
      "context": "when this pattern applies",
      "pattern": "what to do (or what not to do)",
      "frequency": 1,
      "lastSeen": "YYYY-MM-DD"
    }
  ]
}
```

**Rules:**
- If a pattern already exists (matching context + pattern), increment `frequency` and update `lastSeen`.
- If a pattern is new, add it with `frequency: 1`.
- Use descriptive `id` values (e.g., `"nestjs-guard-on-all-controllers"`, `"avoid-any-type"`).
- `type: "success"` = something that works well and should be repeated.
- `type: "correction"` = something that was wrong and should be avoided.

---

## Example patterns.json

```json
{
  "patterns": [
    {
      "id": "always-validate-dto",
      "type": "success",
      "context": "NestJS endpoint development",
      "pattern": "Always create a DTO with class-validator decorators for every endpoint that accepts input",
      "frequency": 5,
      "lastSeen": "2026-03-25"
    },
    {
      "id": "no-process-env-direct",
      "type": "correction",
      "context": "NestJS configuration",
      "pattern": "Do not use process.env directly — always use ConfigService. Human corrected this in session.",
      "frequency": 2,
      "lastSeen": "2026-03-20"
    }
  ]
}
```

## Validation

- [ ] lessons.md has a new entry for this session
- [ ] patterns.json is valid JSON
- [ ] Existing patterns have updated frequency/lastSeen (not duplicated)
- [ ] New patterns have frequency 1
- [ ] Both files are saved
