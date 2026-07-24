# Preamble (run first)

```bash
mkdir -p .meowkit/memory/sessions
touch .meowkit/memory/sessions/"$PPID"
_SESSIONS=$(find .meowkit/memory/sessions -mmin -120 -type f 2>/dev/null | wc -l | tr -d ' ')
find .meowkit/memory/sessions -mmin +120 -type f -delete 2>/dev/null || true
_CONTRIB=$(.codex/scripts/bin/workflow-config get contributor 2>/dev/null || true)
_PROACTIVE=$(.codex/scripts/bin/workflow-config get proactive 2>/dev/null || echo "true")
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "BRANCH: $_BRANCH"
echo "PROACTIVE: $_PROACTIVE"
source <(.codex/scripts/bin/workflow-repo-mode 2>/dev/null) || true
REPO_MODE=${REPO_MODE:-unknown}
echo "REPO_MODE: $REPO_MODE"
_LAKE_SEEN=$([ -f .meowkit/memory/.completeness-intro-seen ] && echo "yes" || echo "no")
echo "LAKE_INTRO: $_LAKE_SEEN"
_TEL=$(.codex/scripts/bin/workflow-config get telemetry 2>/dev/null || true)
_TEL_PROMPTED=$([ -f .meowkit/memory/.telemetry-prompted ] && echo "yes" || echo "no")
_TEL_START=$(date +%s)
_SESSION_ID="$$-$(date +%s)"
echo "TELEMETRY: ${_TEL:-off}"
echo "TEL_PROMPTED: $_TEL_PROMPTED"
mkdir -p .meowkit/memory
echo '{"skill":"document-release","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"'$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")'"}'  >> .meowkit/memory/skill-usage.jsonl 2>/dev/null || true
# zsh-compatible: use find instead of glob to avoid NOMATCH error
```

If `PROACTIVE` is `"false"`, do not proactively suggest skills — only invoke
them when the user explicitly asks. The user opted out of proactive suggestions.

If `LAKE_INTRO` is `no`: Before continuing, introduce the Completeness Principle.
Tell the user: "This workflow follows the **Boil the Lake** principle — always do the complete
thing when AI makes the marginal cost near-zero. Read more: https://garryslist.org/posts/boil-the-ocean"
Then offer to open the essay in their default browser:

```bash
open https://garryslist.org/posts/boil-the-ocean
touch .meowkit/memory/.completeness-intro-seen
```

Only run `open` if the user says yes. Always run `touch` to mark as seen. This only happens once.

If `TEL_PROMPTED` is `no` AND `LAKE_INTRO` is `yes`: After the lake intro is handled,
ask the user about telemetry. Use stop and ask the user in chat:

> Help improve this workflow! Community mode shares usage data (which skills you use, how long
> they take, crash info) with a stable device ID so we can track trends and fix bugs faster.
> No code, file paths, or repo names are ever sent.
> Change anytime with `workflow-config set telemetry off`.

Options:
- A) Help improve the workflow! (recommended)
- B) No thanks

If A: run `.codex/scripts/bin/workflow-config set telemetry community`

If B: ask a follow-up stop and ask the user in chat:

> How about anonymous mode? We just learn that *someone* used this workflow — no unique ID,
> no way to connect sessions. Just a counter that helps us know if anyone's out there.

Options:
- A) Sure, anonymous is fine
- B) No thanks, fully off

If B→A: run `.codex/scripts/bin/workflow-config set telemetry anonymous`
If B→B: run `.codex/scripts/bin/workflow-config set telemetry off`

Always run:
```bash
touch .meowkit/memory/.telemetry-prompted
```

This only happens once. If `TEL_PROMPTED` is `yes`, skip this entirely.
