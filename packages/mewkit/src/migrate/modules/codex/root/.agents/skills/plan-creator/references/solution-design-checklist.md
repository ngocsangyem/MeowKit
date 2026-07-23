# Solution Design Checklist

Reference for step-03 when writing Architecture and Risk Assessment sections. Checklist format — run through each dimension, note findings in the relevant phase section.

## 1. YAGNI / KISS / DRY

- [ ] Every component in the plan maps to an acceptance criterion (no "just in case" features)
- [ ] No premature abstractions (design for current requirements, not hypothetical future)
- [ ] No duplicated logic across phases (shared concerns extracted to a common phase)
- [ ] Simplest approach that meets requirements (not the most elegant or extensible)

## 2. Security

- [ ] Auth/authz mechanism specified for every endpoint/resource
- [ ] User input validation strategy defined (not deferred to "implementation detail")
- [ ] Sensitive data (PII, credentials, tokens) has storage + transmission strategy
- [ ] No patterns from `security-rules.md` blocked list (hardcoded secrets, `any` type, SQL interpolation, localStorage tokens)
- [ ] Dependency additions evaluated for supply chain risk

## 3. Performance & Scalability

- [ ] Bottleneck identification: which component handles the most load?
- [ ] Caching strategy defined where read-heavy patterns exist
- [ ] No N+1 query patterns in data access design
- [ ] Resource limits specified for unbounded operations (pagination, connection pools, queue depth)
- [ ] Async/background processing for operations > 500ms

## 4. Edge Cases & Failure Modes

- [ ] Error scenarios documented for each external dependency call
- [ ] Partial failure handling: what happens if step 2 of 4 fails?
- [ ] Network failure / timeout behavior specified
- [ ] Retry + idempotency strategy for non-idempotent operations
- [ ] Data consistency: transactions for multi-write operations

## 5. Architecture Patterns

- [ ] Component boundaries are clear (who owns what data, who calls whom)
- [ ] Data flow direction documented (no circular dependencies)
- [ ] API contracts specified (request/response shape, error format)
- [ ] State management approach chosen (if applicable)
- [ ] Backward compatibility strategy for existing consumers (if modifying public interfaces)

## Usage

Step-03 references this checklist when writing:
- **Architecture section**: dimensions 1, 3, 5
- **Risk Assessment section**: dimensions 2, 4
- **Security Considerations section**: dimension 2

Not every item applies to every plan. Skip items that are clearly irrelevant (e.g., no caching needed for a CLI tool). The goal is to catch gaps, not to force-fill checkboxes.
