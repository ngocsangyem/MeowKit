# Worktree Command Reference

Full option tables, JSON field docs, and usage examples for all 6 commands.

## Table of Contents

- [info](#info)
- [list](#list)
- [status](#status)
- [create](#create)
- [remove](#remove)
- [prune](#prune)
- [Global Options](#global-options)
- [Error Codes](#error-codes)

---

## info

Returns repo metadata used as a pre-flight check before creating worktrees.

```bash
node .claude/skills/worktree/scripts/worktree.cjs info --json
```

### JSON Output Fields

| Field | Type | Description |
|-------|------|-------------|
| `info` | `true` | Marker indicating info response |
| `repoType` | `"standalone" \| "monorepo"` | Detected via `.gitmodules` |
| `gitRoot` | `string` | Absolute path to git root |
| `baseBranch` | `string` | Auto-detected: `dev → develop → main → master` |
| `worktreeRoot` | `string` | Where worktrees will be created by default |
| `worktreeRootSource` | `string` | Why this location was chosen |
| `projects` | `array` | Monorepo submodule list (empty for standalone) |
| `envFiles` | `string[]` | `.env*` files found at repo root |
| `projectEnvFiles` | `object` | Per-project env files (monorepo only) |
| `dirtyState` | `boolean` | Whether working tree has uncommitted changes |
| `dirtyDetails` | `object \| null` | `{modified, staged, untracked, total}` |

---

## list

Lists all registered worktrees.

```bash
node .claude/skills/worktree/scripts/worktree.cjs list --json
```

### JSON Output Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | `true` | |
| `worktrees` | `Worktree[]` | Array of worktree records |

**Worktree record:**

| Field | Type | Description |
|-------|------|-------------|
| `path` | `string` | Absolute filesystem path |
| `branch` | `string` | Checked-out branch name or `"detached"` / `"bare"` |
| `commit` | `string \| null` | HEAD commit SHA |
| `isMainWorktree` | `boolean` | Whether this is the primary worktree |
| `locked` | `boolean` | Whether worktree is locked |
| `prunable` | `boolean` | Whether git considers it stale |

---

## status

Health audit of all worktrees including divergence from base branch.

```bash
node .claude/skills/worktree/scripts/worktree.cjs status --json
```

### JSON Output Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | `true` | |
| `currentWorktree` | `StatusWorktree \| null` | Worktree of current directory |
| `worktrees` | `StatusWorktree[]` | All worktrees with health data |

**StatusWorktree** (extends list record):

| Field | Type | Description |
|-------|------|-------------|
| `isCurrentWorktree` | `boolean` | Current CWD is inside this worktree |
| `branchExists` | `boolean` | Branch exists locally |
| `baseBranch` | `string \| null` | Detected base branch for this worktree |
| `dirtyState` | `boolean` | Has uncommitted changes |
| `dirtyDetails` | `object \| null` | `{modified, staged, untracked, total}` |
| `ahead` | `number` | Commits ahead of base branch |
| `behind` | `number` | Commits behind base branch |

---

## create

Creates a worktree. Two modes:

### Orchestrated mode (parallel agents)

```bash
node .claude/skills/worktree/scripts/worktree.cjs create "{agent-name}" --orchestrated [--dry-run] --json
```

Places worktree at `.worktrees/{agent-name}` on branch `parallel/{agent-name}-{timestamp}`.
Matches `parallel-execution-rules.md` Rule 3 exactly.

### Feature mode (standard)

```bash
node .claude/skills/worktree/scripts/worktree.cjs create "{feature}" --prefix feat [--dry-run] --json
# Monorepo:
node .claude/skills/worktree/scripts/worktree.cjs create "{project}" "{feature}" --prefix feat --json
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `--orchestrated` | off | Parallel agent mode; `arg1` is agent name |
| `--prefix <type>` | `feat` | Branch prefix: `feat\|fix\|refactor\|docs\|test\|chore\|perf` |
| `--base <branch>` | auto | Override base branch detection |
| `--no-prefix` | off | Use feature name as-is (no prefix, preserves case/slashes) |
| `--worktree-root <path>` | auto | Explicit directory for worktrees |
| `--checkout-submodules` | off | Run `git submodule update --init` after create |
| `--env <files>` | none | Comma-separated `.env` files to copy (legacy) |
| `--dry-run` | off | Show what would happen without executing |

### JSON Output Fields (success)

| Field | Type | Description |
|-------|------|-------------|
| `success` | `true` | |
| `dryRun` | `boolean` | Present and `true` when `--dry-run` |
| `worktreePath` | `string` | Absolute path of new worktree |
| `branch` | `string` | Created/checked-out branch name |
| `baseBranch` | `string` | Branch worktree was created from |
| `agentName` | `string` | Agent name (orchestrated mode only) |
| `orchestrated` | `true` | Present in orchestrated mode |
| `envTemplatesCopied` | `array` | `[{from, to}]` — `.env*.example` → `.env*` |
| `envFilesCopied` | `string[]` | Legacy `--env` files copied |
| `warnings` | `string[]` | Non-fatal issues (sanitization, dirty state) |

---

## remove

Removes a worktree and deletes its branch. Supports fuzzy matching by name, path, or branch.

```bash
node .claude/skills/worktree/scripts/worktree.cjs remove "{agent-name}" [--dry-run] --json
```

**Match priority:** exact → prefix → contains (≥4 chars). Errors on 0 or >1 matches.

### JSON Output Fields (success)

| Field | Type | Description |
|-------|------|-------------|
| `success` | `true` | |
| `dryRun` | `boolean` | Present when `--dry-run` |
| `removedPath` | `string` | Path of removed worktree |
| `branchDeleted` | `string \| null` | Branch name if deleted |
| `branchKept` | `string \| null` | Branch name if kept (not fully merged) |
| `warnings` | `string[]` | Non-fatal issues |

---

## prune

Removes stale worktree metadata from `.git/worktrees/`. Always dry-run first.

```bash
node .claude/skills/worktree/scripts/worktree.cjs prune --dry-run --json
node .claude/skills/worktree/scripts/worktree.cjs prune --json
```

### JSON Output Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | `true` | |
| `dryRun` | `boolean` | Whether this was a dry run |
| `message` | `string` | Human-readable summary |
| `entries` | `string[]` | Git's prune output lines |

---

## Global Options

| Option | Description |
|--------|-------------|
| `--json` | Emit JSON on stdout (all commands). Required for LLM consumption. |
| `--dry-run` | Show what would happen without modifying git state. |
| `--help`, `-h` | Show help text. |

---

## Error Codes

All errors emit `{ success: false, error: { code, message, ...details } }` and exit 1.

| Code | Command | Cause |
|------|---------|-------|
| `NOT_GIT_REPO` | all | CWD is not inside a git repository |
| `GIT_VERSION_ERROR` | all | Git < 2.5 (no worktree support) |
| `NODE_VERSION_ERROR` | startup | Node.js < 18 |
| `MISSING_FEATURE` | create | No feature name provided |
| `MISSING_AGENT_NAME` | create --orchestrated | No agent name provided |
| `MISSING_ARGS` | create (monorepo) | Missing project or feature argument |
| `INVALID_FEATURE_NAME` | create | Name collapsed to empty after sanitization |
| `INVALID_AGENT_NAME` | create --orchestrated | Agent name collapsed to empty |
| `INVALID_BASE_BRANCH` | create | `--base` value contains shell metacharacters |
| `BASE_BRANCH_NOT_FOUND` | create | Explicit `--base` branch does not exist |
| `BRANCH_CHECKED_OUT` | create | Branch already checked out in another worktree |
| `WORKTREE_EXISTS` | create | Target directory already exists |
| `PROJECT_NOT_FOUND` | create (monorepo) | Project name not in `.gitmodules` |
| `MULTIPLE_PROJECTS_MATCH` | create (monorepo) | Ambiguous project name |
| `PROJECT_DIR_NOT_FOUND` | create (monorepo) | Submodule directory missing |
| `FETCH_FAILED` | create | Could not fetch remote branch |
| `WORKTREE_CREATE_FAILED` | create | `git worktree add` failed |
| `MKDIR_FAILED` | create | Cannot create worktrees directory |
| `SUBMODULE_CHECKOUT_FAILED` | create | Worktree created but submodule init failed |
| `INVALID_WORKTREE_ROOT` | create | `--worktree-root` or `WORKTREE_ROOT` path invalid |
| `MISSING_WORKTREE` | remove | No name/path argument provided |
| `WORKTREE_NOT_FOUND` | remove | No worktree matches search term |
| `MULTIPLE_WORKTREES_MATCH` | remove | Search term matches >1 worktree |
| `WORKTREE_REMOVE_FAILED` | remove | `git worktree remove` failed |
| `WORKTREE_LIST_ERROR` | list/status/remove | `git worktree list` failed |
| `WORKTREE_PRUNE_FAILED` | prune | `git worktree prune` failed |
| `UNKNOWN_COMMAND` | main | Unrecognized command name |
