# Strict TypeScript Patterns


## Contents

- [Strict Null Handling](#strict-null-handling)
- [Type Guard Patterns](#type-guard-patterns)
- [Utility Types Cheatsheet](#utility-types-cheatsheet)
- [Error Handling](#error-handling)
- [Strict tsconfig.json](#strict-tsconfigjson)
- [ESLint Recommended Rules](#eslint-recommended-rules)

## Strict Null Handling

```typescript
// BAD — implicit truthiness
if (user) { ... }

// GOOD — explicit null check
if (user !== null && user !== undefined) { ... }

// GOOD — optional chaining + nullish coalescing
const name = user?.profile?.name ?? 'Anonymous';
```

## Type Guard Patterns

```typescript
// Discriminated union
type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const isOk = <T>(result: Result<T>): result is { ok: true; data: T } => {
  return result.ok === true;
};

// Usage
const result = fetchUser();
if (isOk(result)) {
  console.log(result.data); // TypeScript knows data exists
}
```

## Utility Types Cheatsheet

| Type           | Purpose            | Example                                 |
| -------------- | ------------------ | --------------------------------------- |
| `Partial<T>`   | All props optional | `Partial<User>` for update payloads     |
| `Required<T>`  | All props required | `Required<Config>` for validated config |
| `Readonly<T>`  | Immutable          | `Readonly<State>` for store state       |
| `Pick<T, K>`   | Select props       | `Pick<User, 'id' \| 'name'>`            |
| `Omit<T, K>`   | Exclude props      | `Omit<User, 'password'>`                |
| `Record<K, V>` | Key-value map      | `Record<string, unknown>` not `Object`  |

> https://www.typescriptlang.org/docs/handbook/utility-types.html

Use `npx chub search Typescript` for relevant documentation packages within the Context Hub.

## Error Handling

```typescript
// Typed error class
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = "AppError";
  }
}

// Type-safe catch
try {
  await riskyOperation();
} catch (error: unknown) {
  if (error instanceof AppError) {
    // TypeScript knows the shape
    handleAppError(error.code, error.statusCode);
  } else if (error instanceof Error) {
    handleGenericError(error.message);
  } else {
    handleUnknownError(String(error));
  }
}
```

## Strict tsconfig.json

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true
  }
}
```

## ESLint Recommended Rules

```json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/strict-boolean-expressions": "error",
    "@typescript-eslint/no-unnecessary-condition": "error",
    "@typescript-eslint/prefer-nullish-coalescing": "error",
    "@typescript-eslint/prefer-optional-chain": "error",
    "import/consistent-type-specifier-style": ["error", "prefer-top-level"]
  }
}
```