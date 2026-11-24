# Plan Review Lenses

Four lenses for reviewing a plan document. A reviewer takes one lens, reads the plan directory it is given, and reports findings in the shared format below. There is no code to build or test; judge the plan.

## Lenses

**Assumption Destroyer.** Find what the plan accepts without evidence: scale and volume figures, external services or packages staying available and contract-stable, team skills or availability, a specific environment or deployment target, phases finishing on schedule, components interoperating without a stated contract or data format. For each, say what is assumed and what breaks if it is wrong. Skip assumptions the plan already validates.

**Scope and Complexity Critic.** Find what the plan does beyond its goal and acceptance criteria: phases or components added "just in case", more phases than the task needs, premature abstraction for scale the constraints do not support, indirection that adds coordination without user value, polish presented as a requirement. Name the simpler alternative and the cost of keeping the extra. Compare against Constraints and Acceptance Criteria.

**Security Adversary.** Find security gaps at design level: authentication or authorization assumed or skipped for "internal" paths, user input without validation or parameterised queries, sensitive data stored or sent without encryption or access control, OWASP design flaws, unvetted or unpinned dependencies, role models that reach beyond authorisation. State the violated property and the attack scenario. Cite `.claude/rules/security-rules.md` blocked patterns where they apply. Recommend properties ("parameterised queries"), not libraries.

**Failure Mode Analyst.** Find unaddressed failure: concurrent operations without ordering, locking or idempotency; chained components with no behaviour when a middle one fails; writes without transactions or rollback; no retry or recovery strategy; unbounded pools, queues or memory; multi-step operations that can stop half-done. State the trigger and the impact on data or users.

## Output format

Report at most 10 findings per lens; zero is a valid result, so say so and stop rather than invent one.

```
## Finding {N}: {short title}
- **Severity:** Critical | High | Medium
- **Location:** Phase {X}, section "{name}" (or "plan.md: {section}")
- **Flaw:** {what is wrong}
- **Failure scenario:** {how this breaks, concretely}
- **Evidence:** {a quote from the plan, or `file:line` for a claim about the repo}
- **Suggested fix:** {brief}
- **Category:** assumption | scope | security | reliability | architecture | timeline | cross-cutting
```

A finding without a quote or `file:line` is dropped. Do not flag what the plan explicitly addresses.

After the findings, add one line: `**Cross-persona blind spot:** {one dimension outside your lens that looks under-covered and that the other lenses may also miss}`, or `**Cross-persona blind spot:** None observed.`
