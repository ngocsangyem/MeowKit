---
title: "mk:angular"
description: "Angular v20+ patterns — components, signals, DI, forms, routing, HTTP, SSR, testing, tooling. 10 skills consolidated into 1."
---

# mk:angular

Angular v20+ patterns — 10 topics consolidated with progressive disclosure via references/.

## What This Skill Does

`mk:angular` provides Angular v20+ best practices across all major topics: components, signals, dependency injection, directives, forms, HTTP, routing, SSR, testing, and tooling. It consolidates 10 separate Angular skills into one with a routing table that loads the right reference for the current task.

## Core Capabilities

- **10 topic references** — component, signals, DI, directives, forms, HTTP, routing, SSR, testing, tooling
- **v20+ modern defaults** — standalone components, signal inputs/outputs, inject(), @if/@for, OnPush
- **Progressive disclosure** — SKILL.md routes to the right reference; agent reads only what's needed
- **Code examples** — every pattern comes with production-ready TypeScript examples
- **Consolidated gotchas** — common Claude mistakes with Angular, grouped by topic

## v20+ Modern Defaults

These apply to ALL Angular work unless explicitly told otherwise:

- Standalone components (no NgModule)
- Signal-based inputs/outputs (`input()`, `output()`, not `@Input`/`@Output`)
- `inject()` function (not constructor injection)
- Native control flow (`@if`, `@for` with `track`, `@switch`)
- OnPush change detection always
- Functional guards/resolvers (not class-based)
- `resource()` / `httpResource()` for data loading

## When to Use This

::: tip Use mk:angular when...
- Working on any Angular v20+ codebase
- Creating components, services, forms, routes
- Setting up SSR/hydration/prerendering
- Writing Angular tests with Vitest or Jasmine
- Using Angular CLI for project management
:::

## Topics

| Topic | Reference | Key patterns |
|-------|-----------|-------------|
| Components | `references/component.md` | Signal inputs/outputs, OnPush, host bindings, content projection |
| Signals | `references/signals.md` | signal(), computed(), linkedSignal(), effect() |
| DI | `references/di.md` | inject(), providers, injection tokens |
| Directives | `references/directives.md` | Attribute directives, host listeners, structural directives |
| Forms | `references/forms.md` | Signal Forms API, validation, dynamic forms |
| HTTP | `references/http.md` | resource(), httpResource(), interceptors |
| Routing | `references/routing.md` | Lazy loading, functional guards, resolvers |
| SSR | `references/ssr.md` | Hydration, prerendering, browser-only APIs |
| Testing | `references/testing.md` | TestBed, Vitest, signal testing, OnPush testing |
| Tooling | `references/tooling.md` | Angular CLI, schematics, build config |

::: info Skill Details
**Phase:** 3 (Build) — auto-activates on Angular projects
**Source:** angular-skills-main (MIT) — 10 skills consolidated
:::

## Gotchas

- **Using @Input/@Output**: deprecated → use `input()`, `output()` signal functions
- **Using *ngIf/*ngFor**: deprecated → use `@if`, `@for` with `track`
- **Constructor injection**: outdated → use `inject()` in field initializers
- **BehaviorSubject for state**: over-complex → use `signal()` + `computed()`
- **Class-based guards**: deprecated → use `CanActivateFn` functions

## Related

- [`mk:typescript`](/reference/skills/typescript) — TypeScript type safety (used alongside Angular)
- [`mk:frontend-design`](/reference/skills/frontend-design) — UI/UX design patterns
- [`mk:react-patterns`](/reference/skills/react-patterns) — React equivalent (for React projects)
- [`mk:vue`](/reference/skills/vue) — Vue equivalent (for Vue projects)
