---
title: "mk:qa-manual"
description: "Spec-driven manual QA testing and Playwright E2E code generation. Orchestrates browser skills to navigate apps like a human tester, producing structured test reports or production-ready .spec.ts files."
---

# mk:qa-manual

## What This Skill Does

Orchestrates multiple browser skills (`mk:agent-browser`, `mk:playwright-cli`, `mk:browse`) to act like a human QA tester: navigate applications, interact with elements, verify outcomes, and produce structured reports. Supports two primary use cases: manual QA testing from a spec or URL (producing pass/fail reports), and E2E code generation (producing production-ready Playwright `.spec.ts` files with role-based locators). Always prompts the user for credentials -- never guesses or stores auth.

## When to Use

- "test this flow", "QA this page", "generate E2E tests", "test login flow", "manual testing", "write Playwright tests for"
- Running a spec-driven QA pass from a plan file: `/mk:qa-manual tasks/plans/auth-flow.md --report`
- Generating Playwright E2E tests: `/mk:qa-manual tasks/plans/checkout.md --generate`
- Exploratory testing from a URL: `/mk:qa-manual https://app.example.com`
- **NOT** for unstructured browsing -- use `mk:browse`
- **NOT** for AI-autonomous flows -- use `mk:agent-browser`
- **NOT** for automated fix-and-verify QA cycles -- use `mk:qa`

## Core Capabilities

- **Dynamic skill routing:** Each action uses the optimal browser skill (playwright-cli for DOM interaction, agent-browser for auth/screenshots)
- **Role-based locators mandatory:** Uses `getByRole`, `getByLabel`, `getByText`, `getByTestId` -- never CSS selectors
- **Authentication protocol:** Always prompts for credentials on auth encounter; supports login, MFA, cookie import
- **Use Case A -- Manual QA Report:** Loads a spec, extracts test flows, navigates each, verifies outcomes, produces structured pass/fail report
- **Use Case B -- E2E Code Generation:** Runs Use Case A first, records all interactions, generates `.spec.ts` with proper `common/` folder structure (selectors, assertions, intercepts)
- **Test ID detection:** Auto-detects whether project uses `data-testid`, `data-cy`, or `data-test` conventions
- **Selector verification:** Greps source to verify generated locators actually exist, falls back to `getByRole` if missing
- **Production-ready output:** Structured folder layout with separate Selectors, Assertions, Intercepts, and Helpers files

## Arguments

| Argument | Effect |
|----------|--------|
| `<spec-path>` | Path to a plan/spec file in `tasks/plans/` |
| `<URL>` | Direct URL to test (exploratory mode) |
| `--report` | Produce a QA manual test report |
| `--generate` | Generate Playwright `.spec.ts` E2E code |

If no flag is provided, the skill auto-detects the use case from spec content.

## Workflow

### Use Case A -- Manual QA Report

1. **Load spec** -- Read from `tasks/plans/` path, natural language description, or URL
2. **Extract flows** -- Identify test flows with numbered steps and expected outcomes
3. **For each flow:**
   - Navigate to start URL via `mk:playwright-cli goto`
   - Snapshot the page
   - Execute each step using the routing table (playwright-cli for DOM interaction, agent-browser for screenshots)
   - On auth encounter: STOP, prompt user for credentials, wait
   - Compare actual result to expected outcome from spec
   - Record PASS/FAIL/SKIPPED with evidence
4. **Aggregate** -- Compile all flow results into structured QA Report template
5. **Output** -- Complete report with flow results table, failed step details, skipped flows, and summary verdict

### Use Case B -- E2E Code Generation

1. **Run Use Case A** -- Execute full manual test pass
2. **Record interactions** -- Capture Playwright TypeScript code from each playwright-cli action
3. **Detect test ID convention** -- Check source for `data-testid` vs `data-cy` vs `data-test`
4. **Generate feature folder:**
   ```
   tests/e2e/{feature-name}/
   ├── common/
   │   ├── {featureName}Selectors.ts    # All locators
   │   ├── {featureName}Assertions.ts   # Reusable assertions
   │   ├── {featureName}Intercepts.ts   # API route mocks
   │   └── {featureName}Helpers.ts      # Shared setup (optional)
   └── {feature-name}.spec.ts           # One test.describe only
   ```
5. **Verify selectors** -- Grep source for each `getByTestId('xxx')`; if missing, add warning + fallback
6. **Validate** -- Run generated `.spec.ts` via `scripts/run-playwright.sh`

### Authentication Protocol

On encountering any login page, MFA prompt, or 401/403 response:
1. **STOP** immediately -- do not guess or skip
2. **Show user** the auth prompt with URL and request for credentials
3. **WAIT** for user input (username/password, "skip", or "abort")
4. On credentials received: fill form via playwright-cli, continue
5. On "skip": mark flow as SKIPPED, move to next
6. On "abort": end session, output partial report

**Never** guesses credentials, uses hardcoded test credentials, proceeds past auth without input, or stores credentials in any file.

## Usage

```bash
/mk:qa-manual tasks/plans/260315-auth-flow.md --report     # Manual QA report from spec
/mk:qa-manual tasks/plans/260315-checkout.md --generate    # Generate E2E tests from spec
/mk:qa-manual https://app.example.com                       # Explore and test from URL
/mk:qa-manual <spec-path>                                   # Auto-detect use case
```

## Example Prompt

> "I need E2E tests for the new user registration flow. Here's the spec: tasks/plans/registration.md. /mk:qa-manual tasks/plans/registration.md --generate"

The skill loads the spec, extracts the registration flow (navigate to /signup, fill name/email/password, submit, verify welcome page), runs through it as a human tester via playwright-cli, records all interactions, detects the project uses `data-testid`, generates `registration.spec.ts` with proper selectors/assertions/intercepts files, verifies all locators exist in source, and validates the test passes.

## Common Use Cases

- **Spec-driven QA:** Read a plan file's acceptance criteria, test each one manually, produce pass/fail report with evidence
- **Login flow testing:** Handle authentication flows with proper credential prompting (never hardcoded)
- **Form validation testing:** Test empty states, invalid inputs, boundary conditions across all form fields
- **E2E test bootstrapping:** Generate a full Playwright test suite from a spec, ready for CI integration
- **Exploratory testing:** Navigate from a URL, discover interactive elements, test key user paths

## Pro Tips

- **Prepare credentials before running** -- the skill will stop and prompt, so have test credentials ready
- **Use specs from `tasks/plans/`** for best results -- the skill parses acceptance criteria and numbered steps directly
- **The routing table is automatic** -- you don't need to choose which browser skill to use; the orchestrator routes each action
- **Generated E2E code follows a strict structure** -- one `test.describe` per file, all selectors in `common/`, arrange/act/assert pattern
- **Check for existing test ID conventions** -- if the project uses `data-cy` (Cypress), the skill will configure Playwright's `testIdAttribute` accordingly
- **For URL-only testing without a spec**, the skill auto-discovers flows by navigating and identifying interactive elements

> **Canonical source:** `.claude/skills/qa-manual/SKILL.md`
