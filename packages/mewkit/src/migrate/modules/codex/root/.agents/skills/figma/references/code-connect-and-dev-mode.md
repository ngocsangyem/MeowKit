# Code Connect and Dev Mode (gated)

> **Gate — load and run this workflow ONLY when ALL hold:**
> 1. Explicit user intent to map Figma components to code (Code Connect / `.figma.js`).
> 2. User confirms an Organization or Enterprise plan **and** a Dev or Full seat.
> 3. Target components are published.
> 4. Ambiguous component matches are presented to the user — never guessed.
>
> If any condition is unconfirmed: tell the user what is missing and STOP. Do not attempt a partial mapping.

Code Connect links codebase components to Figma Dev Mode and improves MCP context with real code
references (see `official-docs-evidence.md`). Entitlement-gated: Dev/Full seat on Org/Enterprise plans.

## Contents

- [Prerequisite confirmation](#prerequisite-confirmation)
- [Mapping workflow](#mapping-workflow)
- [Dev Resources (lightweight alternative)](#dev-resources-lightweight-alternative)
- [Out of scope in this file](#out-of-scope-in-this-file)

## Prerequisite confirmation

Ask, and wait for answers, before loading the rest of this workflow:

- Is your Figma plan Organization or Enterprise?
- Do you hold a Dev or Full seat?
- Are the components you want to map published to a Figma library?

Any "no" / "unsure" → stop and explain the entitlement requirement.

## Mapping workflow

1. Confirm entitlements (above).
2. Confirm the target component is published.
3. Convert the URL node-id form `1-2` to the API form `1:2`.
4. Scan the codebase for the matching implementation component.
5. Present ambiguous matches to the user and let them choose — never guess a mapping.
6. Send the mapping (Code Connect config / `.figma.<ext>`).
7. Verify the mapping resolves in Dev Mode.

## Dev Resources (lightweight alternative)

Dev Resources attach developer URLs to nodes in Dev Mode and do **not** require publishing. Offer this
when the user wants to link code without full Code Connect entitlements.

## Out of scope in this file

- Bulk mapping many components without per-component confirmation.
- Guessing a code match when more than one candidate exists.
