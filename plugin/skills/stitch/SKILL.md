---
name: mk:stitch
description: Generate novel UI from a text prompt via Stitch AI. Exports Tailwind/HTML, produces DESIGN.md for mk:frontend-design handoff. NOT for implementing existing designs — use mk:figma or mk:frontend-design for that.
user-invocable: true
when_to_use: Generate a new UI design from a text description (text-prompt → novel design). NOT for implementing an existing design source — use mk:figma for Figma URLs or mk:frontend-design for an existing spec/mockup/DESIGN.md. Stitch generates novel designs from scratch; it does not interpret existing visual sources.
category: frontend
phase: on-demand
keywords:
  - stitch
  - ui-generation
  - text-to-ui
  - prototyping
  - design-generation
  - tailwind
  - html-export
  - design-to-code
  - design-handoff
  - ai-design
  - rapid-prototyping
  - mock-ui
  - screen-design
requires_external_service:
  - stitch
default_enabled: false
requires_env:
  - name: STITCH_API_KEY
    required: true
    description: Stitch API key (sk_...) for design generation
    setup: Get from https://stitch.withgoogle.com/settings/api
    fallback: Skill is disabled without this key. Use mk:frontend-design for text-based design instead.
trust_level: kit-authored
injection_risk: high
stable_output_contract: true
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
argument-hint: '[generate|export|quota] [args]'
metadata:
  author: meowkit
  version: 1.0.0
owner: utility
criticality: medium
status: active
runtime: claude-code
---

# Stitch — AI Design Generation

Generate high-fidelity UI designs from text prompts. Export Tailwind/HTML, PNG screenshot,
and DESIGN.md for handoff to `mk:frontend-design`.

**Free tier:** 400 credits/day + 15 redesign credits/day. Resets at midnight UTC.

> NOT for implementing an existing design — use `mk:figma` (Figma URL) or `mk:frontend-design`
> (existing spec/mockup). This skill generates novel designs from text only.

## Setup

### 1. API Key

Get a key at https://stitch.withgoogle.com → Settings → API Keys.

Add to `.claude/.env`:

```
STITCH_API_KEY=<your-stitch-api-key>
```

The kit's env hook loads `.claude/.env` automatically. Never hardcode the key.

### 2. Install SDK

```bash
cd .claude/skills/stitch/scripts && npm install
```

`tsx` is required to run the TypeScript scripts. It is included as a dev-dependency in
`scripts/package.json` and available via `npx tsx` after `npm install`. If `tsx` is missing,
the scripts will not start — run `npm install` first.

### 3. Optional environment variables

```env
STITCH_PROJECT_ID=<direct-stitch-project-id>   # Default project ID (bypasses name auto-detect)
STITCH_QUOTA_LIMIT=400                          # Override daily credit limit
```

### 4. MCP (optional)

See `references/stitch-mcp-setup.md` for native Stitch design context in Claude Code.

## Fail-Closed Gate

Before any script runs, verify both prerequisites:

```bash
# Key gate
[ -z "$STITCH_API_KEY" ] && { echo "[X] STITCH_API_KEY not set — add to .claude/.env"; exit 1; }

# tsx gate
npx tsx --version 2>/dev/null || { echo "[X] tsx not found — run: cd .claude/skills/stitch/scripts && npm install"; exit 1; }
```

`stitch-api-call.ts` also checks `STITCH_API_KEY` as its first action before any Stitch SDK
call. If the key is unset the script exits 1 immediately — no network request is made.

## Quick Start

```bash
# 1. Check quota
npx tsx .claude/skills/stitch/scripts/stitch-quota.ts check

# 2. Generate (API call only — returns JSON with screenId + imageUrl)
npx tsx .claude/skills/stitch/scripts/stitch-api-call.ts \
  generate "A checkout page with cart summary and payment form"

# 3. Export + write files (pipe: API call → schema-validate → write to disk)
npx tsx .claude/skills/stitch/scripts/stitch-api-call.ts export <screen-id> | \
  npx tsx .claude/skills/stitch/scripts/stitch-write-output.ts
```

## Actions

### generate

Generate a new UI design from a text prompt.

```bash
npx tsx .claude/skills/stitch/scripts/stitch-api-call.ts generate "<prompt>" \
  [--project <id>] [--project-name <title>] \
  [--device mobile|desktop|tablet] \
  [--variants <count>]
```

Returns JSON to stdout: `{ screenId, projectId, imageUrl, prompt, creditsUsed, creditsRemaining }`.

Show `imageUrl` to the user for approval before exporting.

### export + write

Two steps: fetch export URLs (API call), then write files (no API key needed).

```bash
# Step 1: get URLs from Stitch API
npx tsx .claude/skills/stitch/scripts/stitch-api-call.ts export <screen-id> \
  [--project <id>] [--format html|image|all]

# Step 2: write design files (schema-validates response, then downloads + writes)
npx tsx .claude/skills/stitch/scripts/stitch-write-output.ts \
  --input '{ "screenId": "...", "projectId": "...", "htmlUrl": "...", "imageUrl": "..." }'
```

Or pipe directly:

```bash
npx tsx .claude/skills/stitch/scripts/stitch-api-call.ts export <screen-id> | \
  npx tsx .claude/skills/stitch/scripts/stitch-write-output.ts
```

### quota

Manage the local daily quota tracker.

```bash
npx tsx .claude/skills/stitch/scripts/stitch-quota.ts check      # Show remaining credits
npx tsx .claude/skills/stitch/scripts/stitch-quota.ts increment  # Bump after generation
npx tsx .claude/skills/stitch/scripts/stitch-quota.ts reset      # Force reset
```

## Security Architecture

This skill spans three risk factors: untrusted prompt input [A], the API key [B], and file
writes [C]. Satisfying the Skill Rule of Two requires that no single step touches all three.
The boundary is split internally into two scripts — the user-facing interface remains one skill:

| Script | Risk factors | Responsibility |
|--------|-------------|----------------|
| `stitch-api-call.ts` | [A] prompt + [B] API key | Validate prompt → call Stitch API → emit JSON (no file writes) |
| `stitch-write-output.ts` | [A] validated JSON + [C] file writes | Validate schema → download CDN files → write output |

`stitch-write-output.ts` does **not** read `STITCH_API_KEY`.
`stitch-api-call.ts` does **not** write any files.
Each step holds at most two of the three risk factors.

Additional protections:
- Prompt validated for length and injection patterns before being sent to the API
- API response JSON schema-validated (typed `StitchResponseSchema`) before any file write
- CDN download URLs validated against an HTTPS/Google-domain allowlist
- Response string fields checked for instruction-override patterns — API response is DATA

## Output Paths

Design files land at:

```
tasks/designs/<plan-or-repo>/<screen-id>/
├── design.html    # Semantic HTML with Tailwind CSS
├── design.png     # Screenshot
└── DESIGN.md      # Design spec for mk:frontend-design handoff
```

`<plan-or-repo>` auto-resolves: most recent plan slug in `tasks/plans/` → git repo name →
CWD basename.

## Orchestration Pipeline

1. **Check quota** — `stitch-quota.ts check`. If exhausted (exit 2), use `mk:frontend-design`.
2. **Generate** — `stitch-api-call.ts generate` with the design prompt.
3. **Review** — Show `imageUrl` to user; get approval or iterate.
4. **Variants** (optional) — `--variants N` generates alternatives.
5. **Export** — `stitch-api-call.ts export <screen-id> --format all`.
6. **Write** — `stitch-write-output.ts` writes `design.html`, `design.png`, `DESIGN.md`.
7. **Implement** — Activate `mk:frontend-design`: "Implement from DESIGN.md".
8. **Quota tracked** — Auto-updated in step 2; confirm with `stitch-quota.ts check`.

See `references/design-to-code-pipeline.md` for detailed workflow patterns.

## Handoff Protocol

After writing, `DESIGN.md` is ready for `mk:frontend-design`:

```
Implement from tasks/designs/<plan-or-repo>/<screen-id>/DESIGN.md
```

`DESIGN.md` contains `layout_type`, `components[]`, `colors[]`, `typography`, and `spacing`
extracted from the Stitch HTML export. These tokens take precedence over verbal descriptions.

## Limitations

- **HTML/Tailwind only** — no React/Vue/Svelte export; use `mk:frontend-design` to convert
- **Non-responsive layouts** — add breakpoints during implementation
- **Static only** — no animations; add micro-interactions in code
- **Hard daily quota** — 400 credits/day free tier; no paid tier to increase limits
- **Local quota tracking** — actual usage may diverge if designs are generated outside this skill

## Gotchas

- `STITCH_API_KEY` must be in `.claude/.env` — the skill fails closed (exit 1) if unset; no network call is attempted
- `tsx` must be installed (`npm install` in `scripts/`) — scripts will not run without it; install once per machine
- Local quota can drift from real Stitch usage (e.g., designs made via the Stitch web UI); if you hit `RATE_LIMITED` despite the tracker showing credits, run `stitch-quota.ts reset`
- Screen IDs returned by `generate` are stable (Tool Contract Rule 2); project name auto-detection uses git remote then CWD basename
- The optional MCP integration stores the API key in `.claude/.mcp.json` — never commit that file; the kit's `.gitignore` covers it
- `stitch-write-output.ts` validates CDN URLs against a Google-domain allowlist; if Stitch changes CDN domains, update `ALLOWED_CDN_SUFFIXES` in that script

## References

| Topic | File |
|-------|------|
| SDK API | `references/stitch-sdk-api.md` |
| MCP Setup | `references/stitch-mcp-setup.md` |
| Pipeline Patterns | `references/design-to-code-pipeline.md` |
| Quota Strategy | `references/quota-management.md` |
