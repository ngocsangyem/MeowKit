//! Files that must stay identical across skills, checked against a manifest.
//!
//! A skill has to be readable on its own, so a protocol several skills share is
//! copied into each one rather than linked. A copy edited in one place and not
//! the others drifts silently: two skills then tell the model different rules
//! for the same step. `.claude/shared-families.json` names each family — one
//! canonical file and the copies that must match it — and this compares their
//! content.
//!
//! Beside the workflow-drift check because the failure is the same: prose that
//! disagrees with its source. A family may name `sections` to compare only the
//! marked blocks of each member (see `shared_sections`) instead of the whole
//! file, for agents that share boilerplate but differ elsewhere.
use std::fs;
use std::path::{Component, Path};

use serde_json::Value;

use super::result::{CheckResult, Section, Status};
use super::shared_sections::{extract_section, section_drift};

pub const MANIFEST_REL_PATH: &str = "shared-families.json";

/// A manifest path must stay inside `.claude/`: it is read from disk by name.
fn contained(rel: &str) -> bool {
    !rel.is_empty()
        && Path::new(rel)
            .components()
            .all(|c| matches!(c, Component::Normal(_)))
}

fn string_list(value: Option<&Value>) -> Option<Vec<String>> {
    value?
        .as_array()?
        .iter()
        .map(|v| v.as_str().map(str::to_string))
        .collect()
}

fn fail(name: &str, detail: impl Into<String>) -> CheckResult {
    CheckResult::new(name, Status::Fail, detail, Section::Workflow)
}

/// Why `actual` does not match `expected`: the whole file when the family names
/// no sections, otherwise each named section in turn.
fn drift_reasons(expected: &[u8], actual: &[u8], sections: &[String]) -> Vec<String> {
    if sections.is_empty() {
        return if expected == actual {
            Vec::new()
        } else {
            vec!["differs".to_string()]
        };
    }
    let (want, got) = (
        String::from_utf8_lossy(expected),
        String::from_utf8_lossy(actual),
    );
    sections
        .iter()
        .filter_map(|name| section_drift(&want, &got, name))
        .collect()
}

/// One family: the members whose content (or named sections) differ from the
/// canonical file, or that are missing.
fn check_family(claude_dir: &Path, family: &Value, severity: Status) -> CheckResult {
    let name = family
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("unnamed");
    let row = format!("Shared family: {name}");
    let canonical = family.get("canonical").and_then(Value::as_str);
    let members = string_list(family.get("members"));
    let (Some(canonical), Some(members)) = (canonical, members) else {
        return fail(
            &row,
            "needs a `canonical` path and a `members` list of paths",
        );
    };
    if let Some(bad) = std::iter::once(&canonical.to_string())
        .chain(members.iter())
        .find(|p| !contained(p))
    {
        return fail(
            &row,
            format!("path `{bad}` must be relative and inside .claude/"),
        );
    }
    let Ok(expected) = fs::read(claude_dir.join(canonical)) else {
        return fail(&row, format!("canonical file `{canonical}` cannot be read"));
    };

    let sections = string_list(family.get("sections")).unwrap_or_default();
    let canonical_text = String::from_utf8_lossy(&expected);
    if let Some(name) = sections
        .iter()
        .find(|s| extract_section(&canonical_text, s).is_none())
    {
        return fail(
            &row,
            format!("canonical file `{canonical}` has no `{name}` section"),
        );
    }

    let mut drifted = Vec::new();
    for member in members.iter().filter(|m| m.as_str() != canonical) {
        match fs::read(claude_dir.join(member)) {
            Ok(bytes) => {
                let reasons = drift_reasons(&expected, &bytes, &sections);
                if !reasons.is_empty() {
                    drifted.push(if sections.is_empty() {
                        format!("{member} differs from {canonical}")
                    } else {
                        format!("{member}: {}", reasons.join("; "))
                    });
                }
            }
            Err(_) => drifted.push(format!("{member} is missing")),
        }
    }
    if drifted.is_empty() {
        return CheckResult::new(
            row,
            Status::Pass,
            format!("{} copies match {canonical}", members.len()),
            Section::Workflow,
        );
    }
    let detail = format!(
        "{} of {} copies drifted\n         {}",
        drifted.len(),
        members.len(),
        drifted.join("\n         ")
    );
    CheckResult::new(row, severity, detail, Section::Workflow)
}

/// One row per family. An absent manifest is N/A, not a failure: a kit that
/// declares no families has nothing to keep identical.
pub fn check_shared_families(claude_dir: &Path, severity: Status) -> Vec<CheckResult> {
    let path = claude_dir.join(MANIFEST_REL_PATH);
    let name = "Shared family manifest";
    let Ok(text) = fs::read_to_string(&path) else {
        return vec![CheckResult::new(
            name,
            Status::Na,
            format!("no {MANIFEST_REL_PATH} in this kit"),
            Section::Workflow,
        )];
    };
    let Ok(manifest) = serde_json::from_str::<Value>(&text) else {
        return vec![fail(name, format!("{MANIFEST_REL_PATH} is not valid JSON"))];
    };
    let Some(families) = manifest.get("families").and_then(Value::as_array) else {
        return vec![fail(
            name,
            format!("{MANIFEST_REL_PATH} needs a `families` array"),
        )];
    };
    families
        .iter()
        .map(|family| check_family(claude_dir, family, severity))
        .collect()
}

#[cfg(test)]
#[path = "shared_families_tests.rs"]
mod shared_families_tests;
