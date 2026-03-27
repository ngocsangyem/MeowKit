# /arch — Architecture Decision Records

## Usage

```
/arch new [title]
/arch list
/arch review [number]
/arch impact [change description]
```

## Behavior

Architecture as a first-class concern. Manages Architecture Decision Records (ADRs) and analyzes architectural impact of proposed changes.

### Modes

#### /arch new [title]

Generate a new ADR using the `adr-generation` skill.

1. Assign the next sequential ADR number.
2. Gather context: What decision needs to be made? What are the constraints? What options exist?
3. Generate ADR with sections: Title, Status (Proposed), Context, Decision, Consequences, Alternatives Considered.
4. Write to `docs/adrs/NNNN-title.md`.
5. Print summary and ask for review.

#### /arch list

List all ADRs with their current status.

1. Scan `docs/adrs/` directory.
2. Print table:
   ```
   # | Title                        | Status
   1 | Use PostgreSQL for persistence | Accepted
   2 | Event-driven architecture     | Proposed
   3 | Monorepo structure            | Superseded by #5
   ```

#### /arch review [number]

Review and update an existing ADR.

1. Read the specified ADR.
2. Evaluate: Is the decision still valid? Has context changed? Are there new alternatives?
3. Update status if needed: Proposed → Accepted, Accepted → Deprecated, Accepted → Superseded by #N.
4. Add review notes with date.

#### /arch impact [change description]

Analyze the architectural impact of a proposed change.

1. Parse the change description.
2. Identify which architectural decisions (ADRs) are affected.
3. Identify which system boundaries are crossed.
4. Assess: Does this change align with existing ADRs or conflict with them?
5. Print impact assessment: affected components, affected ADRs, risk level, recommendation.

### Output

- For `new`: ADR file at `docs/adrs/NNNN-title.md`
- For `list`: table of all ADRs
- For `review`: updated ADR file
- For `impact`: printed impact assessment with affected components and recommendations
