//! The safety surface every profile's `base` must carry.
//!
//! A missing file here makes a profile shippable WITHOUT enforcement, so each
//! absence is a hard FAIL rather than a warning. The three skill entries are
//! essential cross-profile entrypoints: each names the surface that now owns a
//! job the kit used to expose as its own command.
use super::structure::always_on_rule_paths;

/// The safety surface that must resolve into `base` for every profile: the
/// write guards and their gate libraries, the dispatch chain, the completion
/// gate, settings, statusline and the always-on rules.
///
/// The three skill/reference entries are essential cross-profile entrypoints —
/// each names the surface that now owns a job the kit used to expose as its own
/// command. A profile missing one has no way to reach that job at all.
pub(super) fn safety_paths() -> Vec<String> {
    let mut paths: Vec<String> = [
        "statusline.cjs",
        "settings.json",
        "hooks/gate-enforcement.cjs",
        "hooks/privacy-block.cjs",
        "hooks/pre-ship.cjs",
        "hooks/handlers/pre-completion-check.cjs",
        "hooks/dispatch.cjs",
        "hooks/lib/parse-stdin.cjs",
        "hooks/lib/shared-state.cjs",
        "hooks/handlers.json",
        "hooks/lib/gate2-check.cjs",
        "hooks/lib/approval-receipt.cjs",
        "hooks/lib/validate-contract.cjs",
        "hooks/lib/check-contract-signed.cjs",
        "hooks/lib/validate-gate-2.cjs",
    ]
    .iter()
    .map(|path| (*path).to_string())
    .collect();
    paths.extend(always_on_rule_paths());
    paths.extend(
        [
            "skills/plan-creator/SKILL.md",
            "skills/help/references/cli.md",
            "skills/lint-and-validate/SKILL.md",
        ]
        .iter()
        .map(|path| (*path).to_string()),
    );
    paths
}
