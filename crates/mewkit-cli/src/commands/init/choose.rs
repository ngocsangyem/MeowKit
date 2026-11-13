//! Reading what `init` was asked for: which runtimes, which on-disk shape,
//! which packs. Every refusal here happens before anything is fetched or
//! written, and names the value and what would have been valid.
use mewkit_adapters::bundle::{ALL_PACKS, DEFAULT_ONLY};
use mewkit_adapters::contract::Runtime;
use mewkit_core::kit::Kit;
use mewkit_core::validate::{BASE_PACK, flatten_profile, has_pack_manifest, load_pack_manifest};

use crate::failure::Failure;
use crate::prompt::{Ask, Choice, Flag, default_prompt};

/// The on-disk shapes of a Claude Code install.
pub const DELIVERIES: [&str; 2] = ["native", "plugin"];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Delivery {
    Native,
    Plugin,
}

/// The delivery asked for, or the message that refuses it.
///
/// Only Claude Code's shape is a choice. Ignoring the flag for the other
/// runtimes would print success while producing the install the flag was
/// passed to avoid, so it is an error instead of a no-op.
pub fn delivery(targets: &[Runtime], raw: Option<&str>) -> Result<Delivery, String> {
    let Some(d) = raw.map(str::trim).filter(|d| !d.is_empty()) else {
        return Ok(Delivery::Native);
    };
    if let Some(other) = targets.iter().find(|t| **t != Runtime::ClaudeCode)
        && !targets.contains(&Runtime::ClaudeCode)
    {
        return Err(format!(
            "--delivery is meaningful for --target claude-code only, and \"{}\" has a single on-disk shape, \
             so passing --delivery {d} here would have no effect. Drop the flag, or change the target. Nothing was written.",
            other.name()
        ));
    }
    match d {
        "native" => Ok(Delivery::Native),
        "plugin" => Ok(Delivery::Plugin),
        _ => Err(format!(
            "Unknown --delivery \"{d}\". The deliveries are {}. Nothing was written.",
            DELIVERIES.join(", ")
        )),
    }
}

/// The runtimes to install for. With none named, `--yes` and an existing
/// `.claude/` mean Claude Code (what omitting `--target` has always meant);
/// otherwise ask, and without a terminal refuse by naming `--target`.
pub fn pick_targets(yes: bool, installed_here: bool) -> Result<(Vec<Runtime>, bool), Failure> {
    if yes || installed_here {
        return Ok((vec![Runtime::ClaudeCode], false));
    }
    let choices: Vec<Choice> = [
        (Runtime::ClaudeCode, "installs .claude/"),
        (Runtime::Codex, "installs the authored Codex bundle"),
        (Runtime::Cursor, "installs the authored Cursor bundle"),
    ]
    .into_iter()
    .map(|(r, hint)| Choice::plain(r.name()).with_hint(hint))
    .collect();
    let ask = Ask::new(
        "Select the toolkits to set up",
        Flag::with_value("--target", "claude-code|codex|cursor"),
    );
    let picked = default_prompt().multi_select(&ask, &choices)?;
    let runtimes: Vec<Runtime> = picked
        .iter()
        .filter_map(|n| Runtime::from_name(n))
        .collect();
    if runtimes.is_empty() {
        return Err(Failure::usage(
            "select at least one toolkit, or pass --target",
        ));
    }
    Ok((runtimes, true))
}

/// The skill packs for the Codex and Cursor bundles, in the bundle's own terms.
/// Omitted installs every skill; `all` every pack; an empty value only the
/// catalog's default pack.
pub fn skill_packs(raw: Option<&str>) -> Vec<String> {
    let Some(v) = raw.map(str::trim) else {
        return Vec::new();
    };
    if v.is_empty() {
        return vec![DEFAULT_ONLY.to_owned()];
    }
    if v.eq_ignore_ascii_case("all") {
        return vec![ALL_PACKS.to_owned()];
    }
    v.split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .collect()
}

/// What each profile is for, as the interactive picker shows it.
const PROFILE_HINTS: [(&str, &str); 7] = [
    ("full", "everything (default)"),
    ("core", "recommended: lifecycle essentials, smallest"),
    ("developer", "core + testing + git + docs"),
    ("product", "developer + product/autobuild"),
    ("atlassian", "developer + Jira/Confluence"),
    ("security", "core + security audit"),
    ("research", "core + research/brainstorming"),
];

/// Ask which profile, listing what the kit offers.
pub fn prompt_profile(kit: &Kit) -> Result<Option<String>, Failure> {
    let claude = kit.dir.join(".claude");
    if !has_pack_manifest(&claude) {
        return Ok(None);
    }
    let manifest = load_pack_manifest(&claude).map_err(|e| Failure::failed(e.to_string()))?;
    let choices: Vec<Choice> = manifest
        .available_profiles()
        .into_iter()
        .map(|name| {
            let c = Choice::plain(name);
            match PROFILE_HINTS.iter().find(|(n, _)| *n == name) {
                Some((_, hint)) => c.with_hint(*hint),
                None => c,
            }
        })
        .collect();
    let ask = Ask::new("Select an install profile", Flag::new("--profile"));
    Ok(Some(default_prompt().select(&ask, &choices)?))
}

/// The packs a Claude Code install carries for `profile`: empty is the whole
/// tree. A kit with no pack manifest cannot honour a partial profile, so it
/// installs whole and says so.
pub fn profile_packs(
    kit: &Kit,
    profile: Option<&str>,
) -> Result<(Vec<String>, Option<String>), String> {
    let Some(name) = profile.filter(|p| *p != "full") else {
        return Ok((Vec::new(), None));
    };
    let claude = kit.dir.join(".claude");
    if !has_pack_manifest(&claude) {
        return Ok((
            Vec::new(),
            Some(format!(
                "This release has no pack-manifest.json — installing the full profile instead of '{name}'."
            )),
        ));
    }
    let manifest = load_pack_manifest(&claude).map_err(|e| e.to_string())?;
    if !manifest.available_profiles().contains(&name) {
        return Err(format!(
            "Unknown profile \"{name}\". Available: {}",
            manifest.available_profiles().join(", ")
        ));
    }
    let (packs, wildcard) = flatten_profile(&manifest, name).map_err(|e| e.to_string())?;
    if wildcard {
        return Ok((Vec::new(), None));
    }
    Ok((packs.into_iter().filter(|p| p != BASE_PACK).collect(), None))
}

#[cfg(test)]
#[path = "choose_tests.rs"]
mod tests;
