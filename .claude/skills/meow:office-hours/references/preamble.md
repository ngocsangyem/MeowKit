# Preamble & Setup

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
echo '{"skill":"office-hours","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"'$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")'"}'  >> .claude/memory/skill-usage.jsonl 2>/dev/null || true
# zsh-compatible: use find instead of glob to avoid NOMATCH error
for _PF in $(find .claude/memory -maxdepth 1 -name '.pending-*' 2>/dev/null); do [ -f "$_PF" ] && # telemetry removed — MeowKit uses analyst agent --event-type skill_run --skill _pending_finalize --outcome unknown --session-id "$_SESSION_ID" 2>/dev/null || true; break; done
```

If `PROACTIVE` is `"false"`, do not proactively suggest MeowKit skills — only invoke
them when the user explicitly asks. The user opted out of proactive suggestions.

If output shows `UPGRADE_AVAILABLE <old> <new>`: read `# upgrade removed — use npx meowkit upgrade` and follow the "Inline upgrade flow" (auto-upgrade if configured, otherwise AskUserQuestion with 4 options, write snooze state if declined). If `JUST_UPGRADED <from> <to>`: tell user "Running MeowKit v{to} (just updated!)" and continue.

If `LAKE_INTRO` is `no`: Before continuing, introduce the Completeness Principle.
Tell the user: "MeowKit follows the **Boil the Lake** principle — always do the complete
thing when AI makes the marginal cost near-zero. Read more: https://garryslist.org/posts/boil-the-ocean"
Then offer to open the essay in their default browser:

```bash
open https://garryslist.org/posts/boil-the-ocean
touch .claude/memory/.completeness-intro-seen
```

Only run `open` if the user says yes. Always run `touch` to mark as seen. This only happens once.

If `TEL_PROMPTED` is `no` AND `LAKE_INTRO` is `yes`: After the lake intro is handled,
ask the user about telemetry. Use AskUserQuestion:

> Help MeowKit get better! Community mode shares usage data (which skills you use, how long
> they take, crash info) with a stable device ID so we can track trends and fix bugs faster.
> No code, file paths, or repo names are ever sent.
> Change anytime with `meowkit-config set telemetry off`.

Options:
- A) Help MeowKit get better! (recommended)
- B) No thanks

If A: run `.claude/scripts/bin/meowkit-config set telemetry community`

If B: ask a follow-up AskUserQuestion:

> How about anonymous mode? We just learn that *someone* used MeowKit — no unique ID,
> no way to connect sessions. Just a counter that helps us know if anyone's out there.

Options:
- A) Sure, anonymous is fine
- B) No thanks, fully off

If B→A: run `.claude/scripts/bin/meowkit-config set telemetry anonymous`
If B→B: run `.claude/scripts/bin/meowkit-config set telemetry off`

Always run:
```bash
touch .claude/memory/.telemetry-prompted
```

This only happens once. If `TEL_PROMPTED` is `yes`, skip this entirely.

## Memory

- **Writes memory:** when the session produces a design-doc decision, append to `.claude/memory/architecture-decisions.md` with `##decision:` prefix. Do not overwrite prior entries — always append.

## SETUP (run this check BEFORE any browse command)

```bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
B=""
[ -n "$_ROOT" ] && [ -x "$_ROOT/.claude/skills/meow:browse/dist/browse" ] && B="$_ROOT/.claude/skills/meow:browse/dist/browse"
[ -z "$B" ] && B=.claude/skills/meow:browse/dist/browse
if [ -x "$B" ]; then
  echo "READY: $B"
else
  echo "NEEDS_SETUP"
fi
```

If `NEEDS_SETUP`:
1. Tell the user: "MeowKit browse needs a one-time build (~10 seconds). OK to proceed?" Then STOP and wait.
2. Run: `cd <SKILL_DIR> && ./setup`
3. If `bun` is not installed: `curl -fsSL https://bun.sh/install | bash`
