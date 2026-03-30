# Skill: Cross-Session Learning Persistence

**Purpose:** Capture key decisions, successful patterns, and corrections from each session so that learnings persist across sessions.

## When to Use

Invoke this skill at the END of every session, before the session closes. This is a mandatory step — no session ends without capture.

---

## Steps

### Step 1: Extract Patterns (category: pattern)

Identify reusable approaches that worked in this session:
- Code patterns that solved problems efficiently
- Architecture patterns worth standardizing
- Process patterns that saved time or prevented errors
- Debugging approaches that found issues quickly

For each pattern, note: what it does, why it's valuable, and **applicable-when** (one sentence: under what conditions should future agents use this?).

### Step 2: Extract Decisions (category: decision)

Review every significant decision made:
- Technical choices (library selection, architecture patterns, API design)
- Process choices (workflow changes, tool configuration)
- Scope decisions (what was included/excluded)
- Tag each as: `GOOD_CALL` | `BAD_CALL` | `SURPRISE` | `TRADEOFF`

Format:
```
- Decision: [what was decided]
  Context: [why this decision was made]
  Outcome: [GOOD_CALL/BAD_CALL/SURPRISE/TRADEOFF]
  Alternatives rejected: [what else was considered]
```

### Step 3: Extract Failures (category: failure)

Identify mistakes, blockers, and wasted effort:
- Incorrect assumptions that were corrected
- Wrong approaches that were redirected
- Misunderstood requirements that were clarified
- Blockers encountered and how they were resolved
- Wasted effort: work done that turned out unnecessary

For each failure, identify the **root cause** (not just the symptom) and a **prevention rule** (what should future agents do differently?).

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
  "version": "1.0.0",
  "patterns": [
    {
      "id": "unique-string-id",
      "type": "success" | "correction",
      "category": "pattern" | "decision" | "failure",
      "severity": "critical" | "standard",
      "scope": "relative/path/from/root",
      "context": "when this pattern applies",
      "applicable_when": "one sentence — conditions for future agents to use this",
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
- `category`: which extraction step produced this — `"pattern"`, `"decision"`, or `"failure"`.
- `severity`: `"critical"` if it affects multiple features or would save ≥30 min; `"standard"` otherwise.
- `applicable_when`: one sentence describing when future agents should apply this learning.
- `scope` (optional): relative path from project root where the pattern applies (e.g., `"packages/api"`). Omit for project-wide patterns.

**File structure:** The root object includes `version`, `patterns` array, and `metadata`. Only modify the `patterns` array; preserve `version` and `metadata` fields. Update `metadata.sessions_captured` count and `metadata.last_updated` timestamp on each capture.

**Backward compatibility:** Existing entries without `category`, `severity`, or `applicable_when` fields remain valid. Missing `severity` defaults to `"standard"` during pattern extraction.

---

## Example patterns.json

```json
{
  "patterns": [
    {
      "id": "always-validate-dto",
      "type": "success",
      "category": "pattern",
      "severity": "critical",
      "scope": "packages/api",
      "context": "NestJS endpoint development",
      "applicable_when": "Creating any API endpoint that accepts user input",
      "pattern": "Always create a DTO with class-validator decorators for every endpoint that accepts input",
      "frequency": 5,
      "lastSeen": "2026-03-25"
    },
    {
      "id": "no-process-env-direct",
      "type": "correction",
      "category": "failure",
      "severity": "standard",
      "scope": "packages/api",
      "context": "NestJS configuration",
      "applicable_when": "Accessing environment variables in NestJS services or controllers",
      "pattern": "Do not use process.env directly — always use ConfigService. Human corrected this in session.",
      "frequency": 2,
      "lastSeen": "2026-03-20"
    },
    {
      "id": "kebab-case-file-names",
      "type": "success",
      "category": "decision",
      "severity": "standard",
      "context": "file naming across all packages",
      "applicable_when": "Creating any new file in the project",
      "pattern": "Use kebab-case for all file names — no scope means applies project-wide",
      "frequency": 4,
      "lastSeen": "2026-03-25"
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
