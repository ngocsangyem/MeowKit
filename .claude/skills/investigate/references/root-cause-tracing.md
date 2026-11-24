# Root Cause Tracing

Systematically trace bugs backward through call stack to find original trigger.

## Contents

- [Core Principle](#core-principle)
- [When to Use](#when-to-use)
- [The Tracing Process](#the-tracing-process)
  - [1. Observe the Symptom](#1-observe-the-symptom)
  - [2. Find Immediate Cause](#2-find-immediate-cause)
  - [3. Ask: What Called This?](#3-ask-what-called-this)
  - [4. Keep Tracing Up](#4-keep-tracing-up)
  - [5. Find Original Trigger](#5-find-original-trigger)
- [Adding Stack Traces](#adding-stack-traces)
- [Finding Which Test Causes Pollution](#finding-which-test-causes-pollution)
- [Key Principle](#key-principle)
- [Real Example](#real-example)


## Core Principle

**Trace backward through call chain until finding original trigger, then fix at source.**

Bugs often manifest deep in call stack (git init in wrong directory, file created in wrong location). Instinct is to fix where error appears, but that's treating symptom.

## When to Use

**Use when:**
- Error happens deep in execution (not at entry point)
- Stack trace shows long call chain
- Unclear where invalid data originated
- Need to find which test/code triggers problem

## The Tracing Process

### 1. Observe the Symptom
```
Error: git init failed in /Users/jesse/project/packages/core
```

### 2. Find Immediate Cause
What code directly causes this?
```typescript
await execFileAsync('git', ['init'], { cwd: projectDir });
```

### 3. Ask: What Called This?
```typescript
WorktreeManager.createSessionWorktree(projectDir, sessionId)
  → called by Session.initializeWorkspace()
  → called by Session.create()
  → called by test at Project.create()
```

### 4. Keep Tracing Up
What value was passed?
- `projectDir = ''` (empty string!)
- Empty string as `cwd` resolves to `process.cwd()`
- That's the source code directory!

### 5. Find Original Trigger
Where did empty string come from?
```typescript
const context = setupCoreTest(); // Returns { tempDir: '' }
Project.create('name', context.tempDir); // Accessed before beforeEach!
```

## When You Cannot Trace by Hand

This skill reads existing logs, stack traces and the existing reproducer; it does not edit source. If the trace needs temporary instrumentation (for example `console.error` with a stack at the suspect call), ask the user to add it or hand the case to `mk:fix`, then analyze the captured output: which test names appear, which line triggers the call, and whether the parameter repeats.

## Finding Which Test Causes Pollution

If something appears during tests but don't know which test:

Use bisection script: `scripts/find-polluter.sh`

```bash
./scripts/find-polluter.sh '.git' 'src/**/*.test.ts'
```

Runs tests one-by-one, stops at first polluter.

## Key Principle

**NEVER fix just where error appears.** Trace back to find original trigger.

When found immediate cause:
- Can trace one level up? → Trace backwards
- Is this the source? → Fix at source
- Then add validation at each layer (see `.claude/skills/fix/references/prevention-gate.md`)

## Real Example

**Symptom:** `.git` created in `packages/core/` (source code)

**Trace chain:**
1. `git init` runs in `process.cwd()` ← empty cwd parameter
2. WorktreeManager called with empty projectDir
3. Session.create() passed empty string
4. Test accessed `context.tempDir` before beforeEach
5. setupCoreTest() returns `{ tempDir: '' }` initially

**Root cause:** Top-level variable initialization accessing empty value

**Fix:** Made tempDir a getter that throws if accessed before beforeEach

**Also added defense-in-depth:**
- Layer 1: Project.create() validates directory
- Layer 2: WorkspaceManager validates not empty
- Layer 3: NODE_ENV guard refuses git init outside tmpdir
- Layer 4: Stack trace logging before git init