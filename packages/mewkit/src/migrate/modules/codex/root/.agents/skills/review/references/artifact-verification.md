# Artifact Verification Checklist

4-level verification adapted from GSD's verifier. Run during step-04-verdict on full-scope reviews only.

## Level 1: Exists

Changed/new files compile and exports are valid.

**Checks:**
- Run build/compile command — zero errors on changed files
- Grep for unused exports in new files: `export (function|const|class) \w+` → verify import exists elsewhere

## Level 2: Substantive

Functions have real logic, not stubs or placeholders.

**Stub Pattern Database:**

| Pattern | Regex | Severity |
|---------|-------|----------|
| TODO/FIXME/HACK in new code | `(TODO\|FIXME\|HACK\|XXX)` | WARN |
| Empty function body (TS/JS) | `\{\s*\}` after function signature | MAJOR |
| Return null/undefined | `return (null\|undefined\|void 0);?\s*$` | WARN |
| Return empty object/array | `return (\{\}\|\[\]);?\s*$` | WARN |
| Console-log-only handler | Function body contains only `console\.(log\|warn\|error)` | MAJOR |
| Static/hardcoded return | Return literal string/number where dynamic expected | WARN |
| Placeholder strings | `(lorem ipsum\|placeholder\|example\|test data\|TODO)` (case-insensitive) | WARN |
| Empty catch block | `catch\s*\([^)]*\)\s*\{\s*\}` | MAJOR |
| Pass-through function | Function only calls `return arg` or `return input` | MINOR |

**Scope:** Only check lines ADDED or MODIFIED in the diff. Do not flag existing stubs.
**Security stubs:** Empty auth guards, empty validation functions → upgrade to MAJOR.

## Level 3: Wired

New exports/components are imported and called by at least one consumer.

**Checks:**
- For each new `export` in changed files, grep the codebase for `import.*{symbol}` or `require.*symbol`
- For new Vue/React components, grep for `<ComponentName` usage
- For new API endpoints, grep for fetch/axios calls to the route

**Orphan = new export with zero consumers.** Severity: WARN.
**Exception:** Entry points (routes, CLI commands, test files) are consumers of themselves.

## Level 4: Data Flowing (Heuristic)

Data paths through new code are traceable — inputs produce expected outputs.

**Checks (heuristic, informational only):**
- Function parameters: are they used in the function body? (unused param = suspicious)
- Return values: is the return value consumed by the caller? (ignored return = suspicious)
- API responses: does the handler actually query/transform data, or return hardcoded values?
- Event handlers: do they modify state or trigger side effects, or are they no-ops?

**Severity:** Always MINOR (informational). Never auto-FAIL. Human reviews flagged items.

## Output Format

```
[LEVEL-N] [FILE:LINE] [PATTERN] [DESCRIPTION]
```

Example:
```
[LEVEL-2] src/auth.ts:42 [empty-catch] Empty catch block swallows authentication errors
[LEVEL-3] src/utils/format.ts:15 [orphan-export] formatCurrency exported but never imported
[LEVEL-4] src/api/users.ts:28 [unused-param] Parameter 'filter' accepted but not used in query
```
