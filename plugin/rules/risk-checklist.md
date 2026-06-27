# Risk Checklist

Phase 0 risk evaluation. Agents surface risk flags BEFORE finalizing tier
classification. The 9 flags below complement `mk:scale-routing`'s domain CSV
match — they are an additional signal, not a replacement.

WHY: CSV match covers vertical risk; flags cover horizontal risk. Both feed the existing TRIVIAL / STANDARD / COMPLEX tiers.

## Flags

Mark each flag whose triggers match the task description. The agent emits
`matched_flags: [<ID>, ...]` as part of its Phase 0 output.

| ID | Flag | Triggers (evaluation hints) | Action |
|---|---|---|---|
| AUTH | Authentication | login, logout, session, JWT, OAuth, password, passkey, refresh token | Force COMPLEX tier; route to `security` agent for review |
| AUTHZ | Authorization | RBAC, ACL, roles, scopes, permissions, policy, tenant or company scope | Force COMPLEX tier; route to `security` agent |
| DATA_MODEL | Data model change | schema migration, ALTER TABLE, denormalization, FK change, uniqueness, retention, CASCADE delete | Force `mk:plan-creator --hard`; ADR via architect agent |
| AUDIT_SEC | Audit / security event | audit log, security event, sensitive PII, access log, compliance flag | Force COMPLEX + security agent; flag `injection-rules.md` review |
| EXT_SYSTEM | External system | third-party API, payment provider, webhook ingress, external auth, SSO IdP, email, queue | Force COMPLEX + ADR; require `mk:docs-finder` against latest provider docs |
| PUBLIC_CONTRACT | Public API/contract | OpenAPI change, public REST/GraphQL surface, SDK signature, response envelope, client-visible behavior | Force `mk:plan-creator --hard`; require coverage check |
| CROSS_PLATFORM | Cross-platform impact | iOS+Android, web+mobile, server+client, desktop/mobile/browser split, native shell, deep links | Allow parallel-execution per `parallel-execution-rules.md` Rule 6 |
| EXISTING_BEHAVIOR | Touches existing behavior | refactor, edit of >2 production files, touches >5 callers, already test-covered behavior changes | Apply `core-behaviors.md` Rule 5 (Scope Discipline); require `mk:simplify` |
| WEAK_PROOF | Weak proof | touches code with <50% test coverage OR no tests in path; unclear test coverage around affected area | Reviewer adds WARN at Gate 2; user opt-in for `--tdd` recommended |

(`Multi-domain` is intentionally omitted — already covered by `mk:scale-routing` CSV.)

## Hard-Gate Cross-Reference

The following flag IDs auto-escalate to COMPLEX tier per `model-selection-rules.md` Rule 2 — regardless of CSV match:

- AUTH
- AUTHZ
- DATA_MODEL (data loss / migration)
- AUDIT_SEC
- EXT_SYSTEM (external provider behavior)
- WEAK_PROOF when paired with validation-removal language

## Output Contract

Phase 0 skill (`mk:agent-detector`) emits:

```text
matched_flags: ["AUTH", "DATA_MODEL"]
```

Empty array `[]` is the default when no flag matches. Downstream consumers
(orchestrator, planner) treat the array as advisory metadata; the
authoritative tier comes from `model-selection-rules.md` Rule 2 escalation.

## Non-Overlap Statement

This list complements `mk:scale-routing` CSV. The CSV remains
**tier-authoritative** for vertical-domain matches. The risk checklist is
the **single escalation lever** folded into Rule 2 — it does NOT introduce
new lanes (no "tiny / normal / high-risk" vocabulary in the toolkit). Map flags
onto existing TRIVIAL / STANDARD / COMPLEX via Rule 2.

## Calibration

False-positive rate target: < 10% on a representative prompt set. If a
trigger phrase fires on tasks that clearly don't deserve escalation (e.g.,
"refactor the login button label" matching AUTH), tighten the flag's
trigger language before acting on the match.

## Applies To

- `mk:agent-detector` (Phase 0; reads this file as DATA)
- `mk:plan-creator` (consults matched_flags when emitting per-phase
  acceptance criteria)
- `mk:scale-routing` (no change — runs in parallel as the vertical signal)
