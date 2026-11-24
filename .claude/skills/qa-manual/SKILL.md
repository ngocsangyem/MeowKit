---
name: mk:qa-manual
description: "Manual test passes and Playwright specs. NOT for mk:qa."
argument-hint: '[spec-path | url] [--report | --generate]'
orchestrates:
  - mk:agent-browser
  - mk:playwright-cli
use_cases:
  - manual-qa
  - e2e-code-generation
requires_user_input: true
auth_handling: prompt-always
keywords:
  - qa-manual
  - spec-driven-qa
  - playwright-e2e-gen
  - login-flow-test
  - exploratory-test
when_to_use: "A URL plus a spec needs runs."
user-invocable: true
owner: testing
criticality: medium
status: active
runtime: claude-code
---

# QA Manual Testing & E2E Code Generation

Goal: run a spec-driven manual pass through a web flow and report pass or fail per step with evidence, or generate a Playwright `.spec.ts` from that pass. For exploratory test-and-fix use `mk:qa`; to grade a build against a rubric use `mk:evaluate`.

> Script paths in this skill's other files (references, steps) are relative to this skill's directory, `${CLAUDE_SKILL_DIR}`. Prefix them with `${CLAUDE_SKILL_DIR}/` before running them; do not run them from the project root.

It orchestrates browser skills like a human tester: navigate, interact, verify, report.

## When to Use

**Trigger:** "test this flow", "QA this page", "generate E2E tests", "test login flow", "manual testing", "write Playwright tests for"

**Explicit:**
- `/mk:qa-manual tasks/plans/260315-auth-flow.md --report` → manual QA report
- `/mk:qa-manual tasks/plans/260315-checkout.md --generate` → Playwright .spec.ts
- `/mk:qa-manual https://app.example.com` → explore and test from URL
- `/mk:qa-manual [spec]` → auto-detect use case from spec content

## Workflow Integration

Operates in **Phase 4 (Review)** for QA reports or **Phase 3 (Build)** for E2E code generation.

## Skill Routing

Each action uses the best browser skill:

| Action | Skill | Why |
|--------|-------|-----|
| DOM interaction (click, fill, type) | `mk:playwright-cli` | Generates Playwright code as side-effect |
| Navigation + page load | `mk:playwright-cli` | goto + wait, code output |
| Visual verification (screenshot) | `mk:agent-browser` | Annotated snapshots |
| Auth flow (login, session, MFA) | `mk:agent-browser` | Session persistence, auth import |
| Execute Playwright test | Script: `npx playwright test` | Deterministic |

## Authentication Protocol

**On auth encounter** (login page, MFA, 401/403):

1. **STOP** the current flow.
2. **Tell the user:**
   ```
   Authentication required at: [current URL]
   Please sign in yourself in the browser window, or give me a saved auth state file.
   Reply 'done' when signed in, 'skip' to skip this flow, or 'abort' to stop testing.
   ```
3. **WAIT** for the reply; do not proceed without it.
4. On `done`, re-snapshot to confirm the session is signed in, then continue. With a saved state file, open the target with `agent-browser open <url> --state <file>` and continue.
5. On `skip`, mark the flow SKIPPED and move on. On `abort`, end the session and output the partial report.

A password never goes through the chat: do not ask for one, do not type one, and do not store one in any file. If a second factor or CAPTCHA appears, the user completes it in the browser. Never guess credentials or use hardcoded ones.

## Process

See `references/qa-process.md` for detailed Use Case A and Use Case B processes.

**Use Case A — Manual QA:** Load spec → extract flows → navigate each → verify outcomes → report

**Use Case B — E2E Code Gen:** Run Use Case A, record the interactions, and generate a `.spec.ts`. One flow gets one spec file; a feature with more than one scenario gets the feature folder (selectors, assertions, intercepts, helpers). Locator choice: test id when the codebase has one, else role (strategy and page objects: `.claude/skills/testing/references/e2e-best-practices.md`).

## Output Format

See `references/output-templates.md` for full templates.

**QA Report** → structured pass/fail per flow with evidence
**Playwright Code** → production-ready .spec.ts using `getByRole`, `getByLabel`, `getByText`

## Scripts

| Script | Purpose | Invocation |
|--------|---------|------------|
| `scripts/run-playwright.sh` | Execute generated .spec.ts | After E2E code generation |

## References

| Reference | When to load | Content |
|-----------|-------------|---------|
| **[qa-process.md](./references/qa-process.md)** | Steps 1-4 | Detailed Use Case A + B processes |
| **[output-templates.md](./references/output-templates.md)** | Step output | QA report + Playwright code templates |
| `examples/01-login-flow-manual-qa.md` | A worked report | Login flow, manual QA |
| `examples/02-checkout-e2e-generation.md` | A worked generation | Checkout flow, E2E code |
| `examples/03-url-exploration.md` | A worked exploration | URL-driven exploration |

## Failure Handling

| Failure | Detection | Recovery | Message |
|---------|-----------|----------|---------|
| Auth encountered | URL/form patterns | Auth protocol above | "Authentication required..." |
| Page load timeout | 30s timeout | Retry ×2 then report | "Page load timed out at [URL]" |
| Element not found | Selector fails | Re-snapshot, try alternate | "Element not found, re-scanning..." |
| Spec not found | File missing | Ask user | "Spec file not found. Provide path or URL." |
| Playwright exec fails | Non-zero exit | Show error + fix hints | "Test failed: [error]. Fix: [hint]" |

## Gotchas

- **Testing against stale deployment**: Running E2E tests against yesterday's build → Verify deployment version matches expected before starting test run
- **Credentials hardcoded in generated spec files**: Auto-generated .spec.ts contains login credentials → Always use environment variables for credentials; never inline in test code
