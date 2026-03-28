# Scaffolding Principles

Universal principles for generating project structure — any stack, any language.

## Directory Structure Rules

1. **Separate concerns by directory**: source (`src/`), tests (`tests/`), config (root), docs (`docs/`)
2. **Mirror test structure to source**: `src/auth/` → `tests/auth/`
3. **Flat until necessary**: don't create nested dirs until 5+ files exist at a level
4. **Convention over configuration**: follow the stack's standard layout (e.g., NestJS modules, Vue composables)

## File Generation Rules

1. **Config files first**: package.json/Cargo.toml/go.mod before any source
2. **Entry point second**: main.ts/index.ts/main.go — the app's starting point
3. **One module at a time**: generate auth/ completely before moving to users/
4. **Every file must compile**: no placeholder imports that break compilation
5. **No empty files**: every generated file has meaningful content (at least types/interfaces)

## Naming Convention Enforcement

Follow MeowKit naming-rules.md for the detected stack:

- **TypeScript/Node**: kebab-case files, camelCase functions, PascalCase classes
- **Vue**: PascalCase components, kebab-case files, `use` prefix for composables
- **NestJS**: `feature.service.ts`, `feature.controller.ts`, `feature.module.ts`
- **Swift**: PascalCase types, camelCase functions
- **Go/Rust**: snake_case files
- **Unknown stack**: ask user for naming conventions before generating

## Progressive Generation Protocol

Context window principle — never generate everything at once:

```
Step 1: Print proposed directory tree → user confirms
Step 2: Generate config files (package.json, tsconfig, etc.)
Step 3: Generate entry point + core module
Step 4: Generate remaining modules (one at a time)
Step 5: Generate test scaffolds matching source structure
Step 6: Generate docs (README.md + code-standards.md only)
```

Between steps: verify no compilation errors before proceeding.

## What NOT to Generate

- `.claude/` directory (CLI handles this)
- `.env` files with real secrets (generate `.env.example` only)
- Lock files (npm install generates these)
- Build output directories (dist/, build/)
- IDE-specific config (.vscode/, .idea/) unless user requests

## Minimal Viable Scaffold

For any stack, the minimum output is:

```
project/
├── src/
│   └── [entry-point]       ← main.ts, index.ts, main.go, etc.
├── tests/
│   └── [entry-point.test]  ← matching test file
├── [package-manifest]       ← package.json, go.mod, Cargo.toml
├── [compiler-config]        ← tsconfig.json, etc. (if applicable)
├── .gitignore
└── README.md
```

Extend from this minimum based on config.json features (docker, CI, database).
