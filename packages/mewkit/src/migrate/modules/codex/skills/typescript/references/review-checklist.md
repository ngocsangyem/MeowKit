# TypeScript Review Checklist

Prioritized checklist for reviewing TypeScript/JavaScript code. Work top-to-bottom — CRITICAL items block approval, HIGH items must be addressed, MEDIUM items are flagged as warnings.

## CRITICAL — Security (any finding blocks approval)

- [ ] `eval()` or `new Function(string)` with user-controlled input — remote code execution
- [ ] Unsanitized user input rendered as HTML (`innerHTML`, `dangerouslySetInnerHTML`) — XSS
- [ ] SQL/NoSQL queries built with string concatenation or template literals — injection
- [ ] Path traversal: `fs.readFile(userInput)` without normalization — directory escape
- [ ] Hardcoded secrets: API keys, passwords, JWT secrets in source — credential leak
- [ ] Prototype pollution: `obj[userKey] = userValue` without key validation
- [ ] `child_process.exec()` / `spawn()` with user-controlled arguments — command injection

## HIGH — Type Safety (flag each, require justification or fix)

- [ ] `any` type without explanatory comment — defeats type safety (security-rules.md)
- [ ] Non-null assertion `!` on values that could realistically be null — runtime crash
- [ ] `as SomeType` cast without runtime validation — unsafe narrowing
- [ ] `tsconfig.json` with `strict: false`, `noImplicitAny: false`, or `skipLibCheck: true` — hidden bugs

## HIGH — Async (common source of silent failures)

- [ ] Unhandled promise rejection — `promise.catch()` missing or swallowed
- [ ] Sequential `await` for independent operations — use `Promise.all()` instead
- [ ] Floating promise: async function called without `await` and result not used
- [ ] `Array.forEach(async () => {})` — forEach does not await callbacks, errors silently ignored; use `for...of` or `Promise.all(arr.map(async () => {}))`

## HIGH — Error Handling

- [ ] Empty `catch` block or `catch` that only logs — error swallowed, caller gets no signal
- [ ] `JSON.parse()` without try/catch — throws on malformed input
- [ ] Throwing a non-Error value: `throw "string"` or `throw { message }` — loses stack trace
- [ ] Missing React error boundaries around async data-fetching components

## MEDIUM — React / Next.js (warn, acknowledge before approval)

- [ ] `useEffect` with missing dependency array entries — stale closure bugs
- [ ] Direct state mutation: `state.items.push(x)` instead of `setState([...state.items, x])`
- [ ] `key={index}` on list items that can reorder or filter — incorrect reconciliation
- [ ] `useEffect` computing derived state — use `useMemo` instead
- [ ] Server component importing client-only code (or vice versa) without `"use client"` directive

## MEDIUM — Performance

- [ ] Object or array literal created inside render: `style={{ margin: 0 }}` on every render
- [ ] N+1 query pattern: fetching related data inside a loop
- [ ] Missing `React.memo`, `useMemo`, or `useCallback` on expensive computations passed as props
- [ ] Importing entire library when only one function is needed: `import _ from 'lodash'`

## Approval Rules

| Finding Level | Outcome |
|---|---|
| No CRITICAL, no HIGH | Approve |
| No CRITICAL, MEDIUM only | Approve with warnings — each MEDIUM acknowledged |
| Any HIGH | Request changes — must be fixed or explicitly justified |
| Any CRITICAL | Block — do not approve until resolved |

Every CRITICAL or HIGH finding in the report must include: file path, line number, finding description, and recommended fix.
