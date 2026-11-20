//! Target-aware validation: one profile per PROVIDER key.
//!
//! A generated provider project has no `.claude/`, so the ordinary run would
//! bail with "no .claude/ found". A profile knows how to validate one
//! provider's generated layout instead. The set is provider-keyed so a new
//! provider adds a profile rather than a new CLI command. Port of
//! `validate/targets/target-profile.ts`.
use std::path::Path;

use super::result::CheckResult;

/// Registered profiles, in the npm CLI's registration order — the order
/// `Known targets:` lists them in.
pub const TARGET_PROFILES: [&str; 5] = ["codex", "cursor", "grok", "pi", "omp"];

pub fn is_target_profile(provider: &str) -> bool {
    TARGET_PROFILES.contains(&provider)
}

/// The cheap layout sniff: does `dir` look like this provider's generated
/// project?
pub fn detects_target(provider: &str, dir: &Path) -> bool {
    match provider {
        "codex" => super::target_codex::detects(dir),
        "cursor" => super::target_cursor::detects(dir),
        "grok" => super::target_grok::detects(dir),
        "pi" => super::target_pi::detects(dir),
        "omp" => super::target_omp::detects(dir),
        _ => false,
    }
}

/// The profile's read-only checks over the generated directory.
pub fn check_target(provider: &str, dir: &Path) -> Vec<CheckResult> {
    match provider {
        "codex" => super::target_codex::check(dir),
        "cursor" => super::target_cursor::check(dir),
        "grok" => super::target_grok::check(dir),
        "pi" => super::target_pi::check(dir),
        "omp" => super::target_omp::check(dir),
        _ => Vec::new(),
    }
}

#[cfg(test)]
#[path = "targets_tests.rs"]
mod targets_tests;
