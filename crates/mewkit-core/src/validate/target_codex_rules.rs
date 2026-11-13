//! The generated Codex exec-policy rules, and the surfaces a target must NOT
//! carry.
use std::path::Path;
use std::sync::LazyLock;

use regex::Regex;

use super::result::{CheckResult, Status};
use super::target_helpers::{list_files, row};

static DECISION: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile(r#"\bdecision\s*=\s*["']([^"']+)["']"#)
        .expect("a static decision pattern")
});

/// Exec-policy rules: each `prefix_rule` decision must be one the CLI accepts.
/// Structural only — the CLI validates behaviour.
pub(super) fn check_rules(dir: &Path) -> Vec<CheckResult> {
    let rules_dir = dir.join(".codex").join("rules");
    let files = if rules_dir.exists() {
        list_files(&rules_dir, ".rules")
    } else {
        Vec::new()
    };
    if files.is_empty() {
        return Vec::new();
    }
    const VALID: [&str; 3] = ["allow", "prompt", "forbidden"];
    let mut bad = Vec::new();
    for file in &files {
        let text = std::fs::read(file)
            .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
            .unwrap_or_default();
        for capture in DECISION.captures_iter(&text) {
            let decision = capture.get(1).map(|m| m.as_str()).unwrap_or_default();
            if !VALID.contains(&decision) {
                bad.push(format!(
                    "{}: decision=\"{decision}\"",
                    file.file_name()
                        .map(|name| name.to_string_lossy().into_owned())
                        .unwrap_or_default()
                ));
            }
        }
    }
    vec![if bad.is_empty() {
        row(
            "Codex exec-policy rules valid",
            Status::Pass,
            format!(
                "{} .rules file(s); decisions in {{allow, prompt, forbidden}}",
                files.len()
            ),
        )
    } else {
        row(
            "Codex exec-policy rules valid",
            Status::Fail,
            format!("invalid decision value(s): {}", bad.join("; ")),
        )
    }]
}

/// Legacy and disallowed surfaces: the kit never writes native Codex memory
/// (memory lives in the runtime-neutral state tree) and represents deprecated
/// custom prompts as skills. A target containing either is a defect.
pub(super) fn check_legacy_surfaces(dir: &Path) -> Vec<CheckResult> {
    let mut out = Vec::new();
    out.push(if dir.join(".codex").join("memory").exists() {
        row(
            "Codex no native memory surface",
            Status::Fail,
            "`.codex/memory` present — MeowKit must never write native Codex memory".to_string(),
        )
    } else {
        row(
            "Codex no native memory surface",
            Status::Pass,
            "no `.codex/memory` (memory stays in `.meowkit/`)".to_string(),
        )
    });
    out.push(if dir.join(".codex").join("prompts").exists() {
        row(
            "Codex no legacy prompts surface",
            Status::Fail,
            "`.codex/prompts` present — deprecated custom prompts must be Agent Skills".to_string(),
        )
    } else {
        row(
            "Codex no legacy prompts surface",
            Status::Pass,
            "no deprecated `.codex/prompts` surface".to_string(),
        )
    });
    out
}
