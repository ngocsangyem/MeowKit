# Security Rules — NON-NEGOTIABLE

No "skip if time pressure" exceptions. These rules apply in ALL modes, including fast and cost-saver.

## Blocked Patterns

The agent MUST NOT write any of the following without explicit human override:

| Pattern                                                                    | Why it's blocked                                               |
| -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Hardcoded secrets: API keys, passwords, tokens, JWT secrets in source code | Secrets in source get committed to git and leaked              |
| `any` type in TypeScript                                                   | Use `unknown` + type guards instead. `any` defeats type safety |
| SQL queries with string interpolation/template literals                    | SQL injection risk. Use parameterized queries                  |
| `localStorage` for auth tokens                                             | XSS can steal tokens from localStorage. Use httpOnly cookies   |
| `v-html` with user-provided content                                        | XSS attack vector in Vue                                       |
| `UserDefaults` for sensitive data (Swift)                                  | Not encrypted. Use Keychain instead                            |
| Row Level Security disabled or missing (Supabase/PostgreSQL)               | Data leakage between users                                     |
| Controllers without auth guards (unless explicitly public and documented)  | Unauthenticated access to protected resources                  |
| `process.env` access without ConfigService wrapper (NestJS)                | Breaks testability and validation. Use ConfigService           |
| Anon key used in server-side context                                       | Anon key is for client-side only. Server uses service_role key |
| Disabled certificate validation (Swift)                                    | Man-in-the-middle attack vector                                |
| `CASCADE DELETE` without explicit approval in plan                         | Accidental data loss. Must be planned and approved             |

## Enforcement

### When reviewing existing code

If the agent detects these patterns in existing code during `/mk:review` or `/mk:audit`:

- Flag as **WARN**
- Document in the verdict/audit report
- Do not auto-fix (existing code may have context the agent lacks)

### When writing new code

If the agent is about to write any of these patterns:

- **BLOCK** — do not write the code
- Ask the human for explicit override
- If human approves override: document the reason in the plan file and proceed
- The override and its justification become part of the review record

## No Exceptions

These rules cannot be bypassed by:

- Mode selection (even fast/cost-saver modes check for BLOCKs)
- Time pressure
- Agent self-reasoning ("I think this is safe because...")
- Scope reduction ("it's just a prototype")

**Important:** ONLY a human can override, and the override is documented.
