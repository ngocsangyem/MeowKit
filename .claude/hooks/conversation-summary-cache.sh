#!/bin/bash
# conversation-summary-cache.sh — Phase 9 dual-event middleware.
#
# Eliminates full-transcript re-reads by maintaining a Haiku-summarized cache of the
# conversation, regenerated on Stop (per throttle policy) and injected on
# UserPromptSubmit. Saves ~48KB/turn in mid-to-long sessions for ~$0.01-$0.02/session.
#
# Registered: Stop + UserPromptSubmit.
#
# Load .claude/.env (each hook is a separate subprocess)
if [ -n "$CLAUDE_PROJECT_DIR" ]; then
  . "${CLAUDE_PROJECT_DIR}/.claude/hooks/lib/load-dotenv.sh" 2>/dev/null || true
fi
# Input: JSON on stdin (parsed via lib/read-hook-input.sh).
# Branches on $HOOK_EVENT_NAME:
#   Stop              -> summarize transcript via `claude -p --model haiku` if throttled
#   UserPromptSubmit  -> echo cached summary as ## Prior conversation summary block
#   anything else     -> exit 0
#
# Env vars (Q7 Option B):
#   MEOWKIT_SUMMARY_CACHE=off            — disable both paths
#   MEOWKIT_SUMMARY_THRESHOLD=N          — min transcript bytes (default 20480 / 20KB)
#   MEOWKIT_SUMMARY_TURN_GAP=N           — min JSONL events between summaries (default 30, ≈ 3-6 turns)
#   MEOWKIT_SUMMARY_GROWTH_DELTA=N       — min bytes growth between summaries (default 5120)
#   MEOWKIT_SUMMARY_DEBUG=1              — verbose stderr
#
# Graceful degradation: if `claude` CLI missing, summarization fails, or any step
# errors, exit 0 silently with stderr warning. Never block the agent.

set -u

# Ensure CWD is project root
if [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then cd "$CLAUDE_PROJECT_DIR" || exit 0; fi

# Bypass switch
[ "${MEOWKIT_SUMMARY_CACHE:-on}" = "off" ] && exit 0

# Parse JSON on stdin (sourced — exports HOOK_* env vars).
# M5/m2 fix: prefix $CLAUDE_PROJECT_DIR to survive any cd failure above.
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
if [ -f "$PROJECT_DIR/.claude/hooks/lib/read-hook-input.sh" ]; then
  . "$PROJECT_DIR/.claude/hooks/lib/read-hook-input.sh"
fi

EVENT="${HOOK_EVENT_NAME:-}"
SESSION_ID="${HOOK_SESSION_ID:-}"
TRANSCRIPT="${HOOK_TRANSCRIPT_PATH:-}"

CACHE="$PROJECT_DIR/.claude/memory/conversation-summary.md"
TEMPLATE="$PROJECT_DIR/.claude/hooks/references/summary-prompt-template.md"

THRESHOLD="${MEOWKIT_SUMMARY_THRESHOLD:-20480}"
# M4 fix: transcript is JSONL (events, not turns). Renamed semantically.
EVENT_GAP="${MEOWKIT_SUMMARY_TURN_GAP:-30}"
GROWTH_DELTA="${MEOWKIT_SUMMARY_GROWTH_DELTA:-5120}"

dbg() { [ "${MEOWKIT_SUMMARY_DEBUG:-}" = "1" ] && echo "summary-cache: $*" >&2; }

# Pick python interpreter (frontmatter parsing). Mirror read-hook-input.sh discovery.
PY=""
if [ -x "$PROJECT_DIR/.claude/skills/.venv/bin/python3" ]; then PY="$PROJECT_DIR/.claude/skills/.venv/bin/python3";
elif command -v python3 >/dev/null 2>&1; then PY="python3";
elif command -v python >/dev/null 2>&1; then PY="python";
fi

# ----- Injection path (UserPromptSubmit) -----
inject_summary() {
  [ -f "$CACHE" ] || { dbg "no cache file"; exit 0; }

  # Read frontmatter session_id; if empty/mismatch, skip
  if [ -n "$PY" ]; then
    CACHED_SID=$(_MK_CACHE="$CACHE" "$PY" -c '
import os, re
try:
    text = open(os.environ["_MK_CACHE"]).read()
    m = re.search(r"^session_id:\s*\"?([^\"\n]*)\"?", text, re.M)
    print((m.group(1) if m else "").strip())
except Exception:
    print("")
' 2>/dev/null)
  else
    CACHED_SID=$(grep -E '^session_id:' "$CACHE" 2>/dev/null | sed -E 's/^session_id:[[:space:]]*"?([^"]*)"?.*/\1/')
  fi

  if [ -z "$CACHED_SID" ]; then
    dbg "cache empty (no session_id) → skip injection"
    exit 0
  fi

  if [ -n "$SESSION_ID" ] && [ "$CACHED_SID" != "$SESSION_ID" ]; then
    dbg "cache session_id mismatch ($CACHED_SID vs $SESSION_ID) → skip injection"
    exit 0
  fi

  # Strip frontmatter + the "# Conversation Summary" title line, emit body capped at 4096 bytes.
  # m4 fix: the injection wrapper already serves as the title → avoid double headings.
  if [ -n "$PY" ]; then
    BODY=$(_MK_CACHE="$CACHE" "$PY" -c '
import os, re
try:
    text = open(os.environ["_MK_CACHE"]).read()
    if text.startswith("---"):
        parts = text.split("---", 2)
        body = parts[2] if len(parts) >= 3 else text
    else:
        body = text
    body = re.sub(r"^\s*#\s*Conversation Summary\s*\n", "", body, count=1)
    body = body.strip()
    if len(body.encode("utf-8")) > 4096:
        body = body.encode("utf-8")[:4096].decode("utf-8", errors="ignore")
    print(body)
except Exception:
    pass
' 2>/dev/null)
  else
    BODY=$(awk 'BEGIN{fm=0} /^---$/{fm++; next} fm>=2 && !/^#[[:space:]]+Conversation Summary/{print}' "$CACHE" | head -c 4096)
  fi

  # Skip if body has no real content (only the placeholder)
  case "$BODY" in
    ""|*"empty — populated"*) dbg "cache body empty → skip"; exit 0 ;;
  esac

  printf '## Prior conversation summary\n%s\n---\n' "$BODY"
  exit 0
}

# ----- Summarization path (Stop) -----
summarize_transcript() {
  [ -z "$TRANSCRIPT" ] && { dbg "no transcript_path"; exit 0; }
  [ -f "$TRANSCRIPT" ] || { dbg "transcript missing: $TRANSCRIPT"; exit 0; }
  [ -f "$TEMPLATE" ] || { dbg "prompt template missing"; exit 0; }

  # Stat transcript size (portable BSD/GNU)
  if SIZE=$(stat -f%z "$TRANSCRIPT" 2>/dev/null); then :;
  elif SIZE=$(stat -c%s "$TRANSCRIPT" 2>/dev/null); then :;
  else SIZE=$(wc -c < "$TRANSCRIPT" 2>/dev/null | tr -d ' ');
  fi
  SIZE="${SIZE:-0}"

  if [ "$SIZE" -lt "$THRESHOLD" ]; then
    dbg "transcript $SIZE < threshold $THRESHOLD → skip"
    exit 0
  fi

  # Read previous event_count + transcript_size_bytes from cache frontmatter
  LAST_EVENTS=0
  LAST_SIZE=0
  LAST_SUMMARIES=0
  if [ -f "$CACHE" ] && [ -n "$PY" ]; then
    eval "$(_MK_CACHE="$CACHE" "$PY" -c '
import os, re
try:
    t = open(os.environ["_MK_CACHE"]).read()
    def grab(k, d="0"):
        m = re.search(r"^" + k + r":\s*([^\n]+)", t, re.M)
        return (m.group(1).strip().strip("\"") if m else d) or d
    print("LAST_EVENTS=" + grab("event_count"))
    print("LAST_SIZE=" + grab("transcript_size_bytes"))
    print("LAST_SUMMARIES=" + grab("summaries"))
except Exception:
    pass
' 2>/dev/null)"
  fi

  # M4 fix: transcript is JSONL — each line is an EVENT (tool call, tool result,
  # message delta, etc.), not a turn. ~5–10 events per turn typical. Renamed
  # variable + raised default EVENT_GAP to 30 (≈ 3–6 turns).
  CURRENT_EVENTS=$(wc -l < "$TRANSCRIPT" 2>/dev/null | tr -d ' ')
  CURRENT_EVENTS="${CURRENT_EVENTS:-0}"

  EVENT_DELTA=$(( CURRENT_EVENTS - LAST_EVENTS ))
  SIZE_DELTA=$(( SIZE - LAST_SIZE ))

  # Throttle: must satisfy size threshold AND (event gap OR growth delta)
  if [ "$EVENT_DELTA" -lt "$EVENT_GAP" ] && [ "$SIZE_DELTA" -lt "$GROWTH_DELTA" ]; then
    dbg "throttled: event_delta=$EVENT_DELTA growth=$SIZE_DELTA"
    exit 0
  fi

  # Locate claude CLI
  if ! command -v claude >/dev/null 2>&1; then
    echo "summary-cache: claude CLI not found → skipping summarization" >&2
    exit 0
  fi

  # Source secret-scrub (Phase 8 shared helper)
  if [ -f "$PROJECT_DIR/.claude/hooks/lib/secret-scrub.sh" ]; then
    . "$PROJECT_DIR/.claude/hooks/lib/secret-scrub.sh"
  else
    scrub_secrets() { cat; }  # no-op fallback
  fi

  # Lock guard — prevent overlapping background summarizers piling up
  LOCK="$PROJECT_DIR/session-state/conversation-summary.lock"
  mkdir -p "$PROJECT_DIR/session-state" 2>/dev/null
  if [ -f "$LOCK" ]; then
    # If lock is older than 5 minutes, treat it as stale and overwrite
    if [ -n "$(find "$LOCK" -mmin +5 2>/dev/null)" ]; then
      dbg "stale lock removed"
      rm -f "$LOCK"
    else
      dbg "background summarizer already running (lock present)"
      exit 0
    fi
  fi

  # Snapshot values for the worker (env survives subshell, but we capture for clarity)
  TS=$(date -u "+%Y-%m-%dT%H:%M:%SZ")
  NEW_SUMMARIES=$(( LAST_SUMMARIES + 1 ))
  BUDGET="${MEOWKIT_SUMMARY_BUDGET_SEC:-180}"
  SCRUB_LIB="$PROJECT_DIR/.claude/hooks/lib/secret-scrub.sh"
  SUMMARY_MODE="${MEOWKIT_SUMMARY_MODE:-full-regen}"
  MERGE_TEMPLATE="$PROJECT_DIR/.claude/hooks/references/merge-summary-template.md"
  VALIDATE_LIB="$PROJECT_DIR/.claude/hooks/lib/validate-content.cjs"

  # Determine if merge mode is viable: need existing summary for this session
  USE_MERGE=0
  if [ "$SUMMARY_MODE" = "merge" ] && [ -f "$CACHE" ] && [ "$LAST_SUMMARIES" -gt 0 ]; then
    if [ -f "$MERGE_TEMPLATE" ] && grep -q "session_id: \"$SESSION_ID\"" "$CACHE" 2>/dev/null; then
      USE_MERGE=1
      dbg "merge mode: existing summary found (summaries=$LAST_SUMMARIES)"
    fi
  fi

  WORKER_SCRIPT=$(mktemp -t mk-summary-worker.XXXXXX) || exit 0

  cat > "$WORKER_SCRIPT" << 'WORKER_EOF'
#!/bin/bash
set -u
trap 'rm -f "__LOCK__" "$0"' EXIT

INPUT_FILE=$(mktemp -t mk-summary-in.XXXXXX) || exit 0
OUT_FILE=$(mktemp -t mk-summary-out.XXXXXX) || exit 0

if [ "__USE_MERGE__" = "1" ]; then
  # Anchored iterative: compose from merge template + existing body + new turns
  {
    cat "__MERGE_TEMPLATE__"
    # Extract existing summary body (strip YAML frontmatter)
    awk 'BEGIN{c=0} /^---$/{c++; if(c==2){found=1; next}} found{print}' "__CACHE__" 2>/dev/null
    echo ""
    echo "=== NEW TURNS ==="
    tail -n +"__LAST_EVENTS__" "__TRANSCRIPT__" | tail -n 300
    echo ""
    echo "=== MERGED SUMMARY ==="
  } > "$INPUT_FILE" 2>/dev/null
else
  # Full regeneration (first summary or fallback)
  {
    cat "__TEMPLATE__"
    tail -n 300 "__TRANSCRIPT__"
  } > "$INPUT_FILE" 2>/dev/null
fi

# Bound the claude -p call (no `timeout` cmd on bare macOS).
claude -p --model haiku < "$INPUT_FILE" > "$OUT_FILE" 2>/dev/null &
CPID=$!
( sleep __BUDGET__ ; kill -TERM "$CPID" 2>/dev/null ) &
KPID=$!
wait "$CPID" 2>/dev/null
CRC=$?
kill -TERM "$KPID" 2>/dev/null
rm -f "$INPUT_FILE"

if [ "$CRC" -ne 0 ] || [ ! -s "$OUT_FILE" ]; then
  rm -f "$OUT_FILE"
  exit 0
fi

if [ -f "__SCRUB_LIB__" ]; then
  . "__SCRUB_LIB__"
else
  scrub_secrets() { cat; }
fi

RAW=$(cat "$OUT_FILE")
rm -f "$OUT_FILE"
CLEAN=$(scrub_secrets "$RAW")

# Content validation — reject summaries with injection patterns
if command -v node >/dev/null 2>&1 && [ -f "__VALIDATE_LIB__" ]; then
  if ! echo "$CLEAN" | node -e "
    const {validateContent}=require('__VALIDATE_LIB__');
    let t='';process.stdin.on('data',d=>t+=d);
    process.stdin.on('end',()=>{const r=validateContent(t);process.exit(r.valid?0:1);});
  " 2>/dev/null; then
    exit 0
  fi
fi

# Cap body at 10KB
if [ "${#CLEAN}" -gt 10240 ]; then
  CLEAN="${CLEAN:0:10240}"
fi

TMPCACHE="__CACHE__.tmp"
{
  printf -- '---\n'
  printf 'session_id: "__SESSION_ID__"\n'
  printf 'last_updated: "__TS__"\n'
  printf 'event_count: __CURRENT_EVENTS__\n'
  printf 'transcript_size_bytes: __SIZE__\n'
  printf 'summaries: __NEW_SUMMARIES__\n'
  printf -- '---\n\n'
  printf '%s\n' "$CLEAN"
} > "$TMPCACHE" 2>/dev/null || exit 0

mv "$TMPCACHE" "__CACHE__" 2>/dev/null || rm -f "$TMPCACHE"
exit 0
WORKER_EOF

  # Substitute placeholders. Use a sed delimiter unlikely to appear in any value.
  # Values are paths/numbers/uuids — no slashes in numbers, paths may contain /,
  # so use | as delimiter and require the inputs not contain |.
  sed -i.bak \
    -e "s|__LOCK__|$LOCK|g" \
    -e "s|__TEMPLATE__|$TEMPLATE|g" \
    -e "s|__TRANSCRIPT__|$TRANSCRIPT|g" \
    -e "s|__BUDGET__|$BUDGET|g" \
    -e "s|__SCRUB_LIB__|$SCRUB_LIB|g" \
    -e "s|__CACHE__|$CACHE|g" \
    -e "s|__SESSION_ID__|$SESSION_ID|g" \
    -e "s|__TS__|$TS|g" \
    -e "s|__CURRENT_EVENTS__|$CURRENT_EVENTS|g" \
    -e "s|__SIZE__|$SIZE|g" \
    -e "s|__NEW_SUMMARIES__|$NEW_SUMMARIES|g" \
    -e "s|__USE_MERGE__|$USE_MERGE|g" \
    -e "s|__MERGE_TEMPLATE__|$MERGE_TEMPLATE|g" \
    -e "s|__LAST_EVENTS__|$LAST_EVENTS|g" \
    -e "s|__VALIDATE_LIB__|$VALIDATE_LIB|g" \
    "$WORKER_SCRIPT" 2>/dev/null || { rm -f "$WORKER_SCRIPT" "$WORKER_SCRIPT.bak"; exit 0; }
  rm -f "$WORKER_SCRIPT.bak"

  # Create lock NOW (before launching worker) so a fast follow-up Stop sees it.
  : > "$LOCK"

  # Launch detached. nohup + redirect + disown = strongest portable detach primitive.
  nohup bash "$WORKER_SCRIPT" </dev/null >/dev/null 2>&1 &
  WORKER_PID=$!
  disown "$WORKER_PID" 2>/dev/null || disown 2>/dev/null || true

  dbg "background summarizer spawned (pid=$WORKER_PID size=$SIZE events=$CURRENT_EVENTS)"
  exit 0
}

# ----- Event dispatch -----
case "$EVENT" in
  Stop)              summarize_transcript ;;
  UserPromptSubmit)  inject_summary ;;
  *)                 dbg "ignored event: $EVENT"; exit 0 ;;
esac
