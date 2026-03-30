# Skill: Pattern Extraction (Self-Improving Loop)

**Purpose:** After accumulating enough session data, extract high-frequency patterns and propose them as permanent rules in CLAUDE.md.

## When to Use

Invoke this skill after approximately 10 sessions have been captured (check `memory/patterns.json` for entry count). Can also be triggered manually at any time.

---

## Steps

### Step 1: Read Accumulated Patterns

Read `memory/patterns.json` and load all patterns.

```bash
cat memory/patterns.json | python -m json.tool
```

### Step 2: Identify Promotion Candidates

Filter patterns meeting ALL of these criteria:
1. `frequency >= 3` — appeared across multiple sessions
2. `severity == "critical"` OR `frequency >= 5` — high impact or very recurrent
3. **Generalizable** — not so implementation-specific it's useless elsewhere
4. **Saves ≥30 min** if known in advance — worth the CLAUDE.md context cost

Sort by frequency (descending), then by lastSeen (most recent first).

**Legacy entries:** Patterns without a `severity` field default to `"standard"`. They can still be promoted if frequency ≥ 5 (strong recurrence signal compensates for unknown severity).

**Scope awareness:** Patterns with a `scope` field apply only within that path. When proposing rules, note the scope — scoped patterns become package-specific rules, not project-wide CLAUDE.md entries. Project-wide patterns (no `scope`) are candidates for CLAUDE.md rules.

### Step 3: Group by Category

Group the high-frequency patterns into categories:

| Category | Pattern Type Examples |
|----------|---------------------|
| **Coding** | Code conventions, anti-patterns, library usage |
| **Review** | Review process, checklist items, common issues |
| **Planning** | Planning approaches, estimation patterns, scope decisions |
| **Security** | Security rules, vulnerability patterns, auth requirements |
| **Testing** | Test patterns, coverage expectations, TDD practices |
| **Communication** | How to interact with human, clarification patterns |

### Step 4: Propose Additions to CLAUDE.md

For each high-frequency pattern, draft a rule for the CLAUDE.md rules section:

```markdown
### Proposed Rule: [Rule Name]

**Source:** pattern ID `[id]`, frequency: [N], type: [success/correction]
**Scope:** [project-wide | specific path, e.g., packages/api]
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
- **Reject** — do not add (pattern may be context-specific, not universal)
- **Defer** — revisit after more sessions

**Do NOT automatically modify CLAUDE.md.** This step requires explicit human approval.

### Step 6: Update Pattern Status

After human review:
- Accepted patterns: add a `"promoted": true` field in patterns.json
- Rejected patterns: add a `"rejected": true` field (prevents re-proposal)
- Deferred patterns: no change (will be re-proposed next time)

---

## Example Extraction

Given patterns.json contains:
```json
{
  "patterns": [
    { "id": "always-validate-dto", "type": "success", "frequency": 7, ... },
    { "id": "no-process-env-direct", "type": "correction", "frequency": 5, ... },
    { "id": "use-composable-not-mixin", "type": "success", "frequency": 4, ... },
    { "id": "check-rls-on-new-table", "type": "correction", "frequency": 3, ... },
    { "id": "one-off-debug-pattern", "type": "success", "frequency": 1, ... }
  ]
}
```

Patterns with frequency >= 3 are extracted:
1. always-validate-dto (freq 7) → Coding rule
2. no-process-env-direct (freq 5) → Security rule
3. use-composable-not-mixin (freq 4) → Coding rule
4. check-rls-on-new-table (freq 3) → Security rule

Pattern "one-off-debug-pattern" (freq 1) is NOT extracted.

---

## The Self-Improving Loop

```
Sessions → session-capture → patterns.json
                                   ↓
                          pattern-extraction (this skill)
                                   ↓
                          Proposed rules → Human review
                                   ↓
                          Accepted rules → CLAUDE.md
                                   ↓
                          Future sessions follow new rules
                                   ↓
                          New patterns emerge → repeat
```

This creates a feedback loop where the AI agent improves over time based on accumulated experience with the specific project and team.

## Validation

- [ ] Only patterns with frequency >= 3 are proposed
- [ ] Patterns are grouped by category
- [ ] Each proposal includes source evidence
- [ ] Human approval is required before any CLAUDE.md changes
- [ ] patterns.json is updated with promoted/rejected status after review
