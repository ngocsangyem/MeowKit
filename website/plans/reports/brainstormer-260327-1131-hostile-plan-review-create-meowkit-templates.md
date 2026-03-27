# Hostile Plan Review: create-meowkit Template Migration

**Date:** 2026-03-27
**Reviewer:** brainstormer (hostile mode)
**Subject:** Plan to copy 368 .claude/ files into create-meowkit templates/ and rewrite generate.ts

---

## Executive Verdict

This plan has **3 Critical**, **4 High**, and **5 Medium** severity issues. The plan is not shippable as described. The core idea (ship real files instead of string-hardcoded stubs) is correct, but the execution approach will create a maintenance nightmare, blow up npm package size, break on Windows, and leave users stranded on upgrades.

---

## Issue-by-Issue Teardown

### 1. npm Package Size — CRITICAL

**Measured reality:** `.claude/` is **2.1 MB** across **368 files**. The `skills/` directory alone is **1.7 MB** with 96 subdirectories.

**The problem:** npm has a 10 MB unpacked size soft warning and many registries enforce limits. But the real issue is DX: `npx create-meowkit` downloads the entire package on every run. A 2+ MB template payload means 3-5 second cold starts on average connections. Compare: `create-vite` is 27 KB. `create-next-app` downloads templates lazily.

**Worse:** The plan includes `__pycache__/` directories (84 KB of `.pyc` files). These are platform-specific compiled bytecode. Shipping them is wrong on every level.

**Mitigation:**
- Strip `__pycache__/`, `.pyc`, any binary artifacts from templates
- Evaluate tarball compression: 2.1 MB of markdown + shell compresses well (~400-600 KB gzip), so actual npm download may be acceptable
- Consider lazy download alternative (see Issue 10)
- Add `.npmignore` or explicit `files` array that excludes test fixtures, example outputs, and compiled artifacts

### 2. Template Staleness / Sync Drift — CRITICAL

**The problem:** The plan says "copy real .claude/ into templates/". This is a one-time snapshot. The actual `.claude/` at repo root will continue evolving (new skills, updated rules, fixed hooks). The `templates/` copy will silently diverge. There is NO mechanism proposed to detect or prevent this.

**Why this is critical, not just high:** MeowKit's entire value proposition is its opinionated agent system. If users scaffold stale templates, they get broken workflows, missing skills, and outdated security rules. This directly undermines the product.

**Measured scope:** 312 markdown files + 16 Python scripts + 10 shell scripts. Manual diffing is impossible at this scale.

**Mitigation:**
- **Option A (recommended):** Build-time copy. Add a prebuild/prepare script that copies `.claude/` into `templates/` during `pnpm build`. Source of truth stays at repo root. `templates/` is a build artifact, gitignored.
- **Option B:** CI check. A GitHub Action that diffs `.claude/` against `templates/.claude/` and fails the build if they diverge.
- **Option C:** Symlinks. `templates/.claude` symlinks to `../../.claude`. Works locally, but npm publish resolves symlinks, so this needs testing.
- Option A is the only one that makes staleness structurally impossible.

### 3. Placeholder Collision — HIGH

**Measured reality:** `{{` appears in at least **10 files** in the current `.claude/` tree:
- `meow:vue/references/vue-patterns.md`: Vue template syntax (`{{ title }}`, `{{ localCount }}`)
- `meow:cso/references/`: GitHub Actions expressions (`${{ github.event.* }}`)
- `meow:skill-creator/scripts/init-skill.py`: Template placeholders (`{{result}}`, `{{value}}`)

**The problem:** Naive `{{PROJECT_NAME}}` substitution will corrupt Vue template examples, GitHub Actions docs, and the skill-creator's own template system. This is not a theoretical risk; it is a measured collision in 3+ skill directories.

**Mitigation:**
- Use a delimiter that does not collide: `__MEOWKIT_PROJECT_NAME__` (dunder-style) or `%%PROJECT_NAME%%`
- OR: Only substitute in specific files (CLAUDE.md, config.json, .env) — never recurse into `skills/` or `references/`
- OR: Use a manifest file that lists which files need substitution, not a blind recursive find-replace

### 4. Skill Dependencies / Python venv — HIGH

**Measured reality:** `meow:multimodal` requires `google-genai>=1.0.0`, `Pillow>=10.0.0`, `python-dotenv>=1.0.0` (from `requirements.txt`). Scripts reference `pip install google-genai`. The CLAUDE.md says to use `.claude/skills/.venv/bin/python3`.

**The problem:** `create-meowkit` will scaffold these Python scripts but NOT create the venv or install dependencies. First time a user triggers `meow:multimodal`, it will fail with `ModuleNotFoundError`. The plan has zero mention of this.

**Mitigation:**
- Add a post-scaffold step: `echo "Run: python3 -m venv .claude/skills/.venv && .claude/skills/.venv/bin/pip install -r .claude/skills/meow:multimodal/scripts/requirements.txt"`
- OR: Add an `install.sh` bootstrap script that the CLI runs or prompts user to run
- OR: Make Python skills opt-in during scaffolding. If user doesn't select multimodal, don't copy those skill directories

### 5. Platform Compatibility (Windows) — HIGH

**Measured reality:** 10 shell scripts (`.sh`), 5 hook scripts without extensions (shebang `#!/usr/bin/env bash`), and `chmodSync(filePath, 0o755)` in generate.ts.

**The problem:**
- `chmod` is a no-op on Windows NTFS. Files won't be executable.
- `#!/usr/bin/env bash` requires Git Bash or WSL on Windows.
- `hooks/pre-task-check.sh` uses `grep -qn`, `date -u` — POSIX commands unavailable in cmd.exe/PowerShell.
- The existing `validate.ts` checks `accessSync(hookPath, constants.X_OK)` — this will ALWAYS FAIL on Windows because NTFS doesn't have Unix execute bits.

**Mitigation:**
- Document that MeowKit requires Git Bash or WSL on Windows (honest but limiting)
- OR: Provide `.cmd`/`.ps1` equivalents for hooks (doubles maintenance)
- OR: Rewrite hooks in Node.js (cross-platform, but loses POSIX simplicity)
- Minimum: Fix validate.ts to skip executable checks on `process.platform === 'win32'`

### 6. Security Scripts Exposure — HIGH

**The problem:** `security-scan.py`, `injection-audit.py`, and hook scripts contain your security detection logic. Shipping them in a public npm package means:
- Attackers can study the exact patterns being detected
- They can craft inputs that evade these specific checks
- The security scan's grep patterns (e.g., `api_key=|apiKey=|secret=|password=|token=`) become a roadmap for evasion

**Counterargument:** Security through obscurity is not real security. These are basic patterns anyone could guess. The benefit of shipping working security tooling to every user outweighs the evasion risk.

**Verdict:** This is a philosophical choice, not a technical bug. **Downgrade to Medium if team agrees obscurity is not the security model.** But document the decision explicitly.

### 7. Memory Directory — LOW

**The problem:** Plan creates `.claude/memory/.gitkeep` but memory files are written at runtime. If the user's filesystem has restrictive permissions (e.g., corporate managed machines), the directory may not be writable.

**Reality check:** If they can run `npx create-meowkit`, they can write to the scaffolded directory. This is a non-issue for 99%+ of users.

**Verdict:** LOW. No mitigation needed beyond what exists.

### 8. Upgrade Path — CRITICAL

**The problem:** User scaffolds v1.0.0 (368 files). They customize agents, add project-specific rules, modify hooks. MeowKit v1.1.0 ships with new skills and security fixes. How do they upgrade?

**Why this is critical:** The plan has ZERO upgrade strategy. Options considered:

| Strategy | Pros | Cons |
|----------|------|------|
| `meow:upgrade` command (listed in CLAUDE.md) | Already in the command index | Not implemented. No design. No diff strategy. |
| Full overwrite | Simple | Destroys user customizations |
| git-style merge | Preserves customizations | Extremely complex to implement. Which files are "theirs" vs "ours"? |
| Layered config (base + overrides) | Clean separation | Requires redesigning the entire .claude/ structure |

**Mitigation:**
- **Minimum viable:** Separate "core" (read-only, MeowKit-managed) from "user" (customizable). e.g., `.claude/core/` (overwritten on upgrade) vs `.claude/custom/` (never touched). Rules/agents load from both.
- **Better:** Version stamp in `.meowkit.config.json`. `meow:upgrade` diffs current version against target, shows changes, lets user accept/reject per-file.
- **Must decide before shipping.** If you ship without an upgrade path, you cannot add one later without breaking every existing installation.

### 9. Monorepo Build Pipeline — MEDIUM

**The problem:** `templates/` is listed in `package.json` `"files"` array, meaning npm will include it. But the plan says to copy `.claude/` into `templates/` — this creates a copy of the repo root's `.claude/` inside a package subdirectory. Implications:
- `pnpm build` must copy files before `tsc` compiles
- Git will track 368 duplicate files (unless templates/ is gitignored)
- Turborepo/pnpm workspace caching may invalidate on every .claude/ change
- CI publish pipeline must ensure copy happens before `npm publish`

**Mitigation:** Use build-time copy (see Issue 2 mitigation Option A). Add `templates/.claude/` to `.gitignore`. Ensure `prepublishOnly` script runs the copy.

### 10. Missing Alternatives — MEDIUM

**The plan never evaluates alternatives. Here are three:**

**Alternative A: Git clone + sparse checkout**
- `create-meowkit` clones the meowkit repo sparse (just `.claude/`)
- Pros: Always fresh, no staleness, zero npm payload
- Cons: Requires git, requires network, tied to repo structure, slower

**Alternative B: Download tarball from GitHub releases**
- Each MeowKit version publishes a `.claude.tar.gz` as a release asset
- `create-meowkit` downloads and extracts at scaffold time
- Pros: Versioned, no npm bloat, can be cached
- Cons: Requires network at scaffold time, more moving parts in release pipeline

**Alternative C: npm sub-package**
- Publish `@meowkit/templates` as a separate npm package
- `create-meowkit` depends on it as a regular dependency
- Pros: Versioned independently, can be updated without CLI changes
- Cons: Two packages to maintain and version in sync

**Alternative D: Hybrid (recommended)**
- Ship a minimal "core" in the npm package (rules, agents, hooks, commands — ~400 KB)
- Download skills on-demand during scaffold based on user selections
- Skills are heavy (1.7 MB) and most users won't need all 43

**The plan should evaluate at least A and D before committing to "ship everything in npm".**

---

## Additional Issues Not in Original Attack List

### 11. Colon in Directory Names — MEDIUM

**Measured reality:** Every skill directory uses colons: `meow:multimodal`, `meow:vue`, `meow:cook`, etc.

**The problem:** Windows NTFS does not allow colons in file/directory names. Period. `fs.mkdirSync("meow:multimodal")` will throw `EINVAL` on Windows. This is not a "might break" — it WILL break.

**Mitigation:** Rename skill directories to use hyphens (`meow-multimodal`) or create a mapping layer. This is a MeowKit-wide issue, not just a create-meowkit issue, but the CLI will be the first place users hit it.

### 12. .env File in Scaffold — MEDIUM

**The problem:** generate.ts writes a `.env` file with the user's Gemini API key if provided. The current `.gitignore.meowkit` file is a separate file the user must manually merge. If they forget, the API key gets committed.

**Mitigation:** Append to existing `.gitignore` instead of creating a separate file. Or check if `.gitignore` exists and add entries directly.

### 13. settings.json Conflict — MEDIUM

**The problem:** generate.ts creates `.claude/settings.json` with hardcoded hook registrations and permissions. If the user already has a `.claude/settings.json` (e.g., from manual Claude Code setup), it gets overwritten.

**Mitigation:** Merge with existing settings.json if present, or warn and skip.

---

## Summary Table

| # | Issue | Severity | Plan Addresses It? |
|---|-------|----------|-------------------|
| 1 | npm package size (2.1 MB + pycache) | CRITICAL | No |
| 2 | Template staleness / sync drift | CRITICAL | No |
| 3 | Placeholder collision with Vue/GH Actions syntax | HIGH | No |
| 4 | Python venv / skill dependencies | HIGH | No |
| 5 | Windows: chmod, bash, POSIX commands | HIGH | No |
| 6 | Security script exposure | HIGH (debatable) | No |
| 7 | Memory directory permissions | LOW | Partially |
| 8 | No upgrade path | CRITICAL | No |
| 9 | Monorepo build pipeline | MEDIUM | No |
| 10 | No alternatives evaluated | MEDIUM | No |
| 11 | Colons in dir names (Windows NTFS) | MEDIUM | No |
| 12 | .env leak risk | MEDIUM | Partially |
| 13 | settings.json overwrite | MEDIUM | No |

---

## Recommended Changes Before Proceeding

1. **Build-time copy, not manual copy** (fixes #2, #9). Templates/ is a build artifact, gitignored.
2. **Strip pycache and binaries** (fixes #1 partially). Add to build script exclusions.
3. **Use `__MEOWKIT_*__` delimiters** or file-level substitution manifest (fixes #3).
4. **Design upgrade strategy before v1** (fixes #8). Minimum: core/custom split.
5. **Rename skill dirs to remove colons** (fixes #11). This is a prerequisite for Windows.
6. **Make skills opt-in or lazy-download** (fixes #1 fully, #4 partially).
7. **Skip chmod + executable checks on Windows** (fixes #5 partially).

---

## Unresolved Questions

1. What is the target npm package size budget? Is 600 KB compressed acceptable?
2. Is Windows support a goal for v1.0.0 or deferred?
3. Has `meow:upgrade` been designed at all, or is it just a placeholder in the command index?
4. Should skills be bundled or downloaded on-demand? This is the single biggest architectural decision.
5. Who owns the `.claude/` source of truth — the repo root or the templates directory?
