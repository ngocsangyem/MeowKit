#!/usr/bin/env bash
# Clone-without-init journey: a real `git clone` of this tree's committed kit
# content, no `mewkit` on PATH, no network, and a full session's hooks driven
# through the real entrypoints.
#
# Nothing is written to the source repository. The clone source is a throwaway
# repository built in $TMPDIR from a copy of the working tree's kit files, so the
# `git commit` a clone needs happens there and only there.
set -u

REPO="${1:?usage: clone-journey.sh <repo-root>}"
T="$(mktemp -d "${TMPDIR:-/tmp}/meowkit-clone.XXXXXX")"
SRC="$T/source"
CLONE="$T/clone"
BIN="$T/bin"
EVENTS="$T/events.log"
FULL_PATH="$PATH"

say() { printf '\n=== %s\n' "$*"; }

say "environment"
echo "repo:   $REPO"
echo "tmp:    $T"
echo "node:   $(command -v node) $(node --version)"
echo "git:    $(command -v git)"

# ---------------------------------------------------------------- source repo
mkdir -p "$SRC" "$BIN" "$T/home"
git -C "$SRC" init -q
git -C "$SRC" config user.email "clone-journey@example.invalid"
git -C "$SRC" config user.name "Clone Journey"
# The committed surface of a v3 project: the whole kit tree, plus the `.meowkit/`
# members the deny-all ignore file allowlists. A sibling session checkout and the
# log directory are not kit content.
rsync -a --exclude 'worktrees/' --exclude 'logs/' "$REPO/.claude/" "$SRC/.claude/"
mkdir -p "$SRC/.meowkit/memory"
for f in .gitignore .env.example config.yaml mcp.json.example; do
	[ -f "$REPO/.meowkit/$f" ] && cp "$REPO/.meowkit/$f" "$SRC/.meowkit/$f"
done
cp "$REPO"/.meowkit/memory/*.md "$SRC/.meowkit/memory/" 2>/dev/null
cp "$REPO/CLAUDE.md" "$SRC/CLAUDE.md" 2>/dev/null
git -C "$SRC" add -A
git -C "$SRC" commit -q -m "kit content as a project commits it"

say "what the source repository tracks under .meowkit/"
git -C "$SRC" ls-files .meowkit

# -------------------------------------------------------------------- the clone
git clone -q "$SRC" "$CLONE"
say "the clone"
echo "clone:                  $CLONE"
echo "tracked files:          $(git -C "$CLONE" ls-files | wc -l | tr -d ' ')"
echo "node_modules:           $([ -e "$CLONE/node_modules" ] && echo present || echo absent)"
echo ".meowkit/cache:         $([ -e "$CLONE/.meowkit/cache" ] && echo present || echo absent)"
echo ".meowkit/metadata.json: $([ -e "$CLONE/.meowkit/metadata.json" ] && echo present || echo absent)"
echo "tasks/plans:            $([ -e "$CLONE/tasks/plans" ] && echo present || echo absent)"

# --------------------------------------------------- the offline sandbox itself
# A closed-port proxy is not enough on this Node (fetch ignores NODE_USE_ENV_PROXY
# here), so the refusal is installed in-process and inherited by every child
# through NODE_OPTIONS: name resolution and socket connect both fail. The error
# code is deliberately NOT one of the three the transcript is grepped for, so a
# hook that tried to reach the network shows up as its own distinct string.
cat > "$T/offline.cjs" <<'OFFLINE'
const net = require("node:net");
const dns = require("node:dns");
const refuse = (what) => Object.assign(new Error(`offline sandbox refused ${what}`), { code: "EOFFLINE" });
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
	const cb = args.find((a) => typeof a === "function");
	if (typeof cb === "function") this.once("error", () => {});
	process.nextTick(() => this.destroy(refuse("a socket connection")));
	return this;
};
void connect;
dns.lookup = (host, _opts, cb) => {
	const done = typeof _opts === "function" ? _opts : cb;
	process.nextTick(() => done(refuse(`a DNS lookup for ${host}`)));
};
dns.promises.lookup = async (host) => {
	throw refuse(`a DNS lookup for ${host}`);
};
OFFLINE

export PATH="$BIN"
ln -sf "$(command -v node 2>/dev/null || echo "${FULL_PATH%%:*}/node")" "$BIN/node" 2>/dev/null
PATH="$FULL_PATH" ln -sf "$(PATH="$FULL_PATH" command -v node)" "$BIN/node"
PATH="$FULL_PATH" ln -sf "$(PATH="$FULL_PATH" command -v git)" "$BIN/git"
export HOME="$T/home"
export NODE_OPTIONS="--require $T/offline.cjs"
export CLAUDE_PROJECT_DIR="$CLONE"
# Every kit env name dropped, so nothing in the invoking shell decides the run.
while IFS='=' read -r name _; do unset "$name"; done < <(PATH="$FULL_PATH" env | PATH="$FULL_PATH" grep -E '^(MEOWKIT|MEOW|MK)_')

say "environment capture"
echo "PATH:                 $PATH"
echo "command -v mewkit:    $(command -v mewkit || echo '(not found)')"
echo "command -v npx:       $(command -v npx || echo '(not found)')"
echo "command -v node:      $(command -v node)"
printf 'fetch probe:          '
node -e 'fetch("https://github.com").then((r)=>console.log("REACHABLE",r.status)).catch((e)=>console.log("unreachable:",(e.cause&&e.cause.code)||e.message))'
printf 'socket probe:         '
node -e 'const s=require("node:net").connect(443,"github.com");s.on("connect",()=>console.log("REACHABLE"));s.on("error",(e)=>console.log("unreachable:",e.code));'

# ------------------------------------------------------- a full session's hooks
: > "$EVENTS"
event() {
	local label="$1" entry="$2" payload="$3"
	shift 3
	{
		printf '\n--- %s :: %s %s\n' "$label" "$entry" "$*"
		printf '%s' "$payload" | (cd "$CLONE" && node "$CLONE/$entry" "$@" 2>&1)
		printf 'exit: %s\n' "$?"
	} >> "$EVENTS"
}

json() { printf '{"session_id":"clone-journey","cwd":"%s","hook_event_name":"%s","tool_name":"%s","tool_input":%s}' "$CLONE" "$1" "$2" "$3"; }

event "1 SessionStart" ".claude/hooks/dispatch.cjs" \
	"$(printf '{"session_id":"clone-journey","cwd":"%s","hook_event_name":"SessionStart"}' "$CLONE")" SessionStart
event "2 PreToolUse Edit — Gate 1" ".claude/hooks/gate-enforcement.cjs" \
	"$(json PreToolUse Edit '{"file_path":"src/app.ts"}')"
event "3 PreToolUse Read — privacy" ".claude/hooks/privacy-block.cjs" \
	"$(json PreToolUse Read '{"file_path":".env"}')"
# Twice, because the two halves of the clause are different states. With nothing
# ship-capable staged the ship is N/A and the memory-store lint is what degrades;
# with a staged source file, Gate 2 has to block.
SHIP_CMD='{"command":"git commit -m \"ship it\""}'
event "4 PreToolUse Bash — pre-ship, nothing staged" ".claude/hooks/pre-ship.cjs" \
	"$(json PreToolUse Bash "$SHIP_CMD")"
node -e 'const fs=require("node:fs"),p=process.argv[1];fs.mkdirSync(p+"/src",{recursive:true});fs.writeFileSync(p+"/src/app.ts","export const x = 1;\n")' "$CLONE"
git -C "$CLONE" add src/app.ts
event "4b PreToolUse Bash — pre-ship, a source file staged" ".claude/hooks/pre-ship.cjs" \
	"$(json PreToolUse Bash "$SHIP_CMD")"
event "4c PreToolUse Bash — observers" ".claude/hooks/dispatch.cjs" \
	"$(json PreToolUse Bash '{"command":"npm test"}')" PreToolUse Bash
event "5 Stop" ".claude/hooks/dispatch.cjs" \
	"$(printf '{"session_id":"clone-journey","cwd":"%s","hook_event_name":"Stop"}' "$CLONE")" Stop

# The three guards, which block from a SKILL.md registration rather than settings.
DESTRUCTIVE="rm -$(printf 'rf') /var/data/customers"
event "guard careful" ".claude/skills/careful/bin/check-careful.cjs" \
	"$(json PreToolUse Bash "{\"command\":\"$DESTRUCTIVE\"}")"
event "guard freeze" ".claude/skills/freeze/bin/check-freeze.cjs" \
	"$(json PreToolUse Edit '{"file_path":"src/app.ts"}')"
event "guard investigate" ".claude/skills/investigate/bin/check-report-path.cjs" \
	"$(json PreToolUse Write '{"file_path":"notes/investigation.md","content":"# Investigation"}')"

say "the clone's working tree after the session"
git -C "$CLONE" status --porcelain

# ------------------------------------------------------------------- the capture
export PATH="$FULL_PATH"
unset NODE_OPTIONS
say "transcript of the session's hooks"
cat "$EVENTS"

say "analysis"
printf 'crash markers (Traceback|MODULE_NOT_FOUND|ENOTFOUND): '
if grep -cE 'Traceback|MODULE_NOT_FOUND|ENOTFOUND' "$EVENTS" | grep -qv '^0$'; then
	echo "FOUND"
	grep -nE 'Traceback|MODULE_NOT_FOUND|ENOTFOUND' "$EVENTS"
else
	echo "0"
fi
printf 'network attempts (EOFFLINE):   %s\n' "$(grep -c 'EOFFLINE' "$EVENTS" || true)"
printf 'non-zero hook exits:           %s\n' "$(grep -c '^exit: [^0]' "$EVENTS" || true)"
grep -n '^exit: ' "$EVENTS"
printf '\n"mewkit doctor" hint occurrences: %s\n' "$(grep -c 'mewkit doctor' "$EVENTS" || true)"
grep -n 'mewkit doctor' "$EVENTS"
printf '\nmemory-store lint degradation:   %s\n' "$(grep -c 'mewkit CLI not found' "$EVENTS" || true)"
grep -n 'mewkit CLI not found' "$EVENTS"
printf '\ngate + privacy markers:\n'
grep -n '@@GATE_BLOCK@@\|@@PRIVACY_BLOCK@@' "$EVENTS"

say "done"
echo "clone kept at: $CLONE"
