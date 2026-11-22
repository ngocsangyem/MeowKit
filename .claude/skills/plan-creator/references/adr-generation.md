# Skill: ADR (Architecture Decision Record) Generation

**Purpose:** Create and manage Architecture Decision Records to capture significant technical decisions with full context.

## When to Use

Invoke this skill when:
- A significant architectural or technical decision is made
- A technology choice needs to be documented
- A design trade-off is being evaluated
- An existing decision is being revisited or superseded

## ADR Template

File location: `docs/architecture/adr/YYMMDD-decision.md`. `YYMMDD` is the date and `decision` a short kebab-case slug; the stem is the ADR's identifier.

```markdown
# Title of Decision

**Status:** proposed | accepted | deprecated | superseded
**Date:** YYYY-MM-DD
**Supersedes:** [YYMMDD-decision if applicable]
**Superseded by:** [YYMMDD-decision if applicable]

## Context

Describe the forces at play. What is the technical or business situation that requires a decision? Include:
- What problem are we solving?
- What constraints exist (technical, timeline, team, budget)?
- What has changed since the last relevant decision (if any)?

## Decision

State the decision clearly in one or two sentences. Then elaborate:
- What will we do?
- What alternatives were considered? (List at least 2 alternatives with brief pros/cons)

### Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| Chosen approach | ... | ... |
| Alternative A | ... | ... |
| Alternative B | ... | ... |

## Consequences

### Positive
- [What becomes easier or better]

### Negative
- [What becomes harder or worse]

### Risks
- [What could go wrong and how we mitigate it]

## Related ADRs
- [YYMMDD-decision — title (relationship: extends/supersedes/depends-on)]
```

## Naming

Name the file with today's date and a slug: `date +%y%m%d` gives the `YYMMDD` prefix. If a file with that name exists, make the slug more specific. No sequence number is kept.

## Linking ADRs

- When a new ADR supersedes an old one: update the old ADR's status to `superseded` and add `Superseded by: YYMMDD-decision` to its frontmatter. Add `Supersedes: YYMMDD-decision` to the new ADR.
- When ADRs are related but not superseding: add entries to the `Related ADRs` section in both documents with the relationship type (`extends`, `depends-on`, `related-to`).

## Steps to Execute

1. Determine next sequence number (see above).
2. Create `docs/architecture/` directory if it does not exist.
3. Fill in the template with the decision context.
4. List at least 2 alternatives that were considered.
5. Document both positive and negative consequences honestly.
6. Link to any related existing ADRs.
7. Set status to `proposed` (human changes to `accepted` after review).

## Validation Checklist

- [ ] Sequence number is correct and unique
- [ ] Status is set to `proposed`
- [ ] Context explains the "why" not just the "what"
- [ ] At least 2 alternatives are listed
- [ ] Consequences include both positive and negative
- [ ] Related ADRs are linked bidirectionally
