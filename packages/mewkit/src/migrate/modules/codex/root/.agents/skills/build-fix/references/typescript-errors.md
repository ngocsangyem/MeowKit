# TypeScript Error Reference

Common TS compiler errors with fix patterns. Load this file when error output contains `error TS\d{4}:`.

## Contents

- [Error Catalog](#error-catalog)
  - [TS1005 — Expected X](#ts1005-expected-x)
  - [TS2304 — Cannot find name](#ts2304-cannot-find-name)
  - [TS2307 — Cannot find module](#ts2307-cannot-find-module)
  - [TS2322 — Type not assignable](#ts2322-type-not-assignable)
  - [TS2339 — Property does not exist](#ts2339-property-does-not-exist)
  - [TS2345 — Argument not assignable](#ts2345-argument-not-assignable)
  - [TS7006 — Parameter implicitly has 'any'](#ts7006-parameter-implicitly-has-any)
  - [TS2531 — Object is possibly null](#ts2531-object-is-possibly-null)
  - [TS2532 — Object is possibly undefined](#ts2532-object-is-possibly-undefined)
  - [TS2554 — Expected N arguments but got M](#ts2554-expected-n-arguments-but-got-m)
- [Quick Lookup by Symptom](#quick-lookup-by-symptom)


## Error Catalog

### TS1005 — Expected X

**Message:** `'X' expected` (missing semicolon, bracket, closing brace)
**Class:** auto-fixable
**Fix:** Locate the line indicated. Check for missing `;`, `)`, `}`, or `>`. Count open/close pairs.

### TS2304 — Cannot find name

**Message:** `Cannot find name 'X'`
**Class:** auto-fixable (if importable) / suggest-with-confidence (if typo)
**Fix:**
1. Check if `X` is a type/interface from a library → add import
2. Check if `X` is a typo → correct spelling
3. Check if `X` needs to be declared → add declaration

```ts
// Fix: add import
import { X } from './x-module';
```

### TS2307 — Cannot find module

**Message:** `Cannot find module 'X' or its corresponding type declarations`
**Class:** auto-fixable
**Fix:**
1. Package missing → `npm install X` (or `@types/X` for type declarations)
2. Local path wrong → check relative path `./` vs `../`
3. tsconfig paths misconfigured → check `compilerOptions.paths` in `tsconfig.json`

### TS2322 — Type not assignable

**Message:** `Type 'X' is not assignable to type 'Y'`
**Class:** suggest-with-confidence
**Fix:**
1. Narrow the source type to match the target
2. Widen the target type to accept the source (if appropriate)
3. Add runtime guard for union types
**NEVER use `as any` — use explicit type narrowing or fix the source type.**

```ts
// Fix: type guard
if (typeof value === 'string') { target = value; }
```

### TS2339 — Property does not exist

**Message:** `Property 'X' does not exist on type 'Y'`
**Class:** suggest-with-confidence
**Fix:**
1. Typo → correct property name
2. Missing from interface → add property to interface definition
3. Optional property → use optional chaining `obj?.prop`
4. Conditional existence → add type guard first

### TS2345 — Argument not assignable

**Message:** `Argument of type 'X' is not assignable to parameter of type 'Y'`
**Class:** suggest-with-confidence
**Fix:**
1. Check function signature — is the parameter type too restrictive?
2. Fix the argument type at call site
3. Add overload if both types are valid use cases
**NEVER cast with `as any` — fix the type or use a proper type assertion with `as Y` only if provably correct.**

### TS7006 — Parameter implicitly has 'any'

**Message:** `Parameter 'X' implicitly has an 'any' type`
**Class:** auto-fixable
**Fix:** Add explicit type annotation to the parameter.

```ts
// Before: function process(data) {
// After:
function process(data: string): void {
```

### TS2531 — Object is possibly null

**Message:** `Object is possibly 'null'`
**Class:** suggest-with-confidence
**Fix:**
1. Add null check before use: `if (obj !== null) { ... }`
2. Use optional chaining: `obj?.prop`
3. Use non-null assertion `obj!.prop` only if you can guarantee non-null (document why)

### TS2532 — Object is possibly undefined

**Message:** `Object is possibly 'undefined'`
**Class:** suggest-with-confidence
**Fix:** Same as TS2531 — null check, optional chaining, or nullish coalescing `obj ?? defaultValue`.

### TS2554 — Expected N arguments but got M

**Message:** `Expected N arguments, but got M`
**Class:** auto-fixable
**Fix:**
1. Too many args → remove extra arguments
2. Too few args → add missing required arguments or make parameters optional in the function signature

## Quick Lookup by Symptom

| Symptom | Likely Error | Class |
|---------|-------------|-------|
| Missing bracket/semicolon | TS1005 | auto-fixable |
| Undefined variable | TS2304 | auto-fixable |
| Missing package | TS2307 | auto-fixable |
| Wrong type assigned | TS2322 | suggest |
| Property missing | TS2339 | suggest |
| Wrong arg type | TS2345 | suggest |
| No type on param | TS7006 | auto-fixable |
| Null/undefined access | TS2531/TS2532 | suggest |
| Wrong arg count | TS2554 | auto-fixable |