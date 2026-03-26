# /plan — Phase 1: Planning

## Usage

```
/plan [feature description]
```

## Behavior

Triggers Phase 1 of the MeowKit workflow. Output is documentation only — no code is written during /plan.

### Execution Steps

1. **Challenge premises.** Run the `premise-challenge` skill against the feature description. Ask:
   - What assumptions are we making?
   - What could invalidate this plan?
   - Are there simpler alternatives we haven't considered?
   - What would make us abandon this approach?

2. **Product lens.** Evaluate the feature from a product perspective:
   - Is this the right thing to build?
   - What specific problem does it solve?
   - Who benefits from this? (user persona, team, business)
   - What does success look like? (measurable criteria)
   - What is the cost of NOT building this?

3. **Engineering lens.** Evaluate the feature from a technical perspective:
   - Is this the right way to build it?
   - What are the alternative approaches? (list at least 2)
   - What are the technical risks?
   - What existing code/systems are affected?
   - What are the dependencies and integration points?
   - Estimated scope: files changed, new files, migration needed?

4. **Generate plan file.** Use the `plan-template` skill to produce a structured plan document. Write to:
   ```
   tasks/plans/YYMMDD-feature-name.md
   ```
   The plan must include all required sections: Problem, Success Criteria, Technical Approach (per gate-rules).

5. **Print plan summary and request approval (Gate 1).** Display:
   - One-paragraph summary of the plan
   - Key risks identified
   - Estimated complexity tier
   - Explicit prompt: ask the human to approve, request changes, or reject

### Gate 1 Enforcement

Per `rules/gate-rules.md`, the following must be true before proceeding:
- Plan file exists at `tasks/plans/YYMMDD-name.md`
- All required sections are populated (Problem, Success Criteria, Technical Approach)
- Human has explicitly typed approval (not inferred from silence)

No code is written. No tests are written. This phase produces documentation only.

### Output

A plan file at `tasks/plans/YYMMDD-feature-name.md` and a printed summary awaiting human approval.
