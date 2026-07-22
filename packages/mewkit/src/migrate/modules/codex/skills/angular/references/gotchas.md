# Angular Gotchas — Complete Reference

> Consolidated from analogjs/angular-skills (MIT)
> Update when Claude produces incorrect Angular patterns.

## Components

- **Using @Input/@Output decorators**: deprecated in v20+ → use `input()`, `input.required()`, `output()` signal functions
- **Using *ngIf/*ngFor**: deprecated template syntax → use `@if`, `@for` with `track` expression, `@switch`
- **Missing OnPush**: default change detection is wasteful → always set `changeDetection: ChangeDetectionStrategy.OnPush`
- **host metadata as arrays**: error-prone → use `host: {}` object syntax for bindings and listeners
- **Forgetting standalone**: in v20+ standalone is default, but importing in other components still requires explicit import array

## Signals

- **BehaviorSubject for component state**: over-complex → use `signal()` + `computed()` for local reactive state
- **effect() for derived state**: side effect when computation suffices → use `computed()` instead, reserve `effect()` for truly side-effectful work
- **linkedSignal() infinite loops**: writing to source inside linkedSignal causes infinite recursion → never write to the source signal inside the computation
- **Mutating signal values**: mutating objects/arrays in signals doesn't trigger change detection → use `update()` with spread or `signal.set()` with new reference

## Dependency Injection

- **Constructor injection**: outdated pattern → use `inject()` function in field initializers
- **Providing in root when not needed**: everything in root = larger bundle → provide in component/route when service is scoped
- **Missing @Injectable()**: forgetting decorator on services → always add `@Injectable({ providedIn: 'root' })` or appropriate scope

## Directives

- **Using Renderer2 when HostBinding works**: over-complex DOM manipulation → prefer `host: {}` bindings for class/style/attribute changes
- **Heavy logic in directives**: directives should be thin → move business logic to services, keep directives focused on DOM behavior

## Forms

- **Template-driven for complex forms**: doesn't scale → use reactive forms (or signal forms API) for complex validation and dynamic fields
- **Missing async validation debounce**: every keystroke triggers validation → debounce async validators
- **Not unsubscribing from valueChanges**: memory leak → use `takeUntilDestroyed()` or `DestroyRef`

## HTTP

- **Manual HttpClient.subscribe()**: verbose, error-prone → use `resource()` or `httpResource()` for data loading
- **Not using interceptors for auth**: repeating auth headers in every request → use functional `HttpInterceptorFn`
- **Missing error handling**: unhandled HTTP errors crash the app → always handle errors in resource/httpResource or catchError

## Routing

- **Class-based guards/resolvers**: deprecated → use functional `CanActivateFn`, `ResolveFn`
- **Eager loading everything**: large initial bundle → use `loadComponent` / `loadChildren` for lazy loading
- **Guards that block navigation silently**: guard returns false with no feedback → redirect to appropriate page or show error

## SSR

- **Using window/document directly**: breaks SSR → check with `isPlatformBrowser()` or use `afterNextRender()`
- **Not using transfer state**: data fetched on server re-fetched on client → use `httpResource()` which handles transfer state automatically
- **Heavy computation in SSR**: slows TTFB → defer heavy work to client with `afterNextRender()`

## Testing

- **Testing implementation instead of behavior**: brittle tests → test what the component does, not how it does it
- **Not flushing effects in signal tests**: computed values stale in tests → use `TestBed.flushEffects()` after signal changes
- **Missing OnPush override in tests**: component doesn't update → use `fixture.componentRef.setInput()` for signal inputs

## Tooling

- **Not using Angular CLI schematics**: manually creating files → `ng generate component/service/pipe` follows conventions
- **Ignoring strict mode**: loose TypeScript config → enable `strict: true` in tsconfig for better type safety
- **Large bundle without analysis**: shipping bloated code → run `ng build --stats-json` + `npx webpack-bundle-analyzer`
