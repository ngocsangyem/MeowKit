# Common Root Causes

These patterns cause ~80% of bugs. Check them first before diving deeper.

## Data Issues
- **Null/undefined where not expected** — missing validation at system boundary
- **Wrong type** — string "123" vs number 123, especially from API responses or user input
- **Stale data** — cached value that should have been invalidated
- **Off-by-one** — array index, pagination offset, date boundary

## State Issues
- **Race condition** — two operations on shared state without synchronization
- **Stale closure** — React useEffect capturing old value, setTimeout with outdated state
- **State not reset** — component remount, navigation back, form resubmit
- **Order dependency** — operation assumes prior operation completed but doesn't verify

## Integration Issues
- **API contract mismatch** — backend changed response shape, frontend didn't update
- **Missing error handling** — happy path works, error path crashes
- **Environment difference** — works in dev, fails in prod (env vars, CORS, SSL, DB)
- **Dependency version** — works with v1, breaks with v2 (check lock file)

## Logic Issues
- **Wrong condition** — `&&` vs `||`, `>` vs `>=`, negation error
- **Missing case** — switch without default, if without else, unhandled enum value
- **Wrong scope** — variable shadowing, closure over loop variable
- **Incorrect assumption** — "this will never be empty" → it was empty
