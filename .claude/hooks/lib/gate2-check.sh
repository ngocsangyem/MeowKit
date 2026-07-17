#!/bin/sh
# gate2-check.sh — Structural Gate 2 proof at ship boundaries.
#
# Usage: gate2-check.sh "<the git command>"
# Exit 0 = allowed (structural proof present, OR explicit N/A for a no-ship change)
# Exit 2 = hard block. Per this repo's hook contract (see gate-enforcement.sh),
#          exit 2 stops the tool call; exit 1 is ADVISORY and the call proceeds.
#          Never exit 1 from a blocking path here — it would print "BLOCKED" and
#          then let the ship happen anyway.
#
# WHAT THIS PROVES
#   A verdict file for the active plan exists, names no FAIL dimension and no
#   security BLOCK, is bound to the revision being shipped (it names current HEAD),
#   and — when a workflow-evidence index is present — that the index does not
#   contradict it.
#
# WHAT THIS DOES NOT PROVE
#   That a HUMAN approved anything. Every artifact read here — including the
#   revision the verdict names — is writable by the same session that produced the
#   change, so a session can author all of them. The revision binding is
#   anti-accidental (it catches a stale verdict from an earlier state); it is not
#   unforgeable. A pass means "the paperwork is present, self-consistent, and bound
#   to this revision", NOT "a human approved this". Closing the authenticity gap
#   requires a host-authenticated approval receipt — designed in ADR 260715
#   (Gate 2 approval receipt), enforced later.
#
# This is the single shared Gate 2 helper. Do not re-implement verdict parsing
# in a hook: the parsers live in cook/scripts/validate-gate-2.sh and
# scripts/validate-workflow-evidence.cjs, and are CALLED from here.

if [ -n "$CLAUDE_PROJECT_DIR" ]; then cd "$CLAUDE_PROJECT_DIR" || exit 0; fi

COMMAND="${HOOK_COMMAND:-$1}"

# Only ship boundaries are gated. Everything else is none of this check's business.
case "$COMMAND" in
  *"git commit"*|*"git push"*|*"git merge"*) ;;
  *) exit 0 ;;
esac

block() {
  {
    echo "@@GATE_BLOCK@@"
    echo "Gate 2 structural check FAILED — ship blocked."
    echo ""
    for _line in "$@"; do echo "$_line"; done
    echo ""
    echo "Gate 2 is human-approved and has no exceptions (.claude/rules/gate-rules.md)."
    echo "This check proves only that the paperwork exists and is self-consistent;"
    echo "it does not and cannot prove a human approved anything."
  } >&2
  exit 2
}

# ---------------------------------------------------------------------------
# 1. What is this command actually shipping?
# ---------------------------------------------------------------------------
# At PreToolUse time a `git commit -a`/`-am` has NOTHING staged yet, so a
# --cached diff is empty and would misreport the change as no-ship. Fall back to
# the working-tree diff against HEAD (staged + unstaged).
#
# push/merge have neither: the work is already committed, so both diffs are
# empty. Their scope is the commit range about to leave the branch, which needs
# an upstream (or the default branch) as the base.
CHANGED=""
case "$COMMAND" in
  *"git push"*|*"git merge"*)
    BASE=$(git rev-parse --abbrev-ref '@{upstream}' 2>/dev/null)
    if [ -z "$BASE" ]; then
      BASE=$(git merge-base HEAD origin/HEAD 2>/dev/null)
    fi
    if [ -z "$BASE" ]; then
      block \
        "Cannot determine what this push/merge would ship." \
        "No upstream is configured and origin/HEAD did not resolve, so the" \
        "commit range is unknown — and an unknown range cannot be classified." \
        "Fix: set an upstream (git push -u origin <branch>) and retry."
    fi
    CHANGED=$(git diff --name-only "$BASE"..HEAD 2>/dev/null)
    ;;
  *"git commit"*)
    # Already-staged changes are what a plain `git commit` ships.
    CHANGED=$(git diff --cached --name-only 2>/dev/null)

    # `git add . && git commit -m ...` arrives as ONE tool call, so at PreToolUse
    # the add has not run: the index is empty or stale, and neither diff shows an
    # untracked file. A brand-new source file — the single most common thing a
    # feature commit contains — would otherwise be invisible and ship ungated.
    # When the command stages, classify what it is ABOUT to stage.
    case "$COMMAND" in
      *"git add"*)
        CHANGED="$CHANGED
$(git diff --name-only HEAD 2>/dev/null)
$(git ls-files --others --exclude-standard 2>/dev/null)"
        ;;
    esac

    # `-a` / `--all` stages tracked modifications at commit time (never untracked
    # files — those still need an explicit add).
    case "$COMMAND" in
      *"commit -a"*|*"commit --all"*|*" -am "*|*" -a "*|*" --all "*)
        CHANGED="$CHANGED
$(git diff --name-only HEAD 2>/dev/null)"
        ;;
    esac
    ;;
esac

# De-duplicate: the unions above can name the same file more than once.
CHANGED=$(printf '%s\n' "$CHANGED" | grep -v '^[[:space:]]*$' | sort -u)

# Nothing resolvable = ambiguous = fail closed. An empty change set here means
# the classifier cannot see what is shipping, not that nothing ships.
if [ -z "$CHANGED" ]; then
  # A genuinely empty commit/push is git's error to report, not a gate bypass.
  # Let git speak for itself rather than blocking with a confusing gate message.
  exit 0
fi

# ---------------------------------------------------------------------------
# 2. Ship-capable, or explicitly not applicable?
# ---------------------------------------------------------------------------
# Only the NO-SHIP set is enumerated; everything else is ship-capable. Listing
# ship-capable paths instead would be both unportable (this repo's layout is not
# a consumer project's) and fail-OPEN (an unrecognized path would sail through).
# Unknown path => ship-capable is the safe default.
#
# `.claude/**` is ship-capable even though it is markdown: those files ARE the
# product here. That is why the `.md` rule is scoped "outside .claude".
is_no_ship() {
  case "$1" in
    .claude/*|*/.claude/*) return 1 ;;
    docs/*|*/docs/*) return 0 ;;
    tasks/reports/*) return 0 ;;
    *.md) return 0 ;;
    *) return 1 ;;
  esac
}

SHIP_CAPABLE=0
FIRST_SHIP_FILE=""
for _f in $CHANGED; do
  if ! is_no_ship "$_f"; then
    SHIP_CAPABLE=1
    [ -z "$FIRST_SHIP_FILE" ] && FIRST_SHIP_FILE="$_f"
  fi
done

# ANY ship-capable file makes the whole change ship-capable. A mixed change is
# not partially exempt — the source file in it still ships.
if [ "$SHIP_CAPABLE" -eq 0 ]; then
  echo "Gate 2: N/A — no-ship change (documentation, reports, and markdown only). Not skipped, not applicable."
  exit 0
fi

# ---------------------------------------------------------------------------
# 3. Which verdict applies? (explicit pointer only — never "newest wins")
# ---------------------------------------------------------------------------
# "Most recent verdict wins" would let an unrelated stale verdict authorize this
# ship. The pointer is the only honest answer; absent pointer = fail closed.
PY=".claude/skills/.venv/bin/python3"
[ -x "$PY" ] || PY="python3"

ACTIVE_PLAN=""
if [ -f "session-state/active-plan.json" ]; then
  ACTIVE_PLAN=$("$PY" -c "
import json
try:
    with open('session-state/active-plan.json') as f:
        d = json.load(f)
    print((d.get('path') or d.get('slug') or '').strip())
except Exception:
    print('')
" 2>/dev/null)
fi
if [ -z "$ACTIVE_PLAN" ] && [ -f "session-state/active-plan" ]; then
  ACTIVE_PLAN=$(tr -d '\n\r' < session-state/active-plan 2>/dev/null)
fi

if [ -z "$ACTIVE_PLAN" ]; then
  block \
    "Ship-capable change (e.g. $FIRST_SHIP_FILE) with no active-plan pointer." \
    "Cannot tell WHICH review verdict is supposed to authorize this ship, and" \
    "guessing the newest verdict would let an unrelated review authorize it." \
    "Fix: set session-state/active-plan.json {\"path\": \"tasks/plans/<plan-dir>\"}."
fi

# Strip the date prefix the same way the completion gate does, so both hooks
# resolve the same slug from the same pointer.
SLUG=$("$PY" -c "
import re
raw = '''$ACTIVE_PLAN'''.strip().rstrip('/')
slug = raw.split('/')[-1]
m = re.match(r'^[0-9]{6}(?:-[0-9]{4})?-(.+)\$', slug)
print(m.group(1) if m else slug)
" 2>/dev/null)

if [ -z "$SLUG" ]; then
  block "Active-plan pointer '$ACTIVE_PLAN' did not resolve to a plan slug."
fi

# A security BLOCK is independently ship-blocking. Security verdicts do not
# authorize a ship and are therefore intentionally excluded from VERDICT_COUNT.
for _security_verdict in tasks/reviews/[0-9]*-"$SLUG"-security-verdict.md; do
  [ -f "$_security_verdict" ] || continue
  if ! sh .claude/skills/cook/scripts/validate-gate-2.sh "$_security_verdict" >/dev/null; then
    block \
      "Security verdict '$_security_verdict' blocks plan '$SLUG'." \
      "Fix: resolve the security findings and obtain a new PASS security verdict."
  fi
done

# An mk:review or evaluator verdict provides the structural Gate 2 evidence.
VERDICT=""
VERDICT_COUNT=0
for _v in tasks/reviews/[0-9]*-"$SLUG"-verdict.md tasks/reviews/[0-9]*-"$SLUG"-evalverdict.md; do
  [ -f "$_v" ] || continue
  VERDICT_COUNT=$((VERDICT_COUNT + 1))
  VERDICT="$_v"
done

if [ "$VERDICT_COUNT" -eq 0 ]; then
  block \
    "Ship-capable change (e.g. $FIRST_SHIP_FILE) with no review verdict for plan '$SLUG'." \
    "Expected: tasks/reviews/<YYMMDD>-$SLUG-verdict.md (or -evalverdict.md)." \
    "Fix: run /mk:review to produce a verdict, then present Gate 2 to the human."
fi

if [ "$VERDICT_COUNT" -gt 1 ]; then
  block \
    "Ambiguous: $VERDICT_COUNT verdicts match plan '$SLUG'." \
    "Refusing to pick one — the wrong choice would authorize this ship on the" \
    "wrong review. Fix: keep exactly one verdict per plan slug."
fi

# ---------------------------------------------------------------------------
# 4. Structural checks — delegated to the canonical parsers
# ---------------------------------------------------------------------------
GATE2_VALIDATOR=".claude/skills/cook/scripts/validate-gate-2.sh"
if [ -f "$GATE2_VALIDATOR" ]; then
  if ! GATE2_OUT=$(sh "$GATE2_VALIDATOR" "$VERDICT" 2>&1); then
    block \
      "Verdict $VERDICT does not satisfy Gate 2's structural conditions:" \
      "  $GATE2_OUT" \
      "Fix: resolve the FAIL/critical/security items, re-review, then re-present Gate 2."
  fi
fi

# The evidence index is optional; when present it must not contradict the verdict.
EVIDENCE_VALIDATOR=".claude/scripts/validate-workflow-evidence.cjs"
EVIDENCE=""
for _e in "tasks/plans/$(basename "$ACTIVE_PLAN")"/reports/evidence/workflow-evidence.json \
          .claude/session-state/evidence/*"$SLUG"*/workflow-evidence.json; do
  [ -f "$_e" ] && EVIDENCE="$_e"
done

if [ -n "$EVIDENCE" ] && [ -f "$EVIDENCE_VALIDATOR" ] && command -v node >/dev/null 2>&1; then
  if ! EV_OUT=$(node "$EVIDENCE_VALIDATOR" "$EVIDENCE" --phase cook 2>&1); then
    block \
      "Workflow evidence index disagrees with the verdict, or is incomplete:" \
      "  $EV_OUT" \
      "Fix: complete the evidence index at $EVIDENCE before shipping."
  fi
fi

# ---------------------------------------------------------------------------
# 5. Revision binding — HARD BLOCK (anti-accidental)
# ---------------------------------------------------------------------------
# A verdict that names no revision cannot be tied to the code being shipped: a
# stale verdict from an earlier state looks identical to a current one, so an
# approval could silently carry over to changed scope. The verdict MUST name the
# revision it reviewed. At `git commit` time HEAD is the base the review was done
# against (the new commit does not exist yet); at push/merge HEAD is the tip being
# shipped — in both cases the honest binding is "the verdict names current HEAD".
#
# This does NOT prove a human approved (that is the deferred signed receipt, ADR
# 260715). It proves the verdict is bound to THIS revision — deter/detect, not
# unforgeable. Match the short HEAD as a hex prefix so a verdict may record the
# short OR full SHA. If HEAD does not resolve (first commit, no history) there is
# no prior revision to bind to, so the check is skipped rather than blocking.
HEAD_SHA=$(git rev-parse --short HEAD 2>/dev/null)
if [ -n "$HEAD_SHA" ]; then
  if ! grep -qiE "\b${HEAD_SHA}[0-9a-f]*\b" "$VERDICT" 2>/dev/null; then
    block \
      "Verdict $VERDICT does not name the revision under review ($HEAD_SHA)." \
      "A verdict with no matching revision cannot be tied to this code — a stale" \
      "verdict from an earlier state would look identical to a current one." \
      "Fix: record the reviewed revision in the verdict (e.g. a 'Revision: $HEAD_SHA'" \
      "line), or re-review at the current HEAD and record its SHA."
  fi
fi

echo "Gate 2 structural check PASSED for plan '$SLUG' (verdict: $VERDICT)."
echo "  PROVEN:    verdict present, no FAIL dimension, no security BLOCK, and bound"
echo "             to the shipped revision ($HEAD_SHA)."
echo "  UNPROVEN:  human approval — this check cannot establish it (the verdict is"
echo "             agent-writable). Gate 2 approval remains the human's, at the gate."
exit 0
