## Brainstorm: [PROMPT_SUMMARY]

**Technique:** [TECHNIQUE_USED] · **Generated:** [TIMESTAMP] · **Depth:** quick

### Problem Restatement

[One paragraph confirming what was actually asked and the key constraint that bounds the solution space. Must be confirmed by the user before ideas were generated.]

**Binding constraint:** [the single thing that, if violated, makes any solution unacceptable]
**Success criterion:** [what good looks like after the chosen approach ships]
**Excluded scope:** [what is explicitly not being solved in this brainstorm]

### Discovery Trace

| # | Question asked | User answer (summary) |
|---|----------------|------------------------|
| 1 | [...] | [...] |

(Cap: 3 questions. Omit this section if no discovery was needed.)

### Scope Decision

- [ ] Single concern — proceeded
- [ ] Multi-concern — decomposed; this report covers: **[chosen sub-problem]**. Other concerns deferred to separate brainstorm sessions.

### Technique Selection

**Chosen:** `[technique-name].md`
**Why this over alternatives:** [one sentence — typically references the SKILL.md tiebreaker order or a problem-shape match]

### Ideas

**[#1] [MNEMONIC_TITLE]**
  Concept: [2-3 sentence mechanism — what it is and how it works]
  Novelty: [What makes this non-obvious; why a senior eng wouldn't dismiss it]
  Category: [e.g., infra / workflow / UX / data-shape / business-model]

**[#2] [MNEMONIC_TITLE]** … (repeat shape)

**[#3] [MNEMONIC_TITLE]** …

> **— Anti-bias pivot —**
> Categories so far: [list]. Pivoting to: **[orthogonal category]**.

**[#4] [MNEMONIC_TITLE]** … (first idea from new category)

(Continue up to 8 ideas. Generate ALL before evaluating any.)

### Category Distribution

| Category | Count |
|----------|:-----:|
| [category-1] | N |
| [category-2] | N |

**Anti-bias check:** [if all ideas cluster in 1-2 categories, flag: "Pivot did not produce real divergence. Consider a focused session on [orthogonal category]."]

### Challenge Pass

| Check | Result |
|---|---|
| Duplicate architecture | [pass/fail + one sentence] |
| Hard constraint fit | [pass/fail + one sentence] |
| Category diversity | [pass/fail + one sentence] |
| Conservative drift | [pass/fail + one sentence] |
| Missing failure mode | [pass/fail + one sentence] |

### Top 3 to Explore (qualitative — no scoring)

These are subjective picks after the challenge pass, not formal scoring. For weighted scoring, re-run with `--depth deep`.

1. **[MNEMONIC_TITLE]** — [one sentence why this stands out vs the others]
2. **[MNEMONIC_TITLE]** — [one sentence why]
3. **[MNEMONIC_TITLE]** — [one sentence why]

### Ready-to-Plan Packet

Use only if the user chooses one idea to plan. Do not invoke `mk:plan-creator` automatically.

```yaml
problem: "[confirmed problem]"
binding_constraint: "[binding constraint]"
success_criterion: "[success criterion]"
excluded_scope: "[excluded scope]"
selected_idea: "[idea title or empty until user chooses]"
why_selected: "[qualitative rationale]"
scores: {}
touchpoints: []
rejected_alternatives:
  - idea: "[idea title]"
    reason: "[why it lost or why it remains a secondary option]"
open_risks: []
planning_questions: []
report_path: "plans/reports/[report-name].md"
```

### Next Steps

- Drill deeper into a specific idea → "explore idea #N"
- Ready to plan → ask before passing the packet to `mk:plan-creator`
- Score these ideas → re-run with `--depth deep`
- Need product validation first → `mk:office-hours`
