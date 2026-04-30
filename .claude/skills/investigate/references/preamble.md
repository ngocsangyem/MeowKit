<!-- Extracted from SKILL.md for progressive disclosure (checklist #11, #14) -->
<!-- Shared protocol block — loaded once at skill start -->

## Preamble (run first)

```bash
_UPD=$(# update-check removed — MeowKit uses npx meowkit upgrade 2>/dev/null || # removed — use npx meowkit upgrade 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD" || true
mkdir -p .claude/memory/sessions
touch .claude/memory/sessions/"$PPID"
_SESSIONS=$(find .claude/memory/sessions -mmin -120 -type f 2>/dev/null | wc -l | tr -d ' ')
find .claude/memory/sessions -mmin +120 -type f -delete 2>/dev/null || true
_CONTRIB=$(.claude/scripts/bin/meowkit-config get meowkit_contributor 2>/dev/null || true)
_PROACTIVE=$(.claude/scripts/bin/meowkit-config get proactive 2>/dev/null || echo "true")
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "BRANCH: $_BRANCH"
echo "PROACTIVE: $_PROACTIVE"
source <(.claude/scripts/bin/meowkit-repo-mode 2>/dev/null) || true
REPO_MODE=${REPO_MODE:-unknown}
echo "REPO_MODE: $REPO_MODE"
_LAKE_SEEN=$([ -f .claude/memory/.completeness-intro-seen ] && echo "yes" || echo "no")
echo "LAKE_INTRO: $_LAKE_SEEN"
_TEL=$(.claude/scripts/bin/meowkit-config get telemetry 2>/dev/null || true)
_TEL_PROMPTED=$([ -f .claude/memory/.telemetry-prompted ] && echo "yes" || echo "no")
_TEL_START=$(date +%s)
_SESSION_ID="$$-$(date +%s)"
echo "TELEMETRY: ${_TEL:-off}"
echo "TEL_PROMPTED: $_TEL_PROMPTED"
mkdir -p .claude/memory
echo '{"skill":"investigate","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"'$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")'"}'  >> .claude/memory/skill-usage.jsonl 2>/dev/null || true
STATE_DIR="${CLAUDE_PLUGIN_DATA:-$HOME/.claude/data}/investigate"
mkdir -p "$STATE_DIR"
for _PF in $(find .claude/memory -maxdepth 1 -name '.pending-*' 2>/dev/null); do [ -f "$_PF" ] && break; done
```

**Memory load:** At task start, if a prior investigation left notes, read `.claude/memory/fixes.md` for relevant diagnosis patterns. At task end, append new diagnosis notes to `.claude/memory/fixes.md` with `##note:` prefix (the fix itself is persisted by `mk:fix`).

If `PROACTIVE` is `"false"`, do not proactively suggest skills — only invoke them when the user explicitly asks.

If output shows `UPGRADE_AVAILABLE <old> <new>`: follow the inline upgrade flow. If `JUST_UPGRADED <from> <to>`: tell user "Updated to v{to} — continuing." and continue.

If `LAKE_INTRO` is `no`: Introduce the Completeness Principle. Tell the user about the Boil the Lake principle, then offer to open the essay. Mark as seen with `touch .claude/memory/.completeness-intro-seen`.

If `TEL_PROMPTED` is `no` AND `LAKE_INTRO` is `yes`: Ask the user about telemetry via AskUserQuestion (community vs anonymous vs off). Mark with `touch .claude/memory/.telemetry-prompted`.
