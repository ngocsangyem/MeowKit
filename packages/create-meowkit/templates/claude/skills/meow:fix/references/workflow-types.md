# Type Error Fix Workflow

For TypeScript type errors, lint errors, and static analysis failures.

## Steps

### Step 1: Read Error
- Run `npx tsc --noEmit` (or project's typecheck command)
- Parse each error: file, line, error code, message
- Group by root cause (one type change can cause cascading errors)

### Step 2: Classify

**Single-source errors** (one fix resolves many):
- Missing type definition → add type/interface
- Wrong type assignment → fix the assignment
- Import error → fix import path or missing export

**Cascading errors** (fix in dependency order):
- Start from the deepest dependency (leaf files)
- Work outward to dependent files
- Re-run typecheck after each fix to see which errors resolve

### Step 3: Fix

Rules:
- NEVER use `any` type (MeowKit security rule — BLOCK)
- NEVER use `as` type assertions to silence errors
- Use `unknown` + type guards instead of `any`
- Prefer proper generics over type assertions
- If type definition is genuinely wrong, fix the type — don't cast around it

### Step 4: Parallel Verify
```
Agent("Bash", "Run typecheck: npx tsc --noEmit")
Agent("Bash", "Run lint: npm run lint")
```

### Step 5: Complete
If all pass → quick review → commit.
If new errors appear → iterate from Step 1.
