# Prevention Gate (Post-Fix)

> Run AFTER fix implementation, BEFORE marking complete.

## 1. Regression Test (ALWAYS required)

- Test MUST fail without the fix applied
- Test MUST pass with the fix applied
- If no test → fix is INCOMPLETE (BLOCK finalization)

## 2. Defense-in-Depth (consider for each fix)

Not every fix needs all 4 layers. But ALWAYS consider each:

| Layer                  | When to apply                    | Example                           |
| ---------------------- | -------------------------------- | --------------------------------- |
| Entry point validation | Fix involves user/external input | Add input validation, sanitize    |
| Business logic guard   | Fix involves data processing     | Add assertion, boundary check     |
| Error handling         | Fix involves recoverable failure | Add try/catch, fallback, timeout  |
| Type safety            | Fix involves wrong type/null     | Add type guard, strict null check |

## 3. Verification Checklist

Run through before marking fix complete:

- [ ] Pre-fix state captured? (error messages, test output)
- [ ] Fix addresses ROOT CAUSE (not symptom)?
- [ ] Fresh verification run? (exact same commands as pre-fix)
- [ ] Before/after comparison documented?
- [ ] Regression test added? (fails without fix, passes with fix)
- [ ] Defense-in-depth layers considered?
- [ ] No new warnings/errors introduced?
- [ ] Full test suite passes? (not just the fixed test)

## 4. Common Prevention Patterns

| Bug type               | Prevention                                  |
| ---------------------- | ------------------------------------------- |
| Null/undefined         | Add strict null check + type guard          |
| Wrong type             | Add runtime type validation at boundary     |
| Missing error handling | Add try/catch + explicit error logging      |
| Race condition         | Add mutex/lock or make operation idempotent |
| Unhandled edge case    | Add boundary condition test                 |
| Environment-dependent  | Add environment check + clear error message |
