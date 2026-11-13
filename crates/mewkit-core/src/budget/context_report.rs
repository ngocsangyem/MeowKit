//! Per-profile context-budget estimate: how much a profile costs to LOAD.
//!
//! Sums line counts and a cheap token estimate (chars/4) over a profile's
//! loadable set — the rules, skill entrypoints, agents and commands the model
//! pulls into context — NOT every reference/script/asset file, which load on
//! demand. Read-only; the CI guardrail backs "core stays small".
//!
//! The three tiers are how the HARNESS loads a file, not how important it is:
//! `rules/` is resident every session, `rules-conditional/` only when its
//! trigger fires, and agents/commands/SKILL.md when the artifact activates. All
//! three count toward the total; splitting them keeps the always-on floor
//! visible so a conditional file is not read as permanently resident.
use std::path::Path;

use serde_json::{Map, Value, json};

use crate::validate::{PackManifest, PackManifestError};

use super::profile_paths::resolve_profile;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ContextTier {
    AlwaysOn,
    Conditional,
    OnDemand,
}

impl ContextTier {
    pub fn as_str(self) -> &'static str {
        match self {
            ContextTier::AlwaysOn => "always-on",
            ContextTier::Conditional => "conditional",
            ContextTier::OnDemand => "on-demand",
        }
    }
}

/// Printed and serialized in load order, never alphabetically.
pub const TIER_ORDER: [ContextTier; 3] = [
    ContextTier::AlwaysOn,
    ContextTier::Conditional,
    ContextTier::OnDemand,
];

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct TierAggregate {
    pub files: usize,
    pub lines: usize,
    pub tokens: usize,
}

#[derive(Clone, Debug)]
pub struct ContextBudgetReport {
    pub profile: String,
    pub files: usize,
    pub lines: usize,
    pub tokens: usize,
    /// Tier `files`/`lines` sum exactly to the top-level aggregates; tier
    /// `tokens` may differ from the total by a few, because the total rounds
    /// chars/4 once while each tier rounds per file.
    pub tiers: [TierAggregate; 3],
}

impl ContextBudgetReport {
    pub fn tier(&self, tier: ContextTier) -> TierAggregate {
        self.tiers[TIER_ORDER.iter().position(|t| *t == tier).unwrap_or(0)]
    }

    /// The report as `--json` prints it, field order included.
    pub fn to_json(&self) -> Value {
        let mut tiers = Map::new();
        for tier in TIER_ORDER {
            let aggregate = self.tier(tier);
            tiers.insert(
                tier.as_str().to_string(),
                json!({
                    "files": aggregate.files,
                    "lines": aggregate.lines,
                    "tokens": aggregate.tokens,
                }),
            );
        }
        json!({
            "profile": self.profile,
            "files": self.files,
            "lines": self.lines,
            "tokens": self.tokens,
            "tiers": Value::Object(tiers),
        })
    }
}

/// The load tier for a profile-relative path, or `None` when the path is an
/// on-demand reference/script/asset that never enters context on its own.
pub fn classify_tier(rel_path: &str) -> Option<ContextTier> {
    if named_markdown(rel_path.strip_prefix("rules/")) {
        return Some(ContextTier::AlwaysOn);
    }
    if named_markdown(rel_path.strip_prefix("rules-conditional/")) {
        return Some(ContextTier::Conditional);
    }
    // The generated agent indexes are listings OF agents, not agents.
    if named_markdown(rel_path.strip_prefix("agents/")) && !rel_path.ends_with("_INDEX.md") {
        return Some(ContextTier::OnDemand);
    }
    if named_markdown(rel_path.strip_prefix("commands/mk/")) {
        return Some(ContextTier::OnDemand);
    }
    // Exactly one directory level: `skills/<name>/SKILL.md` is the entrypoint,
    // anything deeper is an on-demand reference.
    if let Some(rest) = rel_path.strip_prefix("skills/")
        && let Some(dir) = rest.strip_suffix("/SKILL.md")
        && !dir.is_empty()
        && !dir.contains('/')
    {
        return Some(ContextTier::OnDemand);
    }
    None
}

/// `.+\.md$`: a markdown file with at least one character of name.
fn named_markdown(rest: Option<&str>) -> bool {
    rest.and_then(|rest| rest.strip_suffix(".md"))
        .is_some_and(|stem| !stem.is_empty())
}

/// Estimate the loadable context size for one profile, split by load tier.
pub fn compute_context_budget(
    claude_dir: &Path,
    manifest: &PackManifest,
    profile: &str,
) -> Result<ContextBudgetReport, PackManifestError> {
    let paths: Vec<String> = resolve_profile(claude_dir, manifest, profile)?
        .into_iter()
        .filter(|path| classify_tier(path).is_some())
        .collect();
    let mut tiers = [TierAggregate::default(); 3];
    let mut lines = 0usize;
    let mut chars = 0usize;
    for rel in &paths {
        let Some(tier) = classify_tier(rel) else {
            continue;
        };
        let abs = rel
            .split('/')
            .fold(claude_dir.to_path_buf(), |acc, part| acc.join(part));
        let Ok(bytes) = std::fs::read(&abs) else {
            // An unreadable or absent loadable file is skipped: resolution
            // already proved membership, and one missing file must not void
            // the whole estimate.
            continue;
        };
        let body = String::from_utf8_lossy(&bytes);
        // `String.length` counts UTF-16 units, which is what the chars/4
        // estimate was calibrated against.
        let file_chars = body.encode_utf16().count();
        let file_lines = body.split('\n').count();
        lines += file_lines;
        chars += file_chars;
        let slot = TIER_ORDER.iter().position(|t| *t == tier).unwrap_or(0);
        tiers[slot].files += 1;
        tiers[slot].lines += file_lines;
        tiers[slot].tokens += file_chars.div_ceil(4);
    }
    Ok(ContextBudgetReport {
        profile: profile.to_string(),
        files: paths.len(),
        lines,
        tokens: chars.div_ceil(4),
        tiers,
    })
}
