//! The post-install checks for an Antigravity project the kit was installed
//! into. Read-only. Antigravity's forms: https://antigravity.google/docs/skills,
//! /docs/rules and /docs/subagents, read 2026-11-22 (documentation only; no
//! install of the runtime was available to probe).
use std::path::Path;

use super::result::{CheckResult, Status};
use super::target_agents_tree::rows;
use super::target_helpers::row;

/// The kit's skills are the one thing every Antigravity install writes: the
/// folder name is shared with Codex, Pi and OMP, so only a `mk-` skill counts.
pub fn detects(dir: &Path) -> bool {
    super::dir_order::sorted_names(&dir.join(".agents/skills"))
        .iter()
        .any(|folder| folder.starts_with("mk-"))
}

pub fn check(dir: &Path) -> Vec<CheckResult> {
    let mut out = rows("Antigravity", dir);
    out.push(guards(dir));
    out
}

/// The kit installs no Antigravity hook. A project whose `.agents/hooks.json`
/// is the user's own is left alone; the row says what is and is not running.
fn guards(dir: &Path) -> CheckResult {
    let name = "Antigravity guards";
    if dir.join(".agents/hooks.json").is_file() {
        return row(
            name,
            Status::Warn,
            "guards not installed by the kit; .agents/hooks.json is yours and is not checked here"
                .into(),
        );
    }
    row(
        name,
        Status::Warn,
        "guards not installed: no privacy guard and no ship check run on Antigravity".into(),
    )
}
