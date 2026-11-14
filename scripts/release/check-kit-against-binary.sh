#!/usr/bin/env bash
# Can the mewkit users already have install this candidate kit?
#
# Runs `init --dry-run` for every runtime, in a scratch project with a scratch
# home, against an unpacked kit. A failure here means a kit release would
# break every binary install: the kit's contract is outside the binary's range,
# it needs a newer binary (`requires.mewkitMin`), or an emitter cannot plan it.
#
# Usage: scripts/release/check-kit-against-binary.sh <mewkit> <kit-dir>
# Exit: 0 every runtime plans, 1 one does not, 2 usage.
set -u
bin=${1:-}
kit=${2:-}
if [ -z "$bin" ] || [ -z "$kit" ] || [ ! -d "$kit" ]; then
	echo "usage: $0 <mewkit> <kit-dir>" >&2
	exit 2
fi
# Each run happens in its own scratch directory, so relative paths are made absolute.
case "$kit" in /*) ;; *) kit="$PWD/$kit" ;; esac
case "$bin" in /*) ;; */*) bin="$PWD/$bin" ;; esac

scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
version=$("$bin" --version 2>/dev/null || echo "unknown version")
fail=0
for runtime in claude-code codex cursor; do
	dir="$scratch/$runtime"
	mkdir -p "$dir/project" "$dir/home"
	out=$(cd "$dir/project" && env -u CLAUDE_CONFIG_DIR -u CODEX_HOME HOME="$dir/home" USERPROFILE="$dir/home" \
		"$bin" init --target "$runtime" --dry-run --kit-dir "$kit" 2>&1)
	code=$?
	# 0: nothing to do; 3: changes pending (what a dry run of a fresh install reports).
	if [ "$code" -eq 0 ] || [ "$code" -eq 3 ]; then
		echo "  ok  $runtime ($version)"
	else
		echo "  FAIL $runtime ($version, exit $code):"
		printf '%s\n' "$out" | tail -n 15 | sed 's/^/       /'
		fail=1
	fi
done
exit "$fail"
