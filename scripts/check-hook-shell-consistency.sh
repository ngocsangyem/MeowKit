#!/bin/bash
# check-hook-shell-consistency.sh — fails if a hook is registered in
# .claude/settings.json with a shell interpreter that cannot run the constructs
# the script (or a library it sources) relies on.
#
# WHY: `sh` on Linux CI is dash, which rejects bash-only constructs (here-strings
# `<<<`, the `[[ ]]` test, and `name=( ... )` arrays) with a hard syntax error.
# A safety hook invoked as `sh` that hits such an error never parses its stdin,
# silently degrades to its allow-everything fallback, and disables enforcement.
# Invoking those hooks with `bash` (or keeping them dash-clean) is mandatory.
#
# Rule: a hook invoked with `sh` MUST be free of dash-fatal constructs — in its
# own body AND in every library it sources. Hooks invoked with `bash` are exempt.
#
# Opt-out: add the token `# shell-consistency:ignore` somewhere in a script to
# skip it (use only for a vetted false positive, e.g. the construct lives in a
# comment or string).
#
# Usage: bash scripts/check-hook-shell-consistency.sh [project-root]
# Exit:  0 if clean; 1 if any sh-invoked hook contains a dash-fatal construct.

set -uo pipefail
ROOT="${1:-$(pwd)}"
cd "$ROOT" || { echo "Cannot cd to $ROOT" >&2; exit 1; }

SETTINGS=".claude/settings.json"
[ -f "$SETTINGS" ] || { echo "No $SETTINGS" >&2; exit 1; }

# Emit one "<interpreter>\t<relative-script-path>" line per shell command.
# Node is guaranteed present (CI uses it for the build); JSON-parse, don't regex.
PAIRS=$(node -e '
const fs = require("fs");
const s = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const out = [];
JSON.stringify(s.hooks || {}, (k, v) => {
  if (typeof v === "string") {
    // command form: <interpreter> "<path>"  — only shell interpreters matter
    const m = v.match(/^(\S+)\s+"([^"]+)"/);
    if (m) {
      const interp = m[1];
      let p = m[2].replace(/\$\{?CLAUDE_PROJECT_DIR\}?\/?/, "");
      if ((interp === "sh" || interp === "bash") && /\.(sh)$/.test(p)) {
        out.push(interp + "\t" + p);
      }
    }
  }
  return v;
});
out.forEach((l) => console.log(l));
' "$SETTINGS")

# Dash-fatal construct detector for a single file.
# - `<<<`        bash here-string
# - `[[ … ]]`    bash test (anchored to avoid the POSIX `[[:class:]]` glob)
# - `name=( … )` bash array assignment
# Honors the per-file opt-out token.
scan_file() {
  _f="$1"
  [ -f "$_f" ] || return 0
  if grep -q 'shell-consistency:ignore' "$_f"; then
    return 0
  fi
  grep -nE '<<<|\[\[[^:]|[A-Za-z_][A-Za-z0-9_]*=\(' "$_f"
}

# Collect the libs a hook sources: `. "…/lib/foo.sh"` or `source "…/lib/foo.sh"`.
# One level deep only — no lib in .claude/hooks/lib/ currently sources another lib. If
# lib-chaining is ever introduced, extend this to recurse, or the inner lib escapes the scan.
sourced_libs() {
  grep -oE '(\.|source)[[:space:]]+"[^"]*\.claude/hooks/lib/[^"]+\.sh"' "$1" 2>/dev/null \
    | grep -oE '\.claude/hooks/lib/[^"]+\.sh' | sort -u
}

FAILED=0
while IFS=$(printf '\t') read -r interp script; do
  [ -n "${script:-}" ] || continue
  # Only sh-invoked hooks are constrained; bash is a superset and always passes.
  [ "$interp" = "sh" ] || continue

  # Scan the hook body plus every library it sources.
  targets="$script"
  for lib in $(sourced_libs "$script"); do
    targets="$targets $lib"
  done

  for t in $targets; do
    hits=$(scan_file "$t")
    if [ -n "$hits" ]; then
      echo "FAIL: '$script' is invoked with 'sh' but '$t' uses a dash-fatal construct:" >&2
      echo "$hits" | sed 's/^/    /' >&2
      echo "  Fix: invoke '$script' with 'bash' in settings.json, or make '$t' POSIX-clean." >&2
      FAILED=1
    fi
  done
done <<EOF
$PAIRS
EOF

if [ "$FAILED" -eq 0 ]; then
  echo "OK: no sh-invoked hook contains a dash-fatal construct."
  exit 0
fi
exit 1
