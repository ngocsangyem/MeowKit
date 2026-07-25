# Deep-Module Design

Full vocabulary, principles, dependency categories, and testing strategy for the deepening work in `SKILL.md`. The skill body keeps a compact glossary; this file holds the complete definitions and the `dependency_category` taxonomy the findings schema and Step 6 (patch-shaping) depend on.

Source: deep-module design after John Ousterhout (*A Philosophy of Software Design*) and Michael Feathers (*seam*), framed as leverage/locality rather than line-count ratio.

## Contents

- Glossary (full definitions + forbidden synonyms)
- Deep vs shallow
- Principles
- Designing for testability
- Dependency categories (drives `dependency_category`)
- Testing strategy: replace, don't layer

## Glossary (full definitions + forbidden synonyms)

Use these terms exactly. The forbidden synonyms are the common drift points.

- **module** — anything with an interface and an implementation. Scale-agnostic: function, class, package, or tier-spanning slice. *Never*: unit, component, service.
- **interface** — everything a caller must know to use the module correctly: type signature **plus** invariants, ordering constraints, error modes, required config, performance characteristics. *Never*: API, signature (too narrow — type-level only).
- **implementation** — the body of code inside a module. Distinct from **adapter**: a thing can be a small adapter with a large implementation (a Postgres repo) or a large adapter with a small implementation (an in-memory fake).
- **depth** — leverage at the interface: behaviour a caller/test can exercise per unit of interface they must learn. **deep** = large behaviour behind a small interface. **shallow** = interface nearly as complex as the implementation.
- **seam** *(Feathers)* — a place where you can alter behaviour without editing in that place; the *location* where a module's interface lives. Where to put the seam is its own decision, distinct from what goes behind it. *Never*: boundary (overloaded with DDD's bounded context).
- **adapter** — a concrete thing satisfying an interface at a seam. Describes *role* (which slot it fills), not substance (what's inside).
- **leverage** — what callers get from depth: more capability per unit of interface learned. One implementation pays back across N call sites and M tests.
- **locality** — what maintainers get from depth: change, bugs, knowledge, and verification concentrate in one place. Fix once, fixed everywhere.

## Deep vs shallow

**Deep** = small interface + lots of implementation. **Shallow** = large interface + thin pass-through implementation (avoid).

When designing an interface, ask:

- Can I reduce the number of methods?
- Can I simplify the parameters?
- Can I hide more complexity inside?

## Principles

- **Depth is a property of the interface, not the implementation.** A deep module can be internally composed of small, mockable, swappable parts — they just aren't part of the interface. A module can have **internal seams** (private, used by its own tests) as well as the **external seam** at its interface.
- **The deletion test.** Imagine deleting the module. If complexity vanishes, it was a pass-through (shallow — deepen or remove). If complexity reappears across N callers, it was earning its keep.
- **The interface is the test surface.** Callers and tests cross the same seam. If you need to test *past* the interface, the module is the wrong shape.
- **One adapter = hypothetical seam, two = real one.** Don't introduce a seam/port unless something actually varies across it (typically production + test).

## Designing for testability

1. **Accept dependencies, don't create them** — pass `paymentGateway` in; don't `new StripeGateway()` inside.
2. **Return results, don't produce side effects** — `calculateDiscount(cart): Discount` over `applyDiscount(cart): void`.
3. **Small surface area** — fewer methods = fewer tests; fewer params = simpler setup.

## Dependency categories

Classify a candidate's dependencies before deepening. The category sets `dependency_category` in the findings schema and determines how the deepened module is tested across its seam.

### `in-process`

Pure computation, in-memory state, no I/O. Always deepenable — merge the modules and test through the new interface directly. No adapter needed.

### `local-substitutable`

Dependencies with local test stand-ins (PGLite for Postgres, in-memory filesystem). Deepenable if the stand-in exists. Tested with the stand-in running in the suite. Seam is internal; no port at the external interface.

### `ports-and-adapters`

Your own services across a network boundary (microservices, internal APIs). Define a **port** (interface) at the seam; the deep module owns the logic, transport is injected as an **adapter**. Tests use an in-memory adapter; production uses HTTP/gRPC/queue.

Recommendation shape: *"Define a port at the seam, implement an HTTP adapter for production and an in-memory adapter for testing, so the logic sits in one deep module even though it's deployed across a network."*

### `mock`

True external third-party services (Stripe, Twilio) you don't control. The deepened module takes the external dependency as an injected port; tests provide a mock adapter.

## Testing strategy: replace, don't layer

- Old unit tests on the shallow modules become waste once tests at the deepened interface exist — delete them.
- Write new tests at the deepened module's interface. The **interface is the test surface**.
- Assert on observable outcomes through the interface, not internal state — tests should survive internal refactors. A test that must change when the implementation changes is testing past the interface.
