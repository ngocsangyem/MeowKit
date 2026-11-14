# Expected Plan Assertions — spec-conflict

What a plan built by `mk:plan-creator` from this fixture's packet + flow ledger MUST
contain. Binary checks. Built FROM the packet — no Figma MCP call. This fixture proves the adjudication +
phase-blocking path: block only affected phases (not Gate 1), and resolve source conflicts
through a decision ledger with no silent winner.

## Assertions

- [ ] Zero Figma MCP tool calls during planning (packet-only).
- [ ] Plan surfaces the conflict as a **decision-ledger row** citing all three sources
      (figma_prototype, existing_route, jira_ticket) — no source silently wins.
- [ ] Adjudication applies the consumption reference's precedence order (defined once in
      `plan-creator/references/design-evidence-consumption.md`): here the approved spec
      (Jira MEOW-412: stay in modal) and existing route both OUTRANK the Figma prototype
      (navigate). Overriding the spec would require a recorded conflict + user confirmation.
- [ ] The invite-submit phase carries `blocked_on:` referencing ledger id `F1` + the
      one-line question ("navigate to /settings/members or stay in modal?").
- [ ] `blocked_on:` appears on EXACTLY the affected phase; unrelated phases are not blocked.
- [ ] `status:` frontmatter enum is unchanged (still a valid PHASE_VALID_STATUS value);
      the block is expressed only via the additive `blocked_on:` field.
- [ ] Gate 1 remains presentable (ambiguity explicit) — the whole plan is not blocked.
- [ ] No silent pick of the prototype's navigate outcome anywhere in the plan.

## Decision ledger (expected row)

```yaml
id: F1
source: prototype-flow.json
action: "Invite submit navigation target"
ambiguity: "Figma prototype navigates to /settings/members; existing route + Jira MEOW-412 say stay in modal"
risk_level: high
evidence_sources: [figma_prototype, existing_route, jira_ticket]
decision_needed: "navigate to /settings/members or stay in modal with inline success?"
phase_impact: "<invite-flow phase>"
status: needs-answer
```

## Validation matrix

| id | action | expected | owner |
|----|--------|----------|-------|
| V1 | Invite submit outcome | (deferred until F1 resolved) — phase blocked | playwright-cli |
