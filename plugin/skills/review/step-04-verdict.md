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

## Side-Effect Signal (additive, positive-presence-only)

When findings indicate a regression, side effect, or workflow break in **existing** behavior caused by the diff (not new code the agent introduced and got wrong), append a plaintext signal line to the verdict BEFORE the `## After Verdict` section:

```
Side Effects Detected: Yes
- <one-line bullet per detected effect>
```

**Authoring rules:**
- Emit ONLY when an existing-behavior break is the cause. New-code bugs go in the dimension table as normal CRITICAL/MAJOR findings.
- Plaintext line only — NOT a markdown header (`## Side Effects Detected: Yes` will not be recognized by `validate-gate-2.sh`).
- Each bullet names the affected behavior or caller (e.g., `- POST /api/users no longer accepts trailing slashes — breaks 3 existing callers`).
- Absence of the line = no signal. Backward-compatible.

When this signal is present, the cook orchestrator MUST follow the "Regression Recovery Options" pattern in `.claude/skills/cook/references/review-cycle.md` (presents 2–4 options to the user; user selection recorded as a `## User Decision Addendum` block on the verdict file). `validate-gate-2.sh` blocks Gate 2 until the addendum is present.

## Proof Bundle (machine-readable verdict)

Alongside the markdown verdict, emit a Zod-validated JSON proof bundle so Gate 2 can
be checked deterministically without parsing prose. Write it next to the markdown
verdict at `tasks/reviews/<slug>-verdict.json` (atomic write):

```json
{
  "schema_version": "1.0",
  "slug": "<plan-or-review-slug>",
  "gate": "review",
  "decision": "PASS | PASS_WITH_RISK | BLOCKED",
  "dimensions": [
    { "name": "Correctness", "verdict": "PASS|WARN|FAIL", "note": "<one-line>" }
  ],
  "evidence_refs": ["tasks/reviews/<slug>-verdict.md"],
  "created_at": "<ISO-8601 UTC>"
}
```

Map the overall verdict to `decision`: Overall **PASS** → `PASS`; Overall **WARN** →
`PASS_WITH_RISK`; Overall **FAIL** → `BLOCKED`. List all five dimensions.

Then self-check the bundle: run `npx mewkit verdict-gate <slug>`. It exits 0 on
`PASS`/`PASS_WITH_RISK` and non-zero on `BLOCKED`/invalid/missing. The markdown
verdict remains the authoritative human narrative; the JSON is the machine gate
input. The bundle stays under `tasks/` and is never injected into model context.

## Terminal Wiki Handoff (advisory, fail-open)

After the verdict markdown is written to `tasks/reviews/<slug>-verdict.md`, optionally hand
it to the wiki per the shared contract in
`.claude/skills/wiki/references/terminal-handoff-advisory.md`. Only worth recall when the
verdict carries a WARN or FAIL pattern, a security finding, or an accepted policy decision —
**skip a routine clean PASS** (the salience gate would discard it anyway). Advisory only:
never blocks, never approves.

Resolve the slug (env `MEOWKIT_WIKI_SLUG` → the sole `tasks/wikis/<slug>/wiki.json` → else skip + print):

```bash
npx mewkit wiki handoff propose \
  --skill mk:review \
  --from tasks/reviews/<slug>-verdict.md \
  --slug <resolved-wiki-slug> \
  --verified-outcome
```

Do NOT run `wiki approve`. Do NOT add `wiki reindex` to this step.

## After Verdict

- **PASS/WARN:** Present to human for Gate 2 approval
- **FAIL:** List required fixes, route back to developer agent
