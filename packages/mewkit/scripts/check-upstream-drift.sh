#!/usr/bin/env bash
# Drift detection: hashes vendored claudekit-cli files in the migrate/ tree and
# compares against a pinned baseline. Run in CI to catch unintended divergence
# from upstream (Red Team Finding 11).
#
# Usage:
#   ./scripts/check-upstream-drift.sh           # check current hash vs pinned
#   ./scripts/check-upstream-drift.sh --update  # write current hash as new baseline
#
# Exit codes: 0 = match, 1 = drift detected, 2 = baseline missing

set -euo pipefail

PKG_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC_ROOT="${PKG_ROOT}/src/migrate"
BASELINE="${PKG_ROOT}/scripts/upstream-drift-baseline.txt"

# Files vendored from claudekit-cli (per phase 1-8 ports).
# Excluded: tests, mewkit-only files (provider-overrides.ts, init.ts integration).
VENDORED_FILES=(
  "types.ts"
  "frontmatter-parser.ts"
  "migrate-scope-resolver.ts"
  "provider-registry.ts"
  "provider-registry-utils.ts"
  "model-taxonomy.ts"
  "codex-capabilities.ts"
  "discovery/agents-discovery.ts"
  "discovery/commands-discovery.ts"
  "discovery/skills-discovery.ts"
  "discovery/config-discovery.ts"
  "discovery/rules-discovery.ts"
  "discovery/hooks-discovery.ts"
  "discovery/handlers-json-filter.ts"
  "discovery/source-paths.ts"
  "discovery/exclusions.ts"
  "converters/index.ts"
  "converters/direct-copy.ts"
  "converters/fm-to-fm.ts"
  "converters/fm-to-yaml.ts"
  "converters/fm-strip.ts"
  "converters/fm-to-json.ts"
  "converters/md-to-toml.ts"
  "converters/skill-md.ts"
  "converters/md-strip.ts"
  "converters/md-to-mdc.ts"
  "converters/md-to-kiro-steering.ts"
  "converters/fm-to-codex-toml.ts"
  "converters/claude-to-codex-hooks.ts"
  "converters/gemini-hook-event-map.ts"
  "reconcile/reconciler.ts"
  "reconcile/reconcile-types.ts"
  "reconcile/reconcile-state-builders.ts"
  "reconcile/checksum-utils.ts"
  "reconcile/portable-registry.ts"
  "reconcile/conflict-resolver.ts"
  "reconcile/diff-display.ts"
  "reconcile/output-sanitizer.ts"
  "reconcile/process-lock.ts"
  "config-merger/merge-single-sections.ts"
  "hooks/hooks-settings-merger.ts"
  "hooks/codex-hook-wrapper.ts"
  "hooks/codex-features-flag.ts"
  "hooks/codex-path-safety.ts"
  "hooks/codex-toml-installer.ts"
  "hooks/opencode-config-installer.ts"
)

compute_hash() {
  local concat=""
  for file in "${VENDORED_FILES[@]}"; do
    local full_path="${SRC_ROOT}/${file}"
    if [[ ! -f "${full_path}" ]]; then
      echo "[!] Missing vendored file: ${file}" >&2
      exit 1
    fi
    # Strip first-line attribution comment (mewkit-only) so drift = real code change
    concat+="$(tail -n +2 "${full_path}")"
  done
  printf "%s" "${concat}" | shasum -a 256 | awk '{print $1}'
}

if [[ "${1:-}" == "--update" ]]; then
  HASH="$(compute_hash)"
  echo "${HASH}" > "${BASELINE}"
  echo "[i] Baseline written: ${BASELINE}"
  echo "    SHA-256: ${HASH}"
  exit 0
fi

if [[ ! -f "${BASELINE}" ]]; then
  echo "[!] No baseline at ${BASELINE}." >&2
  echo "    Run --update once after a verified upstream sync to create one." >&2
  exit 2
fi

CURRENT="$(compute_hash)"
PINNED="$(cat "${BASELINE}")"

if [[ "${CURRENT}" == "${PINNED}" ]]; then
  echo "[OK] Vendored migrate code matches pinned baseline."
  exit 0
fi

echo "[DRIFT] Vendored migrate code has diverged from baseline." >&2
echo "    Baseline: ${PINNED}" >&2
echo "    Current:  ${CURRENT}" >&2
echo "    If intentional: re-run with --update after verifying changes are safe." >&2
exit 1
