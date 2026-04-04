# Ticket Completeness Checklist

Score tickets against 8 dimensions on a 100-point scale.

## Scoring Table

| Dimension | Weight | What to Check | Score If Missing |
|-----------|--------|---------------|-----------------|
| **Goal/Problem** | 20 | Clear problem statement or desired outcome. One sentence minimum. | -20 |
| **Acceptance Criteria** | 20 | Binary pass/fail conditions. "It works" is not a criterion. | -20 |
| **Scope** | 15 | In-scope AND out-of-scope explicitly stated. | -15 |
| **Steps to Reproduce** (bugs) | 15 | Exact repro steps with expected vs actual behavior. | -15 |
| **Technical Constraints** | 10 | What must NOT change: backward compat, perf limits, APIs. | -10 |
| **Priority/Severity** | 10 | P1-P4 or equivalent with justification. Not just a label. | -10 |
| **Dependencies** | 10 | Blocked by / blocks other work. "None" is a valid answer. | -10 |
| **Design/Visual** (UI tasks) | 10 | Mockup, screenshot, Figma link, or description of expected UI. | -10 |

**Score = 100 − sum(missing weights)**

### Design/Visual Dimension Note

Only applies when the task involves UI changes visible to users.
For backend-only tasks: redistribute 10 points → Goal/Problem (+5) and Acceptance Criteria (+5).
This makes the effective weights for backend tasks: Goal 25, AC 25, Scope 15, Repro 15, Constraints 10, Priority 10, Dependencies 10.

## Thresholds

| Score | Status | Action |
|-------|--------|--------|
| 80-100 | Ready | Proceed to meow:cook or meow:fix |
| 60-79 | Minor clarification needed | List missing items, proceed with questions |
| 40-59 | Significant gaps | Block until clarified — do not start implementation |
| 0-39 | Insufficient | Return to author with specific missing items |

## Evaluation Instructions

1. Read ticket completely before scoring any dimension.
2. Score each dimension independently — do not let overall quality bias individual scores.
3. For bugs: Steps to Reproduce is non-negotiable. Score 0 if absent, even partially.
4. For features: Acceptance Criteria is non-negotiable. Vague criteria = missing.
5. Output: score, threshold band, and specific list of missing items with asks.

## Output Format

```
Completeness: [score]/100 ([band])
Missing:
- Acceptance Criteria: need binary pass/fail conditions (e.g., "User can log in with email+password")
- Steps to Reproduce: need exact repro steps with expected vs actual
- Design/Visual: need Figma link or screenshot of expected UI state
```
