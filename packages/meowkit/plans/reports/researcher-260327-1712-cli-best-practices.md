# Modern Node.js CLI Scaffolding Best Practices (2024-2026)

## 1. Scaffolding Architecture

**Core Pattern:** prompt → template selection → copy → transform tokens → install deps → initialize

Create-vite and create-next-app use a template-based architecture. The template engine is the core; file operations and shell commands handle the rest. Adding new templates = adding new directories.

**Two Approaches:**

| Approach | Pattern | Pros | Cons |
|----------|---------|------|------|
| **Template-Based** | Copy directories, replace Handlebars tokens | Reusable, flexible, human-readable | Requires template engine overhead |
| **Programmatic** | fs.mkdirSync/fs.writeFileSync | No dependencies, full control, simple | Harder to maintain, less reusable |

Popular tools: Plop (Handlebars), copy-template-dir, Angular schematics, Yeoman.

**Recommendation:** Template-based for most cases. Programmatic only if you need zero dependencies or very simple scaffolding.

---

## 2. npm Create Convention

**How it works:**
- Users run: `npm create my-tool my-app` or `npx create-my-tool`
- npm executes: `npm exec create-my-tool` with `my-app` as first arg
- Package must have `"bin": { "create-my-tool": "./cli.js" }` in package.json

**Key Points:**
- Magic shebang required: `#!/usr/bin/env node` at file start
- Global installs: bin scripts symlinked to `/usr/local/bin` or equivalent
- Local installs: bin scripts symlinked to `./node_modules/.bin/`
- Package naming: `create-*` convention (not required but expected by npm)

**Example:**
```json
{
  "name": "create-meowkit",
  "bin": { "create-meowkit": "./cli.js" }
}
```

Usage: `npm create meowkit@latest my-project`

---

## 3. CLI UX Patterns

**Spinners:**
- Use `ora` library for simplicity (loading indicators with status messages)
- Problem: spinners don't show progress; user can't tell if app is stuck
- Solution: Update spinner on task completion (e.g., per-file processed)

**Progress Bars:**
- Use `cli-progress` for customizable progress bars (format, colors, multiple bars)
- Shows X of Y pattern or percentage completion
- Better than spinners for long-running operations with measurable progress

**Color Output:**
- Use `chalk` library (auto-detects color support, graceful degradation)
- Always respect `--no-color` flag and `NO_COLOR` env var
- Conventions: green + checkmark = success, red + X = error

**Error Messages:**
- Clear, actionable messages (not just "Error!")
- Include context: what was being done, why it failed, how to fix

**Cleanup:**
- Clear spinners/progress bars on completion (most libraries auto-handle this)

---

## 4. File Scaffolding Implementation

**Template Directory Structure:**
```
templates/
  ├── react-ts/
  │   ├── src/
  │   ├── package.json
  │   └── vite.config.ts
  ├── react-js/
  └── vue-ts/
```

**Token Replacement Pattern:**
- Use Handlebars syntax: `{{projectName}}`, `{{description}}`
- Read template files, replace tokens, write to destination
- Handle binary files (images, fonts) with copy-only (no token replacement)

**Programmatic Generation (No Templates):**
```javascript
const fs = require('fs');
fs.mkdirSync(`${destDir}/src`, { recursive: true });
fs.writeFileSync(`${destDir}/package.json`, JSON.stringify(pkgJson, null, 2));
```

**Hybrid Approach (Recommended):**
- Templates for boilerplate (config, README)
- Programmatic for dynamic content (package.json with exact versions, .gitignore)

---

## 5. Idempotent Initialization

**Pattern:** Check → Decide → Act

**For Existing Projects:**
1. Check if `package.json` exists
2. Prompt: "Project already exists. Overwrite? [y/N]"
3. Use `--force` flag to skip prompt
4. Guard one-time operations with flag files (`.meowkit-initialized`)

**Idempotency Checklist:**
- Second run produces identical results
- No duplicate installs or file appends
- Use IF-NOT-EXISTS for one-time operations
- Overwrite files instead of appending

**Real-World Examples:**
- Helm, Azure CLI, Terraform: All support `--force` or similar for idempotent re-runs
- create-vite supports `--force` to overwrite destination
- Guards prevent re-initialization on subsequent runs

---

## 6. Testing Scaffolding CLIs

**Snapshot Testing (Jest/Node built-in):**
- Serialize generated files to strings, compare against baseline snapshots
- Catches unintended changes to scaffolded structure
- Use `--experimental-test-snapshots` flag in Node.js test runner

**E2E Testing Pattern:**
1. Run CLI on temp directory
2. Check generated files exist and contain expected content
3. Run `npm install` on generated project
4. Run build/test commands to verify project is functional

**Testing Tools:**
- Jest: Built-in snapshots, mocks, coverage
- Playwright/Cypress: For testing generated UIs
- Node.js built-in test runner: Lightweight, no config

**Example E2E Structure:**
```bash
test/
  ├── fixtures/
  │   ├── expected-react-ts/
  │   └── expected-vue-js/
  ├── e2e.test.js (run CLI, compare fixtures)
  └── snapshot.test.js (snapshot diffs)
```

---

## 7. Publishing Best Practices

**files Field (Most Important):**
```json
{
  "files": [
    "cli.js",
    "templates/**",
    "lib/**",
    "dist/**",
    "!**/*.test.js",
    "!node_modules"
  ]
}
```
- Controls what's included in npm tarball
- Whitelist only necessary files (reduces package size)
- Exclude tests, source maps, node_modules

**bin Entry:**
```json
{
  "bin": {
    "meowkit": "./cli.js"
  }
}
```
- File must have `#!/usr/bin/env node` shebang
- npm makes it executable on global install

**prepublishOnly Script (Build/Transpile):**
```json
{
  "scripts": {
    "prepublishOnly": "npm run build && npm run test"
  }
}
```
- Runs BEFORE `npm publish` only (not on local `npm install`)
- Use for build/transpile/code generation
- **Caveat:** Files created by prepublishOnly are NOT included in published tarball

**Script Lifecycle:**
1. prepublishOnly
2. prepack
3. prepare (also runs on local install)
4. postpack

**Size Optimization:**
- Minimize templates (exclude node_modules from templates)
- Use `.npmignore` if `files` field insufficient
- Bundle/minify CLI code if very large

---

## 8. Real-World Patterns from create-vite & create-next-app

**create-vite:**
- No interactive prompts option: `--no-interactive`
- Simple template selection model
- Lightweight (~50KB)
- Focus: speed, minimal dependencies

**create-next-app:**
- Interactive prompts (TypeScript? ESLint? Tailwind?)
- Post-generation setup (git init, npm install)
- Heavy: includes framework-specific config generators
- Focus: opinionated, batteries-included

**Common to Both:**
- Respect existing projects: check before overwriting
- Spinner feedback during npm install
- Helpful post-generation messages (next steps, docs link)
- Multiple templates without separate CLIs

---

## Summary Table

| Concern | Best Practice |
|---------|---------------|
| **Architecture** | Template-based with token replacement |
| **npm Convention** | `create-*` naming, `bin` field with shebang |
| **UX/Feedback** | Spinners for status, progress bars for long ops, respect --no-color |
| **File Gen** | Templates + programmatic hybrid |
| **Idempotency** | Check → prompt → force flag → guard one-time ops |
| **Testing** | Snapshot tests + E2E (run CLI, check output, install deps) |
| **Publishing** | `files` field, prepublishOnly for builds, minimize size |

---

## Unresolved Questions

1. What template system minimizes overhead for very simple scaffolding (3-5 files)?
2. Should prepublishOnly run tests or only build? (Trade-off: publish time vs. safety)
3. How to handle template versioning if templates change between CLI versions?
4. Best strategy for template discovery/composition (monorepo vs. separate packages)?

---

**Sources:**
- [Create-vite Documentation](https://vite.dev/guide/)
- [Next.js create-next-app CLI](https://nextjs.org/docs/app/api-reference/cli/create-next-app)
- [Build a Project Scaffolding CLI Like create-next-app](https://dev.to/chengyixu/build-a-project-scaffolding-cli-like-create-next-app-3agn)
- [npm package.json Documentation](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/)
- [CLI UX Best Practices](https://evilmartians.com/chronicles/cli-ux-best-practices-3-patterns-for-improving-progress-displays)
- [Scaffolding Tools Guide](https://sparkbox.com/foundry/use_node_fs_instead_of_javascript_dependencies_to_scaffold_files)
- [Testing Node.js CLIs](https://nodejs.org/en/learn/test-runner/using-test-runner)
- [npm Scripts Documentation](https://docs.npmjs.com/cli/v11/using-npm/scripts/)
- [What is npm's prepublish](https://blog.greenkeeper.io/what-is-npm-s-prepublish-and-why-is-it-so-confusing-a948373e6be1)
