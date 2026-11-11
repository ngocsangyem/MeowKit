#!/usr/bin/env bash
# release-check.sh — the single release-readiness gate. Contributors run it via
# `npm run release:check` to see readiness before tagging; `scripts/release.sh` runs it after it
# has stamped the version bump. Runs ALL gates and reports every failing one (not fail-fast), then
# exits non-zero if any failed. Exit 0 = release-ready.
#
# Gate policy (decided 2026-07-18): `validate --portable` gates on HARD failures only; advisory
# warnings (staged provider-parity, multi-skill intent fan-out) are reported, not blocking — they
# are intentional by design and forcing them green would be dishonest. See the phase report.
set -u
cd "$(dirname "$0")/.."

CLI="node packages/mewkit/dist/index.js"
fail=0
step() { printf '\n\033[1m[release-check] %s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓ %s\033[0m\n' "$1"; }
bad()  { printf '  \033[31m✗ %s\033[0m\n' "$1"; fail=1; }

step "Build (CLI needs dist)"
npm run build >/dev/null 2>&1 && ok "build" || bad "build"

# step "Unit tests (npm test)"
npm test >/dev/null 2>&1 && ok "npm test" || bad "npm test"

step "Lint"
npm run lint >/dev/null 2>&1 && ok "lint" || bad "lint"

step "Typecheck"
npm run typecheck >/dev/null 2>&1 && ok "typecheck" || bad "typecheck"

step "Format check"
npm run format:check >/dev/null 2>&1 && ok "format:check" || bad "format:check"

step "Portable validation (hard-fails block; warnings advisory)"
if $CLI validate --portable >/tmp/rc-validate.txt 2>&1; then
  ok "validate --portable ($(grep -oE '[0-9]+ warnings' /tmp/rc-validate.txt | head -1 || echo '0 warnings') — advisory)"
else
  bad "validate --portable (hard failure)"; tail -20 /tmp/rc-validate.txt
fi

step "Inventory check (README, website and index counts)"
node scripts/harness-inventory.cjs --check >/tmp/rc-inventory.txt 2>&1 && ok "harness-inventory --check" || { bad "harness-inventory --check"; tail -20 /tmp/rc-inventory.txt; }

step "Version sync (root ↔ manifest ↔ kit contract; CLI recorded)"
node scripts/sync-versions.cjs && ok "versions consistent" || bad "version mismatch"

step "Portable skills (own paths, reference classes, tool table)"
node scripts/check-skills-portable.cjs >/tmp/rc-portable.txt 2>&1 && ok "check-skills-portable" || { bad "check-skills-portable"; tail -20 /tmp/rc-portable.txt; }

step "Kit compatibility contract"
if node -e '
  const c = JSON.parse(require("fs").readFileSync(".claude/kit-contract.json", "utf8"));
  const semver = /^\d+\.\d+\.\d+(-[\w.]+)?$/;
  if (!Number.isInteger(c.kitContract) || c.kitContract < 1) throw new Error("kitContract must be a positive integer");
  if (!semver.test(String(c.requires && c.requires.mewkitMin))) throw new Error("requires.mewkitMin must be a semver");
' 2>/tmp/rc-contract.txt; then
  ok ".claude/kit-contract.json"
else
  bad ".claude/kit-contract.json missing or invalid"; tail -3 /tmp/rc-contract.txt
fi

# The kit must install with the mewkit-next users already have. The binary is
# $MEWKIT_NEXT_BIN, else `mewkit-next` on PATH. With neither, the gate is skipped
# only while `gh` can prove no binary release exists; otherwise it fails.
step "Candidate kit against the published mewkit-next"
NEXT_BIN="${MEWKIT_NEXT_BIN:-$(command -v mewkit-next 2>/dev/null || true)}"
if [ -z "$NEXT_BIN" ]; then
  if ! TAGS="$(gh release list --limit 100 --json tagName -q '.[].tagName' 2>/dev/null)"; then
    bad "no mewkit-next binary, and gh cannot list releases to show none is published: install mewkit-next (install.sh) or set MEWKIT_NEXT_BIN"
  elif printf '%s\n' "$TAGS" | grep -q '^mewkit-v'; then
    bad "no mewkit-next binary: install it (install.sh) or set MEWKIT_NEXT_BIN"
  else
    ok "skipped — no mewkit-next binary release is published yet"
  fi
else
  GATE_TMP="$(mktemp -d)"
  "$NEXT_BIN" self-update --check >"$GATE_TMP/update.txt" 2>&1
  case $? in
    0) ;;
    3) bad "$NEXT_BIN is not the newest published mewkit-next; run \`mewkit-next self-update\` first" ;;
    *) printf '  note: could not check that %s is the newest release (%s)\n' "$NEXT_BIN" "$(tail -1 "$GATE_TMP/update.txt")" ;;
  esac
  if node scripts/release/stage-candidate-kit.cjs "$GATE_TMP/kit" >"$GATE_TMP/stage.txt" 2>&1 \
    && bash scripts/release/check-kit-against-binary.sh "$NEXT_BIN" "$GATE_TMP/kit"; then
    ok "init --dry-run plans the candidate kit for claude-code, codex and cursor"
  else
    bad "the candidate kit does not install with $NEXT_BIN"; tail -3 "$GATE_TMP/stage.txt"
  fi
  rm -rf "$GATE_TMP"
fi

# Built assets are checked only when a zip for THIS version exists. release.sh runs this gate
# after the version bump and before it rebuilds dist/, which is gitignored and persists, so a zip
# left from an earlier version is expected there: it is reported and skipped, not failed.
# release.sh verifies the rebuilt assets itself before uploading.
if [ -f dist/meowkit-release.zip ]; then
  step "Built release assets (dist/)"
  KIT_VERSION="$(node -p "require('./package.json').version")"
  BUILT_VERSION="$(unzip -p dist/meowkit-release.zip .claude/kit-contract.json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).kitVersion||""))}catch{}})')"
  if [ "$BUILT_VERSION" != "$KIT_VERSION" ]; then
    ok "dist/ holds a ${BUILT_VERSION:-unversioned} build, not $KIT_VERSION — skipped (release.sh rebuilds and verifies it)"
  else
    node scripts/verify-release-assets.cjs "$KIT_VERSION" dist && ok "zip contract + checksums.txt" || bad "release assets (rebuild with prepare-release-assets.cjs)"
  fi
fi

echo ""
if [ "$fail" -eq 0 ]; then
  printf '\033[32m[release-check] ALL GATES PASS — release-ready\033[0m\n'
  exit 0
fi
printf '\033[31m[release-check] FAILED — fix the ✗ gate(s) above before releasing\033[0m\n'
exit 1
