# /docs:init — Initial Documentation Scan

## Usage

```
/docs:init
```

## Behavior

Performs a one-time initial documentation scan of the entire codebase and generates a documentation skeleton. Run once at project setup, then use `/docs:sync` for incremental updates.

### Execution Steps

1. **Scan entire codebase structure.** Walk the project directory tree and catalog:
   - All source files, grouped by module/service/component
   - Entry points (main files, route definitions, controllers)
   - Configuration files
   - Existing documentation (if any)

2. **Identify modules, services, components, routes.** Build an inventory:
   - Backend services and their responsibilities
   - Frontend components and their hierarchy
   - API routes/endpoints with HTTP methods
   - Database models/schemas
   - Shared utilities and libraries
   - Third-party integrations

3. **Generate documentation skeleton** with the following sections:
   - **Project Overview**: what the project does, tech stack, high-level architecture
   - **Module Index**: list of all modules/services with one-line descriptions
   - **API Reference Stubs**: endpoint list with method, path, and placeholder for description
   - **Setup Guide**: detected prerequisites, environment variables needed, build/run commands
   - **Component Index** (if frontend): component tree with props/events stubs

4. **Write to `docs/` directory.** Create:
   ```
   docs/
   ├── overview.md
   ├── modules.md
   ├── api-reference.md
   ├── setup.md
   └── components.md  (if frontend detected)
   ```

### When to Use

- First time setting up MeowKit on an existing project
- When joining a new codebase and need to understand the structure
- After a major restructuring that invalidated previous docs

### Output

Documentation skeleton in `docs/` directory. Each file contains accurate structure with placeholder content where details need to be filled in. Use `/docs:sync` going forward to keep docs up to date with code changes.
