## Code Review Summary

### Scope
- Files: 7 (generate.ts, copy-template-tree.ts, substitute-placeholders.ts, validate.ts, index.ts, build-templates.sh, package.json)
- LOC: ~320 (TS) + ~135 (bash)
- Focus: CLI rewrite from hardcoded strings to template directory copy

### Overall Assessment
Solid rewrite. Architecture is clean: build script snapshots the real system into templates/, generate.ts copies + substitutes at runtime. Separation of concerns is good. A few issues found below.

---

### Critical Issues

**1. Symlinks silently followed -- potential security/correctness issue**
- `copy-template-tree.ts:50` uses `statSync` which follows symlinks. If the source `.claude/` contains symlinks (common in monorepos), the copy will dereference them and embed the pointed-to content.
- If a symlink points outside the project, sensitive files could be bundled into the npm package.
- Fix: Use `lstatSync` and either skip symlinks or recreate them with `symlinkSync`.

```ts
const stat = lstatSync(srcPath);
if (stat.isSymbolicLink()) {
  // Either skip or recreate symlink
  const target = readlinkSync(srcPath);
  symlinkSync(target, destPath);
  count++;
  continue;
}
```

**2. `resolveTemplateDir()` breaks on Windows**
- `copy-template-tree.ts:88`: `new URL(".", import.meta.url).pathname` returns `/C:/...` on Windows, which `join()` cannot handle correctly.
- Fix: Use `fileURLToPath` from `node:url`.

```ts
import { fileURLToPath } from "node:url";
const distDir = fileURLToPath(new URL(".", import.meta.url));
```

---

### High Priority

**3. `validate.ts:38` uses `require()` in an ESM module**
- `const { statSync } = require("node:fs");` inside `countSubdirs()`. The project is `"type": "module"` in package.json and tsconfig targets Node16 ESM. This will throw `ReferenceError: require is not defined` at runtime.
- Fix: Move `statSync` to the top-level import (it's already imported partially at line 1 but `statSync` was omitted).

```ts
// Line 1: add statSync to the existing import
import { existsSync, readdirSync, accessSync, constants, statSync } from "node:fs";
```
Then remove the `require()` call at line 38.

**4. `dryRun` skips `mkdirSync` in `copyDirRecursive` but still calls `mkdirSync(dest)` at line 40**
- `copy-template-tree.ts:40`: `mkdirSync(dest, { recursive: true })` runs unconditionally, even in dry-run mode. Dry run should not create directories.
- Fix: Guard with `if (!dryRun)`.

**5. No error handling for read/write in `copyDirRecursive`**
- `readFileSync` / `writeFileSync` at lines 59-60 have no try/catch. A single permission error aborts the entire copy with an unhandled exception.
- Fix: Wrap in try/catch, collect errors, report at end, or at minimum provide a meaningful error message.

**6. Redundant `mkdirSync` call**
- `copy-template-tree.ts:58`: `mkdirSync(dest, { recursive: true })` is called again inside the file branch, but it was already called at line 40. Remove the duplicate.

---

### Medium Priority

**7. `build-templates.sh` does not strip `.env`, secrets, or venv from skills/**
- The rsync copies everything under `skills/` except `__pycache__` and `node_modules`. If any skill directory contains a `.env`, `.venv`, or cached data, it gets bundled into the npm package.
- Fix: Add rsync excludes: `--exclude '.env*' --exclude '.venv' --exclude '*.log'`

**8. Extension parsing is fragile**
- `copy-template-tree.ts:63`: `const ext = entry.includes(".") ? "." + entry.split(".").pop() : ""` fails for dotfiles like `.gitkeep` (produces `.gitkeep` as extension, not empty). Not a bug since `.gitkeep` is in SKIP_NAMES, but fragile for future additions.

**9. `--global` mode writes `.claude/` inside `~/.claude/` creating `~/.claude/.claude/`**
- `index.ts:57`: When `--global`, `targetDir = ~/.claude`. Then `generate.ts:39` joins `targetDir + ".claude"` = `~/.claude/.claude/`. This is likely not intended for global install.
- Fix: Conditional logic in generate.ts or pass a flag to skip the `.claude` nesting for global mode.

**10. Template files missing = silent skip, not error**
- `generate.ts:50-53`: If `claude-md.template` is missing, the file is silently skipped. Since CLAUDE.md is essential, this should warn or error.

---

### Edge Cases Found

1. **Race condition on npm publish**: `build-templates.sh` runs `rm -rf "$TEMPLATES"` then rebuilds. If `npm pack` runs concurrently (CI), it could capture a partial templates/ directory. The `"files"` field in package.json includes `templates`, so this is a real risk in parallel CI.
2. **Empty source directories**: If a source dir (e.g., `agents/`) is empty, `copyDirRecursive` creates the empty destination dir but returns count=0. Validation then fails (expects 10+ agents). Not a bug per se, but confusing error message.
3. **Unicode filenames**: `readdirSync` + `writeFileSync` use default encoding. Files with non-ASCII names (unlikely but possible in skills/) will work on macOS/Linux but may fail on Windows.
4. **Large binary files in skills/**: Some skills may contain binary assets. `readFileSync` loads entire file into memory. For a 360-file system this is fine, but worth noting.

---

### Positive Observations
- Clean module separation (copy, substitute, validate as separate files)
- SKIP_NAMES set properly excludes common junk files
- Executable permission handling for hooks is correct and important
- Dry-run mode is consistently implemented across all modules
- Build script uses `set -euo pipefail` (good)
- Placeholder naming (`__MEOWKIT_*__`) avoids collision with `{{}}` template syntaxes

---

### Recommended Actions (Priority Order)
1. **Fix `require()` in validate.ts** -- will crash at runtime (HIGH)
2. **Fix `resolveTemplateDir` for Windows** using `fileURLToPath` (CRITICAL for cross-platform)
3. **Guard `mkdirSync` in dry-run path** of `copyDirRecursive` (HIGH)
4. **Handle symlinks** in copy logic (CRITICAL for security)
5. **Fix `--global` mode** double-nesting of `.claude/` (MEDIUM)
6. **Add rsync excludes** for `.env*`, `.venv` in build script (MEDIUM)
7. **Error on missing CLAUDE.md template** instead of silent skip (MEDIUM)

### Metrics
- Type Coverage: Good (strict mode enabled, no `any` types found)
- Test Coverage: No tests found for new modules
- Linting Issues: 1 confirmed (`require()` in ESM)

### Unresolved Questions
1. Is `--global` mode actually tested/supported? The `.claude/.claude/` nesting suggests it may not be.
2. Should the build script pin the rsync excludes more aggressively to prevent accidental secret bundling?
3. Are there any symlinks in the source `.claude/` directory that would trigger issue #1?
