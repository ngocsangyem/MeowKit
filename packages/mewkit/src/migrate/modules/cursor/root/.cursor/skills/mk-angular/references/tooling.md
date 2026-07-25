# Angular Tooling

> Part of mk:angular skill. Read when: working with tooling.
> Source: analogjs/angular-skills/angular-tooling (MIT)

## Contents

- [Core Patterns](#core-patterns)
- [Advanced Patterns](#advanced-patterns)
- [ANGULAR VERSION ASSUMPTIONS](#angular-version-assumptions)
- [GOTCHAS AND ANTI-PATTERNS](#gotchas-and-anti-patterns)
- [COMPLETE FILE LISTING](#complete-file-listing)


## Core Patterns

**Project Setup:**

Create New Project:
```bash
# Create new standalone project (default in v20+)
ng new my-app

# With specific options
ng new my-app --style=scss --routing --ssr=false

# Skip tests
ng new my-app --skip-tests

# Minimal setup
ng new my-app --minimal --inline-style --inline-template
```

Project Structure:
```
my-app/
├── src/
│   ├── app/
│   │   ├── app.component.ts
│   │   ├── app.config.ts
│   │   └── app.routes.ts
│   ├── index.html
│   ├── main.ts
│   └── styles.scss
├── public/                  # Static assets
├── angular.json             # CLI configuration
├── package.json
├── tsconfig.json
└── tsconfig.app.json
```

**Code Generation:**

Components:
```bash
# Generate component
ng generate component features/user-profile
ng g c features/user-profile  # Short form

# With options
ng g c shared/button --inline-template --inline-style
ng g c features/dashboard --skip-tests
ng g c features/settings --change-detection=OnPush

# Flat (no folder)
ng g c shared/icon --flat

# Dry run (preview)
ng g c features/checkout --dry-run
```

Services:
```bash
# Generate service (providedIn: 'root' by default)
ng g service services/auth
ng g s services/user

# Skip tests
ng g s services/api --skip-tests
```

Other Schematics:
```bash
# Directive
ng g directive directives/highlight
ng g d directives/tooltip

# Pipe
ng g pipe pipes/truncate
ng g p pipes/date-format

# Guard (functional by default)
ng g guard guards/auth

# Interceptor (functional by default)
ng g interceptor interceptors/auth

# Interface
ng g interface models/user

# Enum
ng g enum models/status

# Class
ng g class models/product
```

Generate with Path Alias:
```bash
# Components in feature folders
ng g c @features/products/product-list
ng g c @shared/ui/button
```

**Development Server:**
```bash
# Start dev server
ng serve
ng s  # Short form

# With options
ng serve --port 4201
ng serve --open  # Open browser
ng serve --host 0.0.0.0  # Expose to network

# Production mode locally
ng serve --configuration=production

# With SSL
ng serve --ssl --ssl-key ./ssl/key.pem --ssl-cert ./ssl/cert.pem
```

**Building:**

Development Build:
```bash
ng build
```

Production Build:
```bash
ng build --configuration=production
ng build -c production  # Short form

# With specific options
ng build -c production --source-map=false
ng build -c production --named-chunks
```

Build Output:
```
dist/my-app/
├── browser/
│   ├── index.html
│   ├── main-[hash].js
│   ├── polyfills-[hash].js
│   └── styles-[hash].css
└── server/              # If SSR enabled
    └── main.js
```

**Testing:**

Unit Tests:
```bash
# Run tests
ng test
ng t  # Short form

# Single run (CI)
ng test --watch=false --browsers=ChromeHeadless

# With coverage
ng test --code-coverage

# Specific file
ng test --include=**/user.service.spec.ts
```

E2E Tests:
```bash
# Run e2e (if configured)
ng e2e
```

**Linting:**
```bash
# Run linter
ng lint

# Fix auto-fixable issues
ng lint --fix
```

**Configuration:**

angular.json Key Sections:
```json
{
  "projects": {
    "my-app": {
      "architect": {
        "build": {
          "builder": "@angular-devkit/build-angular:application",
          "options": {
            "outputPath": "dist/my-app",
            "index": "src/index.html",
            "browser": "src/main.ts",
            "polyfills": ["zone.js"],
            "tsConfig": "tsconfig.app.json",
            "assets": ["{ \"glob\": \"**/*\", \"input\": \"public\" }"],
            "styles": ["src/styles.scss"],
            "scripts": []
          },
          "configurations": {
            "production": {
              "budgets": [
                {
                  "type": "initial",
                  "maximumWarning": "500kB",
                  "maximumError": "1MB"
                }
              ],
              "outputHashing": "all"
            },
            "development": {
              "optimization": false,
              "extractLicenses": false,
              "sourceMap": true
            }
          }
        }
      }
    }
  }
}
```

Environment Configuration:
```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
};

// src/environments/environment.prod.ts
export const environment = {
  production: true,
  apiUrl: 'https://api.example.com',
};
```

Configure in angular.json:
```json
{
  "configurations": {
    "production": {
      "fileReplacements": [
        {
          "replace": "src/environments/environment.ts",
          "with": "src/environments/environment.prod.ts"
        }
      ]
    }
  }
}
```

**Adding Libraries:**

Angular Libraries:
```bash
# Add Angular Material
ng add @angular/material

# Add Angular PWA
ng add @angular/pwa

# Add Angular SSR
ng add @angular/ssr

# Add Angular Localize
ng add @angular/localize
```

Third-Party Libraries:
```bash
# Install and configure
npm install @ngrx/signals

# Some libraries have schematics
ng add @ngrx/store
```

**Update Angular:**
```bash
# Check for updates
ng update

# Update Angular core and CLI
ng update @angular/core @angular/cli

# Update all packages
ng update --all

# Force update (skip peer dependency checks)
ng update @angular/core @angular/cli --force
```

**Performance Analysis:**
```bash
# Build with stats
ng build -c production --stats-json

# Analyze bundle (install esbuild-visualizer)
npx esbuild-visualizer --metadata dist/my-app/browser/stats.json --open
```

**Caching:**
```bash
# Enable persistent build cache (default in v20+)
# Configured in angular.json:
{
  "cli": {
    "cache": {
      "enabled": true,
      "path": ".angular/cache",
      "environment": "all"
    }
  }
}

# Clear cache
rm -rf .angular/cache
```

## Advanced Patterns


Contains advanced patterns including:
- Custom Schematics (Generate Schematic Collection, Simple Component Schematic)
- Build Optimization (Budget Configuration, Differential Loading, Code Splitting, Tree Shaking, Preload Strategy)
- Multi-Project Workspace (Create Workspace, Library Configuration, Using Library in App)
- CI/CD Configuration (GitHub Actions, GitLab CI)
- Path Aliases
- Proxy Configuration
- Custom Builders (Using esbuild, SSR Configuration)
- Debugging (Source Maps, Verbose Logging, Debug Tests)
- Package Scripts

---

## ANGULAR VERSION ASSUMPTIONS

All skills default to **Angular v20+**:
- **Standalone components** are default (no ngModule)
- **Signal-based inputs/outputs** using `input()` and `output()`
- **Signal-based state** with `signal()`, `computed()`, `linkedSignal()`
- **Functional guards and interceptors** (not class-based)
- **Native control flow** (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- **Host bindings** via `host` object property (not `@HostBinding`/`@HostListener`)
- **Signals for reactive state** instead of BehaviorSubject/Observable
- **httpResource()** and `resource()` for data fetching instead of pure RxJS
- **OnPush change detection** as the default strategy
- **afterNextRender/afterRender** for lifecycle hooks

---

## GOTCHAS AND ANTI-PATTERNS

**Do NOT:**

1. Use `*ngIf`, `*ngFor`, `*ngSwitch` - use `@if`, `@for`, `@switch` instead
2. Use `ngClass` or `ngStyle` - use direct class/style bindings instead
3. Use `@HostBinding` or `@HostListener` - use `host` object property instead
4. Create template-driven forms - use Signal Forms or Reactive Forms instead
5. Use BehaviorSubject for state - use signals instead
6. Constructor injection - use `inject()` function instead
7. Custom structural directives for control flow - use native `@if/@for/@switch`
8. Store state in components without signals - use signals for reactivity
9. Mix Observable and Signal patterns inconsistently
10. Use `providedIn: 'root'` with `providers: [Service]` in app.config.ts (duplicate)

**Warnings:**

1. **Signal Forms are experimental** in v21 - use Reactive Forms for production apps requiring stability
2. **ngSkipHydration** can cause performance issues - use judiciously
3. **@defer with hydrate never** means no JavaScript execution on those elements
4. **Untracked reads** in computed can break reactivity if not intentional
5. **LinkedSignal with custom computation** needs careful logic to avoid infinite loops
6. **Effect cleanup is required** for long-running operations (timers, subscriptions)
7. **OnPush change detection** requires explicit `detectChanges()` in tests with setInput
8. **Route parameters as inputs** require `withComponentInputBinding()` provider

---

## COMPLETE FILE LISTING

**SKILL.md files (Main Documentation):**

**References/ Files (Advanced Patterns):**

---

This comprehensive report contains complete documentation of all 10 Angular skills with every code pattern and example verbatim from the source files.
