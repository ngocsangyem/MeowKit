#!/bin/sh
# approval-receipt.sh — the single home for the Gate 1 plan-approval receipt.
#
# Threat model: ANTI-ACCIDENTAL (deter/detect, not unforgeable). The receipt is
# agent-writable by design — it proves "an approval was stamped against THIS plan
# revision", never "a human approved". Host-authenticated approval stays deferred
# (see ADR 260715, Gate 2 approval receipt). The value here is the
# revision BINDING: editing the plan body after approval invalidates the stamp, so
# an approval can never silently carry over to changed scope.
#
# One home, two callers: the write path (`mewkit plan approve` → `stamp`) and the
# shell gate (`gate-enforcement.sh` → `verify`) both use THIS file, so the hash can
# never drift between writer and verifier. Pure POSIX sh + shasum/sha256sum only —
# no dependency on any host beyond git/sh (generic-toolkit constraint).
#
# Subcommands:
#   hash   <plan.md>              print the frontmatter-excluded body hash
#   stamp  <plan.md> [approver]   write/replace the `approval:` block in frontmatter
#   verify <plan.md>              exit 0 fresh · 10 no-receipt · 11 stale · 12 unreadable
#
# The body hash EXCLUDES YAML frontmatter on purpose: the stamp lives IN the
# frontmatter, so hashing the body means stamping never invalidates itself, while
# any edit to the plan's actual content (the body) does — which is the whole point.

set -u

# --- portable sha-256 of stdin -------------------------------------------------
_sha256() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum | awk '{print $1}'
  else
    echo "approval-receipt: no shasum/sha256sum available" >&2
    return 1
  fi
}

# Emit the plan BODY (everything after the closing `---` of YAML frontmatter). If
# the file has no frontmatter, the whole file is the body.
_plan_body() {
  awk '
    NR == 1 && $0 == "---" { in_fm = 1; next }
    in_fm && $0 == "---"   { in_fm = 0; body = 1; next }
    in_fm                  { next }
    { print }
  ' "$1"
}

_plan_hash() {
  _plan_body "$1" | _sha256
}

# --- read the stored plan_hash from an existing approval block (or empty) ------
_stored_hash() {
  awk '
    /^approval:[[:space:]]*$/ { in_appr = 1; next }
    in_appr && /^[[:space:]]+plan_hash:[[:space:]]*/ {
      sub(/^[[:space:]]+plan_hash:[[:space:]]*/, ""); gsub(/[[:space:]]/, ""); print; exit
    }
    in_appr && /^[^[:space:]]/ { in_appr = 0 }   # dedented key ⇒ block ended
  ' "$1"
}

cmd_hash() {
  [ -f "$1" ] || { echo "approval-receipt: not a file: $1" >&2; return 12; }
  _plan_hash "$1"
}

# stamp: recompute the body hash and write a fresh approval block into frontmatter,
# replacing any prior approval block. Requires the file to already have YAML
# frontmatter (a plan always does); refuses otherwise rather than guessing.
cmd_stamp() {
  _file="$1"
  _approver="${2:-human}"
  [ -f "$_file" ] || { echo "approval-receipt: not a file: $_file" >&2; return 12; }
  if [ "$(head -n 1 "$_file")" != "---" ]; then
    echo "approval-receipt: $_file has no YAML frontmatter to stamp" >&2
    return 12
  fi

  _hash="$(_plan_hash "$_file")"
  # Hooks have no reliable clock beyond `date`; UTC date is enough for an audit stamp.
  _date="$(date -u +%Y-%m-%d 2>/dev/null || echo unknown)"
  _tmp="$_file.approval.$$"

  # awk pass: strip any existing top-level `approval:` block inside frontmatter,
  # then inject a fresh one immediately before the closing `---`.
  awk -v approver="$_approver" -v date="$_date" -v hash="$_hash" '
    BEGIN { in_fm = 0; done = 0; skip_appr = 0 }
    NR == 1 && $0 == "---" { in_fm = 1; print; next }
    in_fm && $0 == "---" {
      # closing fence — inject the receipt first
      print "approval:"
      print "  approved_by: " approver
      print "  date: " date
      print "  plan_hash: " hash
      print $0
      in_fm = 0; done = 1; next
    }
    in_fm && skip_appr && /^[[:space:]]/ { next }        # child of old approval block
    in_fm && skip_appr && /^[^[:space:]]/ { skip_appr = 0 }  # dedent ends old block
    in_fm && /^approval:[[:space:]]*$/ { skip_appr = 1; next }
    { print }
  ' "$_file" > "$_tmp" || { rm -f "$_tmp"; return 12; }

  # Guard: the receipt is injected only at the CLOSING frontmatter fence. If the plan
  # had no closing `---`, awk emitted nothing and we would silently "succeed" on an
  # unstamped file (which then reads as no-receipt ⇒ block — fail-closed, but the
  # success message would be a lie). Refuse instead of misreporting.
  if ! grep -q '^approval:[[:space:]]*$' "$_tmp"; then
    rm -f "$_tmp"
    echo "approval-receipt: $_file has no closing frontmatter fence — nothing stamped" >&2
    return 12
  fi
  mv "$_tmp" "$_file" || { rm -f "$_tmp"; return 12; }
  _short="$(printf '%s' "$_hash" | cut -c1-10)"
  echo "Stamped approval on $_file (plan_hash ${_short}…, approved_by: $_approver, date: $_date)"
}

# verify: exit 0 fresh · 10 no receipt · 11 stale (body changed since approval) · 12 unreadable
cmd_verify() {
  _file="$1"
  [ -f "$_file" ] || { echo "unreadable: $_file"; return 12; }
  _stored="$(_stored_hash "$_file")"
  if [ -z "$_stored" ]; then
    echo "no-receipt"
    return 10
  fi
  _current="$(_plan_hash "$_file")"
  if [ "$_stored" = "$_current" ]; then
    echo "fresh"
    return 0
  fi
  echo "stale"
  return 11
}

_usage() {
  echo "Usage: approval-receipt.sh {hash|stamp|verify} <plan.md> [approver]" >&2
}

# Only dispatch when executed directly, so gate-enforcement.sh can `.`-source the
# helper functions (_plan_hash, cmd_verify) without triggering the CLI.
case "${APPROVAL_RECEIPT_LIB:-}" in
  1) : ;;                                   # sourced as a library — expose funcs only
  *)
    _sub="${1:-}"; shift 2>/dev/null || true
    case "$_sub" in
      hash)   cmd_hash "$@" ;;
      stamp)  cmd_stamp "$@" ;;
      verify) cmd_verify "$@" ;;
      *)      _usage; exit 64 ;;
    esac
    ;;
esac
