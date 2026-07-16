# Quota Management

Stitch free-tier quota tracking and conservation strategies.

## Limits

| Pool | Credits/Day | Reset |
|------|-------------|-------|
| Daily Credits (generate, variants) | 400 | Midnight UTC |
| Redesign Credits (screen.edit) | 15 | Midnight UTC |

Each generation = 1 credit. Each variant = 1 credit. Each edit = 1 redesign credit (separate pool).

## Local Tracking

Stitch SDK has no programmatic quota-check endpoint. The skill tracks locally:

**File:** `${CLAUDE_PLUGIN_DATA}/stitch/.stitch-quota.json` (falls back to a `stitch/` folder under the home-directory plugin-data path when `CLAUDE_PLUGIN_DATA` is unset)

```json
{
  "date": "2026-06-28",
  "count": 42,
  "limit": 400
}
```

**Auto-reset:** When `date` differs from today (UTC), count resets to 0.

**Override limit:** `export STITCH_QUOTA_LIMIT=300` (useful if Google increases free-tier limits).

## Warning Thresholds

| Remaining | Action |
|-----------|--------|
| > 20% | Normal operation |
| < 20% | `[!] Low quota` warning printed |
| 0 | `[X] Exhausted` — exit code 2 |

## Conservation Tips

1. **Use variants instead of regenerating** — 3 variants = 3 credits, but variants explore targeted alternatives
2. **Use `screen.edit()` to refine** — 1 redesign credit from the separate edit pool preserves context
3. **Export early** — don't regenerate to see the design again; export HTML/image once and reuse
4. **Batch planning** — plan all designs for the day, generate in one session
5. **Better prompts** — detailed prompts reduce regeneration cycles

## Fallback Workflow

When quota is exhausted:

1. `stitch-quota.ts check` returns exit code 2
2. Skill prints: "Daily quota exhausted. Use mk:frontend-design as fallback."
3. Activate `mk:frontend-design` with the same design prompt
4. `mk:frontend-design` generates components from the text description (no external API)
5. Proceed with implementation using text-based spec

## Drift Warning

Local tracking can drift if designs are generated outside this skill (Stitch web UI, other tools).
If you hit `RATE_LIMITED` from the Stitch API despite the local tracker showing credits:

1. Run `npx tsx .claude/skills/stitch/scripts/stitch-quota.ts reset`
2. The Stitch API enforces the real limit — local tracker is advisory only
3. On `RATE_LIMITED`, `stitch-api-call.ts` auto-syncs the tracker to `count = limit`
