# Step 4: Verdict

Synthesize triaged findings into a 5-dimension verdict for Gate 2.

## Dimensions

| Dimension | PASS | WARN | FAIL |
|-----------|------|------|------|
| **Correctness** | No CRITICAL/MAJOR bugs | MINOR bugs only | Any CRITICAL bug |
| **Maintainability** | Clean, readable, follows conventions | Style issues, minor naming | Unreadable, violates architecture |
| **Performance** | No performance regressions | Potential issues flagged | Proven regression |
| **Security** | No security findings | MINOR security notes | Any CRITICAL security issue |
| **Coverage** | All ACs covered + tested | Partial AC coverage | Missing AC implementation |

## Verdict Rules

- **Any FAIL dimension** → Overall FAIL → Gate 2 blocks
- **All PASS** → Overall PASS → Gate 2 eligible
- **Mix of PASS/WARN** → Overall WARN → Gate 2 eligible with acknowledgment

## Presentation Format

```markdown
## Gate 2 Review Verdict

**Overall:** [PASS|WARN|FAIL]

| Dimension | Result | Summary |
|-----------|--------|---------|
| Correctness | [P/W/F] | [one-line] |
| Maintainability | [P/W/F] | [one-line] |
| Performance | [P/W/F] | [one-line] |
| Security | [P/W/F] | [one-line] |
| Coverage | [P/W/F] | [one-line] |

### Current-Change Findings ([count])
[findings list, CRITICAL first]

### Incidental Findings ([count]) — logged to backlog
[findings list, for awareness only]

### Reviewer Sources
- Blind Hunter: [N] findings
- Edge Case Hunter: [N] findings
- Criteria Auditor: [N] findings
```

## Artifact Verification (Full Scope Only)

**Skip if `review_scope = minimal`.**

After computing dimension verdicts, run the 4-level artifact verification checklist. See `references/artifact-verification.md` for the full checklist and stub pattern database.

### Procedure

1. **Level 1 (Exists):** Verify changed files compile and new exports are valid
2. **Level 2 (Substantive):** Grep changed lines for stub patterns (TODO, empty bodies, placeholder strings, empty catch blocks)
3. **Level 3 (Wired):** For each new export, grep codebase for at least one import/usage. Flag orphans.
4. **Level 4 (Data Flowing):** Heuristic check — unused params, ignored returns, hardcoded responses. Informational only.

### Wiring Findings to Dimensions

- Level 2 stub findings in new code → add WARN to **Correctness** dimension
- Level 2 empty auth/validation stubs → add WARN to **Security** dimension
- Level 3 orphan exports → add WARN to **Coverage** dimension
- Level 4 findings → informational only, do not affect any dimension

### Output

Append to verdict as a distinct section:

```markdown
### Artifact Verification
- Level 1 (Exists): [PASS|findings]
- Level 2 (Substantive): [PASS|N stub patterns found]
- Level 3 (Wired): [PASS|N orphan exports found]
- Level 4 (Data Flowing): [PASS|N suspicious patterns flagged]
```

### Reviewer Sources (Updated)

Include Phase B persona sources alongside base reviewers:

```markdown
### Reviewer Sources
- Blind Hunter: [N] findings
- Edge Case Hunter: [N] findings
- Criteria Auditor: [N] findings
- [Phase B] Security Adversary: [N] findings (if activated)
- [Phase B] Failure Mode Analyst: [N] findings (if activated)
- [Phase B] Assumption Destroyer: [N] findings (if activated)
- [Phase B] Scope Complexity Critic: [N] findings (if activated)
- Artifact Verification: [N] findings across 4 levels
```

## After Verdict

- **PASS/WARN:** Present to human for Gate 2 approval
- **FAIL:** List required fixes, route back to developer agent
