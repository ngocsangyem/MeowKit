---
title: "Scale routing portability cleanup"
type: refactor
status: completed
priority: medium
effort: small
created: 2026-07-17
source_plan: "../../../../plans/260715-2356-meowkit-skill-system-improvement-contracts-context-portability-evidence/plan.md"
handoff:
  next: cook
---

## Goal

Scale routing describes task complexity, risk, workflow, and density without embedding provider-specific model choices.

## Problem

The broader skill-portability plan requires generic skill bodies to avoid provider and model policy. Projection work is externally blocked, and Phase 7 has unrelated uncommitted changes, so this bounded Phase 6 slice must stand independently.

## Technical Approach

Keep the scale-routing skill focused on provider-neutral outputs. Keep any Claude-specific model mapping in its designated rule surface, extend the generic-core contract only when it proves the boundary, then regenerate the plugin from canonical source.

## Tasks

1. [x] Make the scale-routing portability boundary explicit — `.claude/skills/scale-routing/SKILL.md`
2. [x] Keep provider-specific model selection isolated from the skill body — `.claude/rules/model-selection-rules.md`
3. [x] Add focused contract coverage and regenerate the plugin payload
4. [x] Align affected website guidance with the provider-neutral contract

## Constraints

- MUST NOT change Phase 6 tool-name projection or provider-operation conformance.
- MUST NOT modify or reset the existing uncommitted Phase 7 work.
- MUST preserve routing output fields and gate-authority behavior.

## Acceptance Criteria

- [x] `scale-routing` contains only provider-neutral routing outputs and no provider model name or ID.
- [x] Model selection remains an explicitly Claude-specific mapping outside the generic skill body.
- [x] Focused tests, typecheck, build, and portable validation pass.
- [x] Website reference and routing guidance describe the adapter boundary accurately.

## Approval Record

Gate 1 approved by the user in this conversation on 2026-07-17 ("oke"). This record is evidence only; the conversational approval is authoritative.

## Verification

The focused token test, full test suite, lint, typecheck, package build, portable validation, cross-reference validation, and VitePress build passed on 2026-07-17.

## Finalization Gate

All implementation and validation work is complete. Post-test user approval received on 2026-07-17.
