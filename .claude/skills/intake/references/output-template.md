# Output Template

Fill-in-the-blank format for mk:intake analysis reports.
Replace all `[bracketed placeholders]` with actual values. Omit optional sections when not applicable.

## Contents

- [Intake Analysis — [TICKET-ID]](#intake-analysis-ticket-id)
  - [Product Area: [area] (confidence: HIGH | MEDIUM | LOW)](#product-area-area-confidence-high-medium-low)
  - [Completeness: [score]/100 ([Ready | Needs clarification | Blocked | Return to author])](#completeness-score100-ready-needs-clarification-blocked-return-to-author)
  - [Design Context](#design-context)
  - [Technical Considerations](#technical-considerations)
  - [Root Cause (bugs only)](#root-cause-bugs-only)
  - [Suggested Breakdown](#suggested-breakdown)
  - [Related Tickets](#related-tickets)
  - [Suggested PIC](#suggested-pic)
  - [Jira Actions](#jira-actions)
- [Posting Back](#posting-back)
- [Minimal Output (score < 40)](#minimal-output-score-40)
- [Intake Analysis — [TICKET-ID]](#intake-analysis-ticket-id)


---

```markdown
## Intake Analysis — [TICKET-ID]

**Type:** [Bug | Feature | Task | Security]
**Source:** [Jira | Linear | GitHub | Manual paste]

---

### Product Area: [area] (confidence: HIGH | MEDIUM | LOW)

Domain signals matched: [list of keywords that triggered classification]
Routing: [complexity level] → [workflow intensity] → [model tier]

---

### Completeness: [score]/100 ([Ready | Needs clarification | Blocked | Return to author])

Missing:
- [Dimension name]: [specific ask — what exactly is needed]
- [Dimension name]: [specific ask]

(Omit this list if score ≥ 80)

---

### Design Context
(Include only if ticket has attachments)

- [N] attachments analyzed
- UI elements detected: [list]
- Layout: [description]
- States visible: [default / error / loading / empty]
- Design notes: [observations relevant to implementation]
- Gaps: [anything that could not be analyzed and why]

---

### Technical Considerations

- Affected files: [file paths from mk:scout scan]
- Test coverage: [covered | gap in X area]
- Complexity estimate: [low | medium | high] — [brief justification]
- Breaking change risk: [none | low | high] — [brief justification]

---

### Root Cause (bugs only)

Method: [5 Whys | Ishikawa | 8D]

[Root cause summary — one clear statement of WHY the bug occurs]

Causal chain:
1. [symptom]
2. [proximate cause]
3. [contributing factor]
4. [root cause]

---

### Suggested Breakdown

1. [Action verb] [what] in [file path or component]
2. [Action verb] [what]
3. [Action verb] [what]

---

### Related Tickets

- [TICKET-ID]: [title] — [relevance]
- (Omit if no related tickets found or search not available)

---

### Suggested PIC

- [Name] — [domain owner, N open tickets in this area]
- (Omit if product-areas.yaml not available or PIC not determinable)

---

### Jira Actions
(Include only if Atlassian MCP is available)

- [ ] Transition [TICKET-ID] to [state]
- [ ] Link [TICKET-ID] [relationship] [TARGET-ID]
- [ ] Assign to [pic-username]
- [ ] Set [field] to [value]

Run: `/mk:jira` to execute these actions
```

---

## Posting Back

After generating the report:
- **MCP available**: Post as comment to originating ticket via MCP write tool
- **No MCP**: Output to user and suggest copy-paste

## Minimal Output (score < 40)

When returning a ticket to the author, use this condensed format:

```markdown
## Intake Analysis — [TICKET-ID]

This ticket cannot be analyzed — too many required fields are missing (score: [N]/100).

Please add the following before re-submitting:
- [Dimension]: [specific ask]
- [Dimension]: [specific ask]
- [Dimension]: [specific ask]
```