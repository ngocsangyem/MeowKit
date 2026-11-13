//! `validate --packs`: is the pack manifest coherent, and is base SAFE?
//!
//! Five properties, in order: every profile flattens; every override id is a
//! real artifact; every governed artifact belongs to a pack or to base; base
//! carries the whole gate/privacy/dispatch chain at its exact paths; and every
//! `depends_on` resolves. Port of `core/check-packs.ts`.
//!
//! The fourth is the non-negotiable one: a missing safety file makes a profile
//! shippable WITHOUT enforcement, so each absence is a hard FAIL.
use std::collections::BTreeSet;
use std::path::Path;

use super::inventory_build::build_inventory;
use super::pack_files::base_seed;
use super::pack_manifest::{flatten_profile, has_pack_manifest, load_pack_manifest};
use super::packs_safety::safety_paths;
use super::result::{CheckResult, Section, Status};

fn row(name: impl Into<String>, status: Status, detail: impl Into<String>) -> CheckResult {
    CheckResult::new(name, status, detail, Section::Packs)
}

pub fn check_packs(claude_dir: &Path, missing_infra_severity: Status) -> Vec<CheckResult> {
    // Manifest absent ⇒ pack modularization not installed. The default run
    // downgrades to WARN (prompt an upgrade); scoped `--packs` keeps it a hard
    // FAIL for CI.
    if !has_pack_manifest(claude_dir) {
        return vec![row(
            "Pack manifest installed",
            missing_infra_severity,
            if missing_infra_severity == Status::Warn {
                "No pack-manifest.json — pack modularization not installed; run `mewkit upgrade`"
            } else {
                "Missing pack-manifest.json (.meowkit/, or .claude/ on a pre-move install)"
            },
        )];
    }

    let manifest = match load_pack_manifest(claude_dir) {
        Ok(manifest) => manifest,
        Err(error) => return vec![row("Pack manifest loads", Status::Fail, error.to_string())],
    };

    let mut results = Vec::new();

    // 1. Every profile flattens without an unknown ref or a cycle.
    for profile in manifest.available_profiles() {
        if let Err(error) = flatten_profile(&manifest, profile) {
            results.push(row(
                format!("Profile resolves: {profile}"),
                Status::Fail,
                error.to_string(),
            ));
        }
    }

    let inventory = build_inventory(claude_dir);
    let ids: BTreeSet<&str> = inventory
        .entries
        .iter()
        .map(|entry| entry.id.as_str())
        .collect();

    // 2. Every artifactsAdd/Exclude id is a real artifact (catches phantoms).
    for (pack_name, def) in &manifest.packs {
        for id in def.artifacts_add.iter().chain(def.artifacts_exclude.iter()) {
            if !ids.contains(id.as_str()) {
                results.push(row(
                    format!("Pack override id: {pack_name}"),
                    Status::Fail,
                    format!("references unknown artifact id \"{id}\""),
                ));
            }
        }
    }

    // 3. Completeness: every governed artifact belongs to a pack OR to base.
    let mut covered_owners: BTreeSet<&str> = BTreeSet::new();
    let mut covered_add_ids: BTreeSet<&str> = BTreeSet::new();
    for (_, def) in &manifest.packs {
        covered_owners.extend(def.owners.iter().map(String::as_str));
        covered_add_ids.extend(def.artifacts_add.iter().map(String::as_str));
    }
    // The npm CLI resolves the explicit pack list `[]`, which is base alone —
    // so the base seed IS the membership set this check compares against.
    let base_set = base_seed(claude_dir, &manifest);
    let strays: Vec<&super::inventory::InventoryEntry> = inventory
        .entries
        .iter()
        .filter(|entry| {
            !covered_owners.contains(entry.owner.as_str())
                && !covered_add_ids.contains(entry.id.as_str())
                && !base_set.contains_key(&entry.path)
        })
        .collect();
    if !strays.is_empty() {
        let sample: Vec<String> = strays
            .iter()
            .take(8)
            .map(|entry| {
                let owner = if entry.owner.is_empty() {
                    "no-owner"
                } else {
                    entry.owner.as_str()
                };
                format!("{}({owner})", entry.id)
            })
            .collect();
        results.push(row(
            "Pack completeness",
            Status::Fail,
            format!(
                "{} artifact(s) in no pack/base: {}",
                strays.len(),
                sample.join(", ")
            ),
        ));
    }

    // 4. The safety invariant.
    let missing_safety: Vec<String> = safety_paths()
        .into_iter()
        .filter(|path| !base_set.contains_key(path))
        .collect();
    if !missing_safety.is_empty() {
        results.push(row(
            "Base safety invariant",
            Status::Fail,
            format!(
                "base missing required safety file(s): {}",
                missing_safety.join(", ")
            ),
        ));
    }

    // 5. depends_on resolvability, plus the empty-edges advisory.
    let mut any_edges = false;
    for entry in &inventory.entries {
        for dependency in &entry.depends_on {
            any_edges = true;
            if !ids.contains(dependency.as_str()) {
                results.push(row(
                    format!("depends_on: {}", entry.id),
                    Status::Fail,
                    format!("unresolvable dependency \"{dependency}\""),
                ));
            }
        }
    }
    if !any_edges && !inventory.entries.is_empty() {
        results.push(row(
            "depends_on edges",
            Status::Warn,
            format!(
                "inventory has {} artifacts but no depends_on edges — closure is inert (future-proofing only)",
                inventory.entries.len()
            ),
        ));
    }

    let failed = results
        .iter()
        .filter(|result| result.status == Status::Fail)
        .count();
    results.push(if failed == 0 {
        row(
            "Pack coherence",
            Status::Pass,
            format!(
                "{} profiles, {} packs, {} artifacts — 100% covered",
                manifest.available_profiles().len(),
                manifest.available_packs().len(),
                inventory.entries.len()
            ),
        )
    } else {
        row(
            "Pack coherence",
            Status::Fail,
            format!("{failed} pack defect(s)"),
        )
    });
    results
}

#[cfg(test)]
#[path = "packs_tests.rs"]
mod packs_tests;
