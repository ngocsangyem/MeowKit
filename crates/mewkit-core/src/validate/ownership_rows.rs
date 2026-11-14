//! `validate --ownership`: is every artifact governed, with valid values?
//!
//! PASSES only when every discovered artifact has a metadata record, every
//! required field, and an in-enum value for each. Port of `checkOwnership` in
//! `core/build-inventory.ts`.
//!
//! ## Why the schema is compiled in
//!
//! The governance schema describes the ENUMS this engine enforces, so it is
//! engine knowledge: a copy per project could disagree with the code reading
//! it. The npm CLI ships it beside the compiled JS and reads it at runtime;
//! here it is embedded at build time, which removes the one failure mode that
//! read could have (a half-installed CLI) and keeps the enums impossible to
//! edit in a project.
use std::collections::BTreeSet;
use std::path::Path;

use serde_json::Value;

use super::inventory::REQUIRED_FIELDS;
use super::inventory_build::build_inventory;
use super::result::{CheckResult, Section, Status};

/// The governance schema, as shipped in `crates/mewkit-core/schemas/`. Embedded
/// from there rather than copied so the two CLIs cannot disagree about an enum:
/// one file, read by both, and `cargo build` fails if it moves.
const METADATA_SCHEMA: &str = include_str!("../../schemas/harness-metadata-schema.json");

/// The allowed values for one schema property.
pub fn schema_enum(property: &str) -> BTreeSet<String> {
    serde_json::from_str::<Value>(METADATA_SCHEMA)
        .ok()
        .and_then(|schema| {
            Some(
                schema
                    .get("properties")?
                    .get(property)?
                    .get("enum")?
                    .as_array()?
                    .iter()
                    .filter_map(Value::as_str)
                    .map(str::to_string)
                    .collect(),
            )
        })
        .unwrap_or_default()
}

fn fail(name: String, detail: String) -> CheckResult {
    CheckResult::new(name, Status::Fail, detail, Section::Ownership)
}

pub fn check_ownership(claude_dir: &Path) -> Vec<CheckResult> {
    let enums: Vec<(&str, BTreeSet<String>)> = REQUIRED_FIELDS
        .iter()
        .map(|field| (*field, schema_enum(field)))
        .collect();

    let inventory = build_inventory(claude_dir);
    let mut results: Vec<CheckResult> = inventory
        .issues
        .iter()
        .map(|issue| {
            fail(
                format!("Ownership: {}", issue.path),
                format!("{}: {}", issue.artifact_type, issue.problem),
            )
        })
        .collect();

    for entry in &inventory.entries {
        let mut problems: Vec<String> = Vec::new();
        for (field, allowed) in &enums {
            let value = match *field {
                "owner" => &entry.owner,
                "criticality" => &entry.criticality,
                "status" => &entry.status,
                _ => &entry.runtime,
            };
            if value.is_empty() {
                problems.push(format!("missing {field}"));
            } else if !allowed.contains(value) {
                problems.push(format!("{field}=\"{value}\" not in enum"));
            }
        }
        if entry.artifact_type == "agent" {
            if entry.model.as_deref().unwrap_or_default().is_empty() {
                problems.push("missing model".to_string());
            }
            if entry.tools.as_ref().is_none_or(|tools| tools.is_empty()) {
                problems.push("missing tools".to_string());
            }
        }
        if !problems.is_empty() {
            results.push(fail(
                format!("Ownership: {}", entry.path),
                problems.join("; "),
            ));
        }
    }

    let failed = results
        .iter()
        .filter(|row| row.status == Status::Fail)
        .count();
    results.push(CheckResult::new(
        "Ownership coverage",
        if failed == 0 {
            Status::Pass
        } else {
            Status::Fail
        },
        if failed == 0 {
            format!(
                "{} artifacts, 100% governance coverage",
                inventory.entries.len()
            )
        } else {
            format!("{failed} artifact(s) with missing/invalid metadata")
        },
        Section::Ownership,
    ));
    results
}

#[cfg(test)]
#[path = "ownership_rows_tests.rs"]
mod ownership_rows_tests;
