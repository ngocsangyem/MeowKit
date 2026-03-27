# /audit — Full Security Audit

## Usage

```
/audit [optional: specific directory or file]
```

## Behavior

Runs a comprehensive security audit using the `security-checklist` skill across all platforms detected in the project. Generates a security report.

### Execution Steps

1. **Detect platforms.** Scan the project to identify which platforms/frameworks are in use (e.g., NestJS, Vue, Swift/iOS, Supabase, PostgreSQL).

2. **Run security-checklist skill** for each detected platform. Check for all blocked patterns defined in `rules/security-rules.md`:
   - Hardcoded secrets (API keys, passwords, tokens, JWT secrets in source)
   - `any` type in TypeScript (should use `unknown` + type guards)
   - SQL queries with string interpolation/template literals
   - localStorage for auth tokens
   - v-html with user-provided content
   - UserDefaults for sensitive data (Swift)
   - Row Level Security disabled or missing
   - Controllers without auth guards (unless explicitly public and documented)
   - process.env access without ConfigService wrapper (NestJS)
   - anon key used in server-side context
   - Disabled certificate validation (Swift)
   - CASCADE DELETE without explicit approval

3. **Classify findings** by severity:
   - **PASS**: No issues found in this area.
   - **WARN**: Potential issue that should be reviewed but does not block shipping.
   - **BLOCK**: Critical security issue that MUST be resolved before shipping. No exceptions.

4. **Generate security report.** Write to:
   ```
   tasks/reviews/YYMMDD-security-report.md
   ```
   Report includes: per-platform findings, severity per finding, file and line references, remediation guidance.

5. **Print summary.** Display findings grouped by severity:
   ```
   🐱 Security Audit Results:
   BLOCK (2): [list]
   WARN  (3): [list]
   PASS  (8): [list]
   ```

### Scope

- If a specific directory or file is provided, audit only that scope.
- If no scope is provided, audit the entire project.

### Output

- Security report at `tasks/reviews/YYMMDD-security-report.md`
- Printed summary with per-platform findings and severity levels
- BLOCK findings must be resolved before any `/ship` command will execute
