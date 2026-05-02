---
title: "mk:angular"
description: "Angular v20+ patterns — standalone components, signals, dependency injection, forms, routing, HTTP, testing, SSR, tooling."
---

# mk:angular

Angular v20+ patterns across 10 consolidated topics. Auto-activates on `.ts` files in Angular projects (detected via `angular.json`).

## v20+ modern defaults (apply always)

- Standalone components are default — no NgModule needed
- Signal-based inputs/outputs — use `input()`, `input.required()`, `output()` (not `@Input`/`@Output`)
- Signal-based state — use `signal()`, `computed()`, `linkedSignal()` (not `BehaviorSubject`)
- `inject()` function — use `inject()` in field initializers (not constructor injection)
- Native control flow — use `@if`, `@for` with `track`, `@switch` (not `*ngIf`/`*ngFor`)
- OnPush change detection — always set `changeDetection: ChangeDetectionStrategy.OnPush`
- Functional guards/resolvers — use functions (not class-based)
- `resource()` / `httpResource()` — prefer over manual `HttpClient.subscribe()` for data loading

## When to use

Auto-activate on Angular projects. Explicit: `/mk:angular [concern]`.
