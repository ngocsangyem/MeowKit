# Design Review (Step 4.5 — conditional, diff-scoped)

Check if the diff touches frontend files using `meowkit-diff-scope`:

```bash
source <(.claude/scripts/bin/meowkit-diff-scope <base> 2>/dev/null)
```

**If `SCOPE_FRONTEND=false`:** Skip design review silently. No output.

**If `SCOPE_FRONTEND=true`:**

1. **Check for DESIGN.md.** If `DESIGN.md` or `design-system.md` exists in the repo root, read it. All design findings are calibrated against it — patterns blessed in DESIGN.md are not flagged. If not found, use universal design principles.

2. **Load design rubrics from the rubric library** (NOT the deleted `design-checklist.md`). The legacy `design-checklist.md` was removed in a prior cleanup; the design judgment surface now lives in `.claude/rubrics/design-quality.md` and `.claude/rubrics/originality.md`. Load both via:

   ```bash
   .claude/skills/meow:rubric/scripts/load-rubric.sh design-quality
   .claude/skills/meow:rubric/scripts/load-rubric.sh originality
   ```

   **If the rubric library is not yet installed** (i.e., `.claude/rubrics/` does not exist), DO NOT silently skip — emit an explicit warning to the review verdict: `"WARN: design rubrics unavailable, design review degraded to mechanical-only. Install meow:rubric library."` and continue with mechanical CSS checks only. The previous silent-skip behavior masked a real evaluation gap (design review was disabled entirely without notice).

3. **Read each changed frontend file** (full file, not just diff hunks). Frontend files are identified by `.tsx`, `.jsx`, `.vue`, `.svelte`, `.css`, `.scss` extensions plus any path containing `components/`, `pages/`, `app/`, `views/`.

4. **Apply the rubrics** against the changed files. The two rubrics provide:
   - `design-quality` — typography discipline, spacing scale, palette restriction, hierarchy, component consistency, designed empty/loading/error states
   - `originality` — specific naming, non-generic copy, custom empty states, unique visual signature
   For each finding:
   - **[HIGH] mechanical CSS fix** (`outline: none`, `!important`, `font-size < 16px`): classify as AUTO-FIX
   - **[HIGH/MEDIUM] rubric-anti-pattern match**: classify as ASK with rubric citation (`design-quality.md` Anti-pattern: <name>)
   - **[LOW] intent-based detection**: present as "Possible — verify visually"

5. **Include findings** in the review output under a "Design Review" header. Cite the rubric and the specific anti-pattern matched. Design findings merge with code review findings into the same Fix-First flow.

6. **Log the result** for the Review Readiness Dashboard:

```bash
.claude/scripts/bin/meowkit-review-log '{"skill":"design-review-lite","timestamp":"TIMESTAMP","status":"STATUS","findings":N,"auto_fixed":M,"commit":"COMMIT"}'
```

Substitute: TIMESTAMP = ISO 8601 datetime, STATUS = "clean" if 0 findings or "issues_found", N = total findings, M = auto-fixed count, COMMIT = output of `git rev-parse --short HEAD`.

7. **Codex design voice** (optional, automatic if available):

```bash
which codex 2>/dev/null && echo "CODEX_AVAILABLE" || echo "CODEX_NOT_AVAILABLE"
```

If Codex is available, run a lightweight design check on the diff:

```bash
TMPERR_DRL=$(mktemp /tmp/codex-drl-XXXXXXXX)
codex exec "Review the git diff on this branch. Run 7 litmus checks (YES/NO each): 1. Brand/product unmistakable in first screen? 2. One strong visual anchor present? 3. Page understandable by scanning headlines only? 4. Each section has one job? 5. Are cards actually necessary? 6. Does motion improve hierarchy or atmosphere? 7. Would design feel premium with all decorative shadows removed? Flag any hard rejections: 1. Generic SaaS card grid as first impression 2. Beautiful image with weak brand 3. Strong headline with no clear action 4. Busy imagery behind text 5. Sections repeating same mood statement 6. Carousel with no narrative purpose 7. App UI made of stacked cards instead of layout 5 most important design findings only. Reference file:line." -s read-only -c 'model_reasoning_effort="high"' --enable web_search_cached 2>"$TMPERR_DRL"
```

Use a 5-minute timeout (`timeout: 300000`). After the command completes, read stderr:
```bash
cat "$TMPERR_DRL" && rm -f "$TMPERR_DRL"
```

**Error handling:** All errors are non-blocking. On auth failure, timeout, or empty response — skip with a brief note and continue.

Present Codex output under a `CODEX (design):` header, merged with the checklist findings above.

Include any design findings alongside the findings from Step 4. They follow the same Fix-First flow in Step 5 — AUTO-FIX for mechanical CSS fixes, ASK for everything else.
