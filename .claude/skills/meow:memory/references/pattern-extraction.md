# Skill: Pattern Extraction (Self-Improving Loop)

**Purpose:** After accumulating enough session data, extract high-frequency patterns from split JSON files and propose them as permanent rules in CLAUDE.md.

## Contents

- [When to Use](#when-to-use)
- [Steps](#steps)
  - [Step 1: Read Accumulated Patterns from Split JSON Files](#step-1-read-accumulated-patterns-from-split-json-files)
  - [Step 2: Identify Promotion Candidates](#step-2-identify-promotion-candidates)
  - [Step 3: Group by Category](#step-3-group-by-category)
  - [Step 4: Propose Additions to CLAUDE.md](#step-4-propose-additions-to-claudemd)
  - [Proposed Rule: [Rule Name]](#proposed-rule-rule-name)
  - [Step 5: Human Approval](#step-5-human-approval)
  - [Step 6: Update Pattern Status](#step-6-update-pattern-status)
- [The Self-Improving Loop](#the-self-improving-loop)
- [Validation](#validation)


## When to Use

Invoke after approximately 10 sessions have been captured (check combined entry count across `fixes.json`, `review-patterns.json`, `architecture-decisions.json`). Can also be triggered manually at any time.

---

## Steps

### Step 1: Read Accumulated Patterns from Split JSON Files

Read all three split JSON files and collect pattern entries:

```bash
cat .claude/memory/fixes.json | python3 -m json.tool
cat .claude/memory/review-patterns.json | python3 -m json.tool
cat .claude/memory/architecture-decisions.json | python3 -m json.tool
```

**Do NOT read `patterns.json`** — it is a deprecated stub. The authoritative data is in the three split files above.

### Step 2: Identify Promotion Candidates

Filter patterns meeting ALL of these criteria:
1. `frequency >= 3` — appeared across multiple sessions
2. `severity == "critical"` OR `frequency >= 5` — high impact or very recurrent
3. **Generalizable** — not so implementation-specific it's useless elsewhere
4. **Saves ≥30 min** if known in advance — worth the CLAUDE.md context cost

Sort by frequency (descending), then by lastSeen (most recent first).

**Scope awareness:** Patterns with a `domain` field scoped to a specific subsystem may become package-specific notes rather than project-wide CLAUDE.md entries. Project-wide patterns are the primary CLAUDE.md candidates.

### Step 3: Group by Category

Group the high-frequency patterns into categories:

| Category | Examples |
|----------|---------|
| **Coding** | Code conventions, anti-patterns, library usage |
| **Review** | Review process, checklist items, common issues |
| **Planning** | Planning approaches, scope decisions |
| **Security** | Security rules, vulnerability patterns |
| **Testing** | Test patterns, coverage expectations |
| **Communication** | Clarification patterns, interaction habits |

### Step 4: Propose Additions to CLAUDE.md

For each high-frequency pattern, draft a rule:

```markdown
### Proposed Rule: [Rule Name]

**Source:** `fixes.json` / `review-patterns.json` / `architecture-decisions.json`, id: `[id]`, frequency: [N]
**Category:** [coding/review/planning/security/testing/communication]

**Rule:**
[Clear, actionable rule statement]

**Context:**
[When this rule applies]

**Evidence:**
[Summary of sessions where this pattern appeared]
```

### Step 5: Human Approval

Present all proposed rules to the human. The human decides:
- **Accept** — add the rule to CLAUDE.md
- **Modify** — change the wording, then add
- **Reject** — do not add (pattern may be context-specific)
- **Defer** — revisit after more sessions

**Do NOT automatically modify CLAUDE.md.** This step requires explicit human approval.

### Step 6: Update Pattern Status

After human review, update the relevant split JSON file entry:
- Accepted: add `"promoted": true` field
- Rejected: add `"rejected": true` field (prevents re-proposal)
- Deferred: no change (will be re-proposed next time)

---

## The Self-Improving Loop

```
Sessions → session-capture → topic files (fixes.md, review-patterns.md, etc.)
                                  ↓
                         pattern-extraction (this skill)
                         reads fixes.json, review-patterns.json,
                         architecture-decisions.json
                                  ↓
                         Proposed rules → Human review
                                  ↓
                         Accepted rules → CLAUDE.md
                                  ↓
                         Future sessions follow new rules
                                  ↓
                         New patterns emerge → repeat
```

## Validation

- [ ] Only patterns with frequency >= 3 are proposed
- [ ] Patterns are grouped by category
- [ ] Each proposal includes source evidence and split file reference
- [ ] Human approval is required before any CLAUDE.md changes
- [ ] Split JSON files updated with promoted/rejected status after review
- [ ] `patterns.json` (deprecated stub) was NOT used as a data source