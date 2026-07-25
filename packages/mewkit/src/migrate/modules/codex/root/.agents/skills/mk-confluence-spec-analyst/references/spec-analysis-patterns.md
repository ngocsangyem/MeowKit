# Spec Analysis Patterns

Heuristics the spec-analyst applies to detect requirements, gaps, ambiguities, and conflicts.

## Contents

- [Weasel Word Inventory](#weasel-word-inventory)
- [Gap-Detection Heuristics](#gap-detection-heuristics)
- [Conflict Detection](#conflict-detection)
- [Story-Suggestion Format](#story-suggestion-format)
- [Calibration Notes](#calibration-notes)

## Weasel Word Inventory

Words / phrases that signal under-specified intent. Flag with `AMB-*` when present without an accompanying condition.

| Weasel | Why it fails | Example flag |
|---|---|---|
| `should generally` | "Generally" is unfalsifiable | "AMB-1: 'should generally retry' — under what conditions?" |
| `usually` | Same as above | |
| `typically` | Same as above | |
| `may` (without "and may not") | Optional behavior with no decision rule | |
| `appropriate` | Subjective | "AMB-3: 'appropriate timeout' — what value?" |
| `reasonable` | Subjective | |
| `as needed` | No trigger criterion | |
| `where possible` | No fallback when not possible | |
| `eventually` | No bound on latency | |
| `efficiently` | No metric | "AMB-2: 'efficiently' — what's the SLA?" |
| `seamlessly` | Marketing language, not a spec | |
| `intelligent` / `smart` | Hides logic | |
| `robust` | Subjective unless paired with failure modes | |
| `scalable` | Subjective unless paired with throughput target | |
| `simple to use` | UX target without acceptance criterion | |
| `best effort` | No SLO; warn only | |
| `if necessary` | Decision rule missing | |
| `handle gracefully` | What does graceful mean? | |

## Gap-Detection Heuristics

Patterns that indicate missing information. Flag with `GAP-*`.

| Pattern | Flag rationale |
|---|---|
| Number with no unit (`timeout 5`, `retry 3 times`) | Unit missing — `5 ms`? `5 s`? `5 min`? |
| Reference to "other doc", "the wiki", "the spec" without link | Untraceable dependency |
| Mention of an external system without integration details | Integration gap |
| Acceptance criterion without a measurable verb (verify, return, log, persist) | Untestable AC |
| User role mentioned without permissions defined | Authz gap |
| State change implied without persistence specified | Storage gap |
| Error case mentioned without handler / fallback | Error-handling gap |
| Performance term used without target ("fast", "low-latency") | SLO gap |
| Mention of "users" without distinguishing role / segment | Audience gap |
| API mentioned without version / contract | Contract gap |
| Data field referenced without type / size / nullability | Schema gap |
| `> [DECISION]` block without rationale | INFO-level — surface as locked-in decision (not a gap) |
| `- [ ]` task-list item without owner / due | GAP-* (missing-owner) |
| `> [INFO]` or `> [WARN]` panel containing weasel words (`should`, `may`) | AMB-* — measurable target unstated |
| `@name [user-id: ...]` mention without surrounding context | INFO-level — surface as reviewer / stakeholder |
| `![alt](attachment:<id>)` reference where the alt is empty | GAP-* (alt-text-missing) |
| `[UNHANDLED_NODE: <type>]` block in walker output | Surface in Open Questions with type + attribute keys |

## Conflict Detection

Two requirements that cannot both be true. Flag with `CONFLICT-*`.

Examples:
- REQ-F-1: "All requests must be authenticated" + REQ-F-2: "GET /healthz must respond without auth"
  → CONFLICT-1: healthz is an explicit exception; reword REQ-F-1 to except healthz.
- REQ-NF-1: "P99 < 100ms" + REQ-F-X: "synchronously call external API with 5s SLA"
  → CONFLICT-2: synchronous external dependency violates the latency target.

The agent surfaces conflicts as observations — does NOT auto-resolve. The human spec author decides which side to relax.

## Story-Suggestion Format

For every distinct user-facing capability the spec implies, suggest a single user story:

```
| Story | Type | Approx. complexity signal | Suggested Jira fields |
|---|---|---|---|
| As a returning user, I want to log in via SSO so that I can access my saved work. | Feature | Medium (~5 sub-tasks implied: idp setup, callback, session, error UX, tests) | type=Story, components=auth |
| As an operator, I want a healthz endpoint so that load balancers can route correctly. | Task | Low | type=Task, components=infra |
```

Rules:
- One row per distinct capability
- Story format: "As a {role}, I want {action} so that {benefit}"
- Complexity is a signal for the human — never an estimate; never anchored
- Suggested fields are hints — `mk:jira-estimator` does the real work

## Calibration Notes

- Weasel-word noise: false-positive rate trends down once team conventions are documented in their own page glossary. After first 5 reports for a team, prune the inventory if specific phrases (e.g. team's local jargon) flag too aggressively.
- Conflict detection is intentionally conservative — only flag CONFLICT when both REQs cite the same subject. Cross-domain "tensions" go in `## Open Questions` instead.
