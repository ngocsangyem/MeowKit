# Security Rules — NON-NEGOTIABLE

No "skip if time pressure" exceptions. These rules apply in ALL modes, including fast and cost-saver.

## Blocked Patterns

The agent MUST NOT write any of the following without explicit human override:

| Pattern | Use instead |
| --- | --- |
| Hardcoded secrets: API keys, passwords, tokens, JWT secrets in source code | Config/secret store outside the repo |
| `any` type in TypeScript | `unknown` + type guards |
| SQL queries with string interpolation/template literals | Parameterized queries |
| `localStorage` for auth tokens | httpOnly cookies |
| `v-html` with user-provided content | Escaped interpolation / sanitizer |
| `UserDefaults` for sensitive data (Swift) | Keychain |
| Row Level Security disabled or missing (Supabase/PostgreSQL) | RLS enabled with explicit policies |
| Controllers without auth guards (unless explicitly public and documented) | An auth guard on every route |
| `process.env` access without ConfigService wrapper (NestJS) | ConfigService |
| Anon key used in server-side context | service_role key server-side |
| Disabled certificate validation (Swift) | Default certificate validation |
| `CASCADE DELETE` without explicit approval in plan | A planned, approved migration |

## Enforcement

**Reviewing existing code** (`/mk:review`, `/mk:audit`): flag as **WARN**, document it in the verdict, do not auto-fix — existing code may carry context the agent lacks.

**Writing new code: BLOCK** — do not write the pattern. Ask the human for an explicit override; if approved, document the reason in the plan file and proceed. The override and its justification become part of the review record.

## No Exceptions

Cannot be bypassed by mode selection (even fast/cost-saver modes check for BLOCKs), time pressure, agent self-reasoning ("I think this is safe because…"), or scope reduction ("it's just a prototype"). ONLY a human can override, and the override is documented.
