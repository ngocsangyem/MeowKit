# QA Process — Detailed Steps

## Use Case A — Manual QA Report

1. **Load spec** — read from tasks/plans/ path, natural language description, or URL
2. **Extract flows** — identify test flows as numbered steps with expected outcomes
   - From plan file: look for numbered steps, acceptance criteria, user flows
   - From URL: navigate the app, identify key user paths (login, dashboard, CRUD)
3. **For each flow:**
   a. Navigate to start URL using `meow:playwright-cli goto`
   b. Snapshot the page: `meow:playwright-cli snapshot`
   c. For each step in the flow:
      - Execute action using routing table (click/fill → playwright-cli, screenshot → agent-browser)
      - On auth encounter: execute Authentication Protocol (STOP → prompt → wait)
      - After action: re-snapshot to verify result
      - Compare actual result to expected outcome from spec
      - On PASS: record step as passed, continue
      - On FAIL: capture evidence (screenshot via `meow:agent-browser screenshot`), record failure, continue
   d. After all steps: summarize flow result (PASS/FAIL/SKIPPED)
4. **Aggregate** — compile all flow results into QA Report template

## Use Case B — E2E Code Generation

1. **Run Use Case A** — execute the flow like a manual tester
2. **Record interactions** — as each action executes via `meow:playwright-cli`, capture the generated Playwright TypeScript code (playwright-cli outputs this automatically)
3. **Map interactions to Playwright actions:**

   | User action | Playwright code |
   |-------------|----------------|
   | Navigate to URL | `await page.goto('url');` |
   | Click element | `await page.getByRole('button', { name: 'text' }).click();` |
   | Fill text field | `await page.getByRole('textbox', { name: 'label' }).fill('value');` |
   | Select dropdown | `await page.getByRole('combobox', { name: 'label' }).selectOption('value');` |
   | Check checkbox | `await page.getByRole('checkbox', { name: 'label' }).check();` |
   | Wait for navigation | `await page.waitForURL('**/expected-path');` |
   | Assert URL | `await expect(page).toHaveURL(/.*pattern/);` |
   | Assert visible | `await expect(page.getByText('text')).toBeVisible();` |
   | Assert hidden | `await expect(page.getByText('text')).toBeHidden();` |

4. **Detect test ID convention** — before generating code, check which test ID attribute the codebase uses:
   ```bash
   grep -rl "data-testid" src/ --include="*.vue" --include="*.tsx" --include="*.jsx" --include="*.ts" 2>/dev/null | wc -l
   grep -rl "data-cy" src/ --include="*.vue" --include="*.tsx" --include="*.jsx" --include="*.ts" 2>/dev/null | wc -l
   grep -r "testIdAttribute" playwright.config.* 2>/dev/null
   ```
   - `data-testid` found → use `getByTestId()` as primary locator (Playwright default)
   - `data-cy` found → use `getByTestId()` + note `testIdAttribute: 'data-cy'` config needed
   - Neither found → use `getByRole()` as primary locator
5. **Generate feature test folder** — create the full structure (see `output-templates.md` for templates):
   ```
   tests/e2e/{feature-name}/
   ├── common/
   │   ├── {featureName}Selectors.ts      # All locators — getByTestId or getByRole
   │   ├── {featureName}Assertions.ts     # Reusable expect() helpers
   │   ├── {featureName}Intercepts.ts     # API route mocks
   │   └── {featureName}Helpers.ts        # (optional) Shared setup/navigation
   └── {feature-name}.spec.ts             # ONE describe block only
   ```
   Rules:
   - **One `test.describe` per file** — never multiple describes in one .spec.ts
   - **All selectors in `common/{featureName}Selectors.ts`** — never inline selectors in spec
   - **All assertions in `common/{featureName}Assertions.ts`** — reusable across tests
   - **All API mocks in `common/{featureName}Intercepts.ts`** — centralized route handlers
   - Use detected locator strategy (test IDs if available, then role-based)
   - NEVER use CSS selectors or raw IDs
6. **Verify selectors exist** — for each `getByTestId('xxx')` in generated code:
   ```bash
   grep -rn "data-testid=\"xxx\"" src/ --include="*.vue" --include="*.tsx" --include="*.jsx" --include="*.ts"
   ```
   - If found → keep the locator
   - If NOT found → add `// WARNING: data-testid="xxx" not found` + fallback to `getByRole`
   - List all missing test IDs at end for developer to add
7. **Write file** — save to `tests/e2e/[flow-name].spec.ts`
8. **Validate** — run `scripts/run-playwright.sh` to verify the test passes

## Spec Input Parsing

### From the plan file (tasks/plans/*.md)
Look for:
- Acceptance criteria (checkbox items)
- User flow descriptions (numbered steps)
- URL references
- Expected outcomes ("user should see...", "page should show...")

### From natural language
Parse: "Test the login flow: go to /login, enter email, enter password, click sign in, verify dashboard"
→ Flow: login, Steps: [goto /login, fill email, fill password, click sign in], Expected: [dashboard visible]

### From URL only
1. Navigate to URL
2. Snapshot → identify interactive elements
3. Discover flows: forms, navigation links, CTAs
4. Test each discovered flow
