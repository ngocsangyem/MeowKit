# Skill: Living Documentation (Diff-Aware Updates)

**Purpose:** Keep documentation synchronized with code by updating only the sections affected by recent changes. Never rewrite unchanged docs.

## When to Use

Invoke this skill after every feature is implemented, before shipping. This ensures documentation stays current without unnecessary churn.

---

## Steps

### Step 1: Identify Changed Files

Run git diff against the main branch to get the list of changed files:

```bash
git diff --name-only main...HEAD
```

This gives you the complete list of files modified in the current branch.

### Step 2: Map Changed Files to Documentation Sections

Use the following mapping to determine which docs need updating:

| Changed File Pattern | Documentation Section |
|---------------------|----------------------|
| `src/modules/*/controller.*` | API documentation |
| `src/modules/*/service.*` | Architecture/module docs |
| `src/modules/*/dto.*` | API request/response docs |
| `supabase/migrations/*` | Database schema docs |
| `src/common/guards/*` | Auth/security docs |
| `src/views/*.vue` | UI component docs |
| `src/stores/*.ts` | State management docs |
| `*.config.*`, `*.env*` | Configuration docs |
| `Dockerfile`, `docker-compose.*` | Deployment docs |
| `package.json` (new deps) | Setup/installation docs |

### Step 3: Update Only Affected Sections

For each identified documentation section:

1. Read the current documentation file.
2. Identify the specific section that corresponds to the changed code.
3. Update ONLY that section.
4. Preserve all other sections exactly as they are.

**Rules:**
- Do NOT rewrite sections that are not affected by the change.
- Do NOT "improve" existing documentation while you are there (create a separate task for that).
- Do NOT change formatting or style of untouched sections.

### Step 4: Create New Doc Pages (if needed)

If the change introduces a new module, feature, or component that has no existing documentation:

1. Create a new documentation page following the project's doc structure.
2. Include: purpose, usage, API (if applicable), examples.
3. Add a link to the new page from the parent/index page.

### Step 5: Update Table of Contents

If the documentation structure changed (new pages added, pages removed, pages renamed):

1. Update the table of contents or index file.
2. Update any navigation sidebars or menus.
3. Verify all internal links still work.

---

## Validation Checklist

Before completing the documentation update:

- [ ] All changed code areas have corresponding doc updates
- [ ] No unchanged documentation sections were modified
- [ ] New modules/features have new doc pages
- [ ] Table of contents is up to date (if structure changed)
- [ ] Internal links are not broken
- [ ] Code examples in docs match the actual implementation

## Anti-Patterns

- **Rewriting the world** — do not update docs that are unrelated to the current change
- **Future documentation** — do not document planned features, only implemented ones
- **Copy-paste code** — do not paste large code blocks into docs; reference the source file or show minimal examples
- **Stale screenshots** — if UI changed, update screenshots; do not leave old ones

## Automation Hint

This skill can be partially automated by:
1. Running `git diff --name-only` in a pre-ship hook
2. Checking if any mapped documentation files were also modified
3. Flagging if code changed but corresponding docs did not
