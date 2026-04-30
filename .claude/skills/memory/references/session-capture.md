# Skill: Cross-Session Learning Persistence

**Purpose:** Capture key decisions, successful patterns, and corrections from each session so that learnings persist across sessions via topic files.

## Contents

- [When to Use](#when-to-use)
- [Steps](#steps)
  - [Step 1: Extract Patterns (category: pattern)](#step-1-extract-patterns-category-pattern)
  - [Step 2: Extract Decisions (category: decision)](#step-2-extract-decisions-category-decision)
  - [Step 3: Extract Failures (category: failure / bug-class)](#step-3-extract-failures-category-failure-bug-class)
  - [Step 4: Write to topic files](#step-4-write-to-topic-files)
- [YYYY-MM-DD — [Brief description] (status: live-captured, severity: critical|standard)](#yyyy-mm-dd-brief-description-status-live-captured-severity-criticalstandard)
  - [What happened](#what-happened)
  - [Prevention rule](#prevention-rule)
  - [Step 5: Immediate capture alternative](#step-5-immediate-capture-alternative)
- [Validation](#validation)


## When to Use

Invoke at the END of every session, before the session closes. This is a mandatory step — no session ends without capture.

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

### Step 3: Extract Failures (category: failure / bug-class)

Identify mistakes, blockers, and wasted effort:
- Incorrect assumptions that were corrected
- Wrong approaches that were redirected
- Misunderstood requirements that were clarified
- Blockers encountered and how they were resolved

For each failure, identify the **root cause** and a **prevention rule** (what should future agents do differently?). These are the most valuable learnings.

### Step 4: Write to topic files

Write to the appropriate topic file based on category:

| Category | Markdown file | JSON file |
|----------|--------------|-----------|
| Bug fix / failure / shell/code pattern | `memory/fixes.md` | `memory/fixes.json` |
| Review pattern / architecture insight | `memory/review-patterns.md` | `memory/review-patterns.json` |
| Architectural decision | `memory/architecture-decisions.md` | `memory/architecture-decisions.json` |
| Security finding | `memory/security-notes.md` | — |

**Do NOT write to `memory/lessons.md`** — it is an archived stub. Topic files are the active write targets.

#### Markdown format (append to topic file):

```markdown
## YYYY-MM-DD — [Brief description] (status: live-captured, severity: critical|standard)

### What happened
[Description]

### Prevention rule
[Actionable rule for future agents]
```

#### JSON format (append pattern entry to split JSON file):

```json
{
  "id": "unique-kebab-case-id",
  "type": "failure" | "success",
  "category": "bug-class" | "pattern" | "decision",
  "severity": "critical" | "standard",
  "domain": ["keyword1", "keyword2"],
  "applicable_when": "one sentence — conditions for future agents to use this",
  "context": "when this pattern applies",
  "pattern": "what to do (or what not to do)",
  "frequency": 1,
  "lastSeen": "YYYY-MM-DD"
}
```

**Rules:**
- If a pattern already exists (matching id), increment `frequency` and update `lastSeen`.
- If a pattern is new, add it with `frequency: 1`.
- Use descriptive `id` values (e.g., `"nestjs-guard-on-all-controllers"`, `"grep-e-on-macos"`).
- `severity: critical` if it affects multiple features or would save ≥30 min; `standard` otherwise.

### Step 5: Immediate capture alternative

For quick, crash-resilient capture during the session, type:
- `##pattern: bug-class <description>` → auto-writes to `fixes.json`
- `##decision: <description>` → auto-writes to `architecture-decisions.json`
- `##note: <text>` → staging in `quick-notes.md` (classify here at Reflect)

---

## Validation

- [ ] Relevant topic files have new entries for this session
- [ ] JSON files are valid JSON (no trailing commas)
- [ ] Existing patterns have updated frequency/lastSeen (not duplicated)
- [ ] New patterns have frequency 1
- [ ] No writes to `lessons.md` (archived stub)