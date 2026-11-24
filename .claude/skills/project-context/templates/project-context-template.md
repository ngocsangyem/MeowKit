# Project Context

> Draft from `mk:project-context`. Prune it: keep only rules a new agent could not learn from the code.
> Sections marked `<!-- manual -->` are kept when the `update` action runs.

## Commands

| Task | Command |
| --- | --- |
| Build | [command] |
| Test | [command] |
| Lint | [command] |

## Rejected Alternatives

<!-- manual -->

[TODO: Decisions already made, each with the reason it was rejected, so agents do not re-propose them. Example: "Zustand, not Redux: bundle size." This is the most useful section.]

## Anti-Patterns (Do Not)

<!-- manual -->

[TODO: Approaches that break this project, each with what breaks. Example: "Never call the payments API from a component: it bypasses the retry client."]

## Testing Boundaries

<!-- manual -->

[TODO: What is unit-tested, what is integration-tested against a real service, what is e2e; what must not be mocked; coverage expectation if one exists.]

## Conventions Not Enforced by Tooling

<!-- manual -->

[TODO: Naming, file layout or import rules a linter does not catch.]

## Known Issues and Workarounds

<!-- manual -->

[TODO: Quirks and legacy debt that look wrong but are intentional.]

## Environment and Deployment

[TODO: Environment variable names (never values), which branch deploys where, external services and how they authenticate. Delete this section if the project has none of these.]
