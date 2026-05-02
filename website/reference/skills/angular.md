---
title: "mk:angular"
description: "Angular v20+ patterns — standalone components, signals, dependency injection, forms, routing, HTTP, testing, SSR, tooling."
---

# mk:angular

Angular v20+ patterns across 10 consolidated topics with progressive disclosure. Auto-activates on `.ts` files in Angular projects (detected via `angular.json`).

## What This Skill Does

Provides comprehensive Angular v20+ best practices covering components, signals, dependency injection, directives, forms, HTTP, routing, SSR, testing, and tooling. Enforces modern signal-based patterns and prevents deprecated class-based approaches.

## When to Use

**Auto-activate on:** `.ts` files in Angular projects (angular.json or `@angular/core` in package.json).

**Explicit:** `/mk:angular [concern]`

## Example Prompt

```
Create an Angular v20+ user profile component with signal-based inputs for user data, httpResource for fetching posts, an edit form using the signal forms API, and functional route guards for authentication.
```

## Core Capabilities

- **Components** — standalone by default, signal-based inputs/outputs, host bindings, content projection
- **Signals** — `signal()`, `computed()`, `linkedSignal()`, `effect()`, RxJS interop
- **Dependency Injection** — `inject()` function, provider scopes, injection tokens, multi providers
- **Directives** — attribute directives, host property bindings, structural directives for portals/overlays
- **Forms** — signal forms API (`form()`, `FormField`), reactive forms, validation, dynamic fields
- **HTTP** — `httpResource()`, `resource()`, functional interceptors, error handling
- **Routing** — lazy loading, functional guards/resolvers, route params as signal inputs, nested routes
- **SSR** — hydration, incremental hydration, prerendering, transfer state, browser-only safety
- **Testing** — Vitest integration, TestBed, signal testing, HTTP testing, OnPush testing
- **Tooling** — Angular CLI, code generation, build, performance analysis, multi-project workspaces

## Arguments

| Argument | Type | Description |
|----------|------|-------------|
| `concern` | string | Optional. Focus area: component, signals, di, directives, forms, http, routing, ssr, testing, tooling |

## Workflow

Auto-activates during **Phase 3 (Build)** when Angular project detected. Loaded by `developer` agent alongside `mk:typescript`.

## v20+ Modern Defaults (apply always)

- **Standalone components** are default — no NgModule needed
- **Signal-based inputs/outputs** — use `input()`, `input.required()`, `output()` (not `@Input`/`@Output`)
- **Signal-based state** — use `signal()`, `computed()`, `linkedSignal()` (not `BehaviorSubject`)
- **`inject()` function** — use `inject()` in field initializers (not constructor injection)
- **Native control flow** — use `@if`, `@for` with `track`, `@switch` (not `*ngIf`/`*ngFor`)
- **OnPush change detection** — always set `changeDetection: ChangeDetectionStrategy.OnPush`
- **Functional guards/resolvers** — use functions (not class-based guards)
- **`resource()` / `httpResource()`** — prefer over manual `HttpClient.subscribe()` for data loading
- **`host: {}` object** — for class/style/attribute bindings and event listeners (not `@HostBinding`/`@HostListener`)

## When to Read Each Reference

| Task involves | Read |
|--------------|------|
| Components, templates, host bindings, content projection | `references/component.md` |
| signal(), computed(), linkedSignal(), effect(), reactive state | `references/signals.md` |
| inject(), providers, injection tokens, services | `references/di.md` |
| Custom directives, DOM manipulation, host listeners | `references/directives.md` |
| Forms, validation, signal forms API | `references/forms.md` |
| HTTP calls, resource(), httpResource(), interceptors | `references/http.md` |
| Routes, lazy loading, guards, resolvers, navigation | `references/routing.md` |
| SSR, hydration, prerendering, browser-only APIs | `references/ssr.md` |
| Unit tests, integration tests, TestBed, Vitest | `references/testing.md` |
| Angular CLI, schematics, build config, project setup | `references/tooling.md` |

Read multiple references when task spans topics (e.g., component + signals + forms).

## Patterns

### Component

```typescript
import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';

@Component({
  selector: 'app-user-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'user-card',
    '[class.active]': 'isActive()',
    '(click)': 'handleClick()',
  },
  template: `
    <img [src]="avatarUrl()" [alt]="name() + ' avatar'" />
    <h2>{{ name() }}</h2>
    @if (showEmail()) {
      <p>{{ email() }}</p>
    }
  `,
})
export class UserCard {
  name = input.required<string>();
  email = input<string>('');
  showEmail = input(false);
  isActive = input(false, { transform: booleanAttribute });
  avatarUrl = computed(() => `https://api.example.com/avatar/${this.name()}`);
  selected = output<string>();

  handleClick() {
    this.selected.emit(this.name());
  }
}
```

### Signals

```typescript
import { signal, computed, linkedSignal } from '@angular/core';

// Writable state
const count = signal(0);
count.set(5);
count.update(c => c + 1);

// Derived state
const double = computed(() => count() * 2);

// Dependent state with reset
const options = signal(['A', 'B', 'C']);
const selected = linkedSignal(() => options()[0]);
// Resets to first option when options change

// Service state pattern
@Injectable({ providedIn: 'root' })
export class Auth {
  private _user = signal<User | null>(null);
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
}
```

### Dependency Injection

```typescript
import { Component, inject, Injectable, InjectionToken } from '@angular/core';

// Injection token
export const API_URL = new InjectionToken<string>('API_URL');

// Config
export const appConfig: ApplicationConfig = {
  providers: [
    { provide: API_URL, useValue: 'https://api.example.com' },
  ],
};

// Injectable service
@Injectable({ providedIn: 'root' })
export class Api {
  private apiUrl = inject(API_URL);
}

// Component injection (not constructor)
@Component({...})
export class UserList {
  private http = inject(HttpClient);
  private userService = inject(User);
}
```

### Forms (Signal Forms API)

```typescript
import { form, required, email, minLength } from '@angular/forms/signals';

@Component({...})
export class Login {
  loginModel = signal<LoginData>({ email: '', password: '' });

  loginForm = form(this.loginModel, (schemaPath) => {
    required(schemaPath.email, { message: 'Email is required' });
    email(schemaPath.email, { message: 'Enter a valid email' });
    required(schemaPath.password);
    minLength(schemaPath.password, 8, { message: 'Min 8 characters' });
  });

  onSubmit(event: Event) {
    event.preventDefault();
    if (this.loginForm().valid()) {
      // submit logic
    }
  }
}
```

### HTTP (httpResource)

```typescript
import { httpResource } from '@angular/common/http';

@Component({
  template: `
    @if (userResource.isLoading()) {
      <p>Loading...</p>
    } @else if (userResource.hasValue()) {
      <h1>{{ userResource.value().name }}</h1>
    }
  `,
})
export class UserProfile {
  userId = signal('123');
  userResource = httpResource<User>(() => `/api/users/${this.userId()}`);
}
```

### Routing

```typescript
// app.routes.ts
export const routes: Routes = [
  { path: '', component: Home },
  { path: 'users/:id', component: UserDetail },
  { path: 'admin', loadChildren: () => import('./admin/admin.routes').then(m => m.adminRoutes) },
];

// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
  ],
};

// Component — route params as signal inputs
@Component({...})
export class UserDetail {
  id = input.required<string>(); // From route param :id
}
```

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| `@Input`/`@Output` decorators | `input()`, `output()` signal functions |
| `*ngIf`/`*ngFor`/`*ngSwitch` | `@if`, `@for` with `track`, `@switch` |
| Constructor injection | `inject()` in field initializers |
| `BehaviorSubject` for component state | `signal()` + `computed()` |
| Class-based guards/interceptors | Functional `CanActivateFn`, `HttpInterceptorFn` |
| `@HostBinding`/`@HostListener` | `host: {}` object property |
| `ngClass`/`ngStyle` | Direct `[class.xxx]`/`[style.xxx]` bindings |
| `provideIn: 'root'` + `providers: [Service]` in config | One or the other, not both |

## Gotchas

Top 5 most common Angular mistakes:

1. **Using @Input/@Output decorators**: deprecated in v20+ — use `input()`, `output()` signal functions
2. **Using *ngIf/*ngFor**: deprecated template syntax — use `@if`, `@for` with `track` expression
3. **Constructor injection**: outdated pattern — use `inject()` in field initializers
4. **BehaviorSubject for component state**: over-complex — use `signal()` + `computed()`
5. **Class-based guards/interceptors**: deprecated — use functional `CanActivateFn`, `HttpInterceptorFn`

Full gotchas reference: `references/gotchas.md`

## Common Use Cases

- Creating new Angular v20+ components with standalone defaults
- Migrating from `@Input`/`@Output` to signal-based inputs/outputs
- Setting up reactive state with `signal()` and `computed()`
- Building forms with the signal forms API
- Implementing functional route guards and interceptors
- Setting up SSR with incremental hydration
- Testing Angular components with Vitest

## Pro Tips

- Always set `ChangeDetectionStrategy.OnPush` on every component
- Use `withComponentInputBinding()` to get route params as signal inputs
- Prefer `httpResource()` over manual `HttpClient.subscribe()` for data loading
- Use `afterNextRender()` / `afterRender()` for browser-only DOM operations (SSR-safe)
- Always flush effects in signal tests with `TestBed.flushEffects()`
- For OnPush components in tests, use `fixture.componentRef.setInput()` to set signal inputs
