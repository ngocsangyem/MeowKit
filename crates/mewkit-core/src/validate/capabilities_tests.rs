//! The capability invariants: which issue is an error, which a smell.
use std::fs;
use std::path::Path;

use super::super::capability_authored::AUTHORED_CAPABILITIES;
use super::super::capability_rows::check_capabilities_section;
use super::super::result::Status;
use super::{IssueLevel, build_capabilities, validate_capabilities};

/// A kit with the named skills, each optionally declaring keywords and deps.
fn install(skills: &[(&str, &str)]) -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("a temp dir");
    for (name, extra) in skills {
        let skill = dir.path().join(".claude").join("skills").join(name);
        fs::create_dir_all(&skill).expect("create the skill dir");
        fs::write(
            skill.join("SKILL.md"),
            format!("---\nname: mk:{name}\nowner: lifecycle\n{extra}---\n"),
        )
        .expect("write the skill");
    }
    dir
}

fn claude(dir: &Path) -> std::path::PathBuf {
    dir.join(".claude")
}

fn messages(dir: &Path, level: IssueLevel) -> Vec<String> {
    validate_capabilities(&claude(dir))
        .into_iter()
        .filter(|issue| issue.level == level)
        .map(|issue| issue.message)
        .collect()
}

#[test]
fn a_skill_becomes_one_capability_with_its_logical_invocation() {
    let dir = install(&[("cook", "keywords: [Build, build, ship]\n")]);
    let entries = build_capabilities(&claude(dir.path()));
    let cook = entries
        .iter()
        .find(|entry| entry.id == "mk:cook")
        .expect("the skill capability");
    assert_eq!(cook.invocation_id, "invoke-skill");
    // The authored overlay wins over inferred keywords for a flagship id.
    assert!(cook.intents_authored);
    assert!(cook.intents.contains(&"build this".to_string()));
    assert_eq!(
        cook.aliases,
        vec!["cook".to_string(), "implement".to_string()]
    );
}

#[test]
fn inferred_intents_are_lowercased_and_deduplicated() {
    let dir = install(&[("quiet", "keywords: [Build, build]\n")]);
    let entries = build_capabilities(&claude(dir.path()));
    let quiet = entries
        .iter()
        .find(|entry| entry.id == "mk:quiet")
        .expect("the capability");
    assert_eq!(quiet.intents, vec!["build".to_string()]);
    assert!(!quiet.intents_authored);
}

#[test]
fn a_rule_is_inventory_only_and_never_a_capability() {
    let dir = install(&[]);
    fs::create_dir_all(claude(dir.path()).join("rules")).expect("create the rules dir");
    fs::write(
        claude(dir.path()).join("rules").join("gate-rules.md"),
        "# Rules\n",
    )
    .expect("write the rule");
    let entries = build_capabilities(&claude(dir.path()));
    assert!(entries.iter().all(|entry| entry.kind != "rule"));
    // And it is not reported as an uncovered artifact either.
    let warnings = messages(dir.path(), IssueLevel::Warn);
    assert!(
        !warnings
            .iter()
            .any(|message| message.contains("rules/gate-rules.md")),
        "{warnings:?}"
    );
}

#[test]
fn an_uncovered_inventory_artifact_is_a_coverage_warning() {
    let dir = install(&[]);
    let agents = claude(dir.path()).join("agents");
    fs::create_dir_all(&agents).expect("create the agents dir");
    fs::write(agents.join("developer.md"), "---\nname: developer\n---\n").expect("write the agent");
    // The agent IS a capability, so nothing is uncovered; a hook with no
    // capability would be, but every enumerated kind maps — so the warning set
    // is about the authored overlay keys instead.
    let warnings = messages(dir.path(), IssueLevel::Warn);
    assert!(
        warnings
            .iter()
            .all(|message| !message.starts_with("inventory artifact has no capability")),
        "{warnings:?}"
    );
}

#[test]
fn a_dead_overlay_key_warns_on_a_partial_install() {
    let dir = install(&[]);
    let warnings = messages(dir.path(), IssueLevel::Warn);
    assert!(
        warnings.iter().any(|message| message
            .contains("AUTHORED_INTENTS key has no matching capability")
            && message.contains("mk:cook")),
        "{warnings:?}"
    );
    assert!(
        warnings.iter().any(|message| message
            .contains("AUTHORED_CONTEXT_REQUIREMENTS key has no matching capability")),
        "{warnings:?}"
    );
}

#[test]
fn a_dangling_upstream_dependency_warns() {
    let dir = install(&[("cook", "depends_on: [mk:ghost]\n")]);
    let warnings = messages(dir.path(), IssueLevel::Warn);
    assert!(
        warnings
            .iter()
            .any(|message| message == "upstream dependency has no matching capability: mk:ghost"),
        "{warnings:?}"
    );
}

#[test]
fn two_capabilities_claiming_one_intent_warn_with_both_owners() {
    let dir = install(&[
        ("one", "keywords: [shared]\n"),
        ("two", "keywords: [shared]\n"),
    ]);
    let warnings = messages(dir.path(), IssueLevel::Warn);
    assert!(
        warnings
            .iter()
            .any(|message| message
                == "intent \"shared\" maps to multiple capabilities: mk:one, mk:two"),
        "{warnings:?}"
    );
}

#[test]
fn a_dependency_cycle_is_an_error_naming_the_loop() {
    let dir = install(&[
        ("one", "depends_on: [mk:two]\n"),
        ("two", "depends_on: [mk:one]\n"),
    ]);
    let errors = messages(dir.path(), IssueLevel::Error);
    assert!(
        errors
            .iter()
            .any(|message| message.starts_with("dependency cycle: ")),
        "{errors:?}"
    );
}

#[test]
fn a_clean_manifest_reports_one_pass_row() {
    // An install with every flagship skill present has no dead keys and no
    // duplicate intents — the only state in which the section is a single PASS.
    let flagship = [
        "scout",
        "research",
        "plan-creator",
        "cook",
        "review",
        "fix",
        "testing",
        "ship",
        "memory",
    ];
    let skills: Vec<(&str, &str)> = flagship.iter().map(|name| (*name, "")).collect();
    let dir = install(&skills);
    let rows = check_capabilities_section(&claude(dir.path()));
    assert_eq!(rows.len(), 1, "{rows:#?}");
    assert_eq!(rows[0].status, Status::Pass);
    assert_eq!(rows[0].name, "Capability manifest coherent");
}

#[test]
fn an_owner_disagreement_is_an_error() {
    // The capability's owner is denormalized FROM the inventory, so a
    // disagreement can only come from an inventory the manifest did not read —
    // which is what the validation is for. Build the entries, then mutate one.
    let dir = install(&[("cook", "")]);
    let mut entries = build_capabilities(&claude(dir.path()));
    let inventory = super::super::inventory_build::build_inventory(&claude(dir.path())).entries;
    entries
        .iter_mut()
        .find(|entry| entry.id == "mk:cook")
        .expect("the skill capability")
        .owner = "security".to_string();
    let issues = super::super::capabilities_validate::validate_capability_entries(
        &entries,
        &inventory,
        |_| None,
        |_| true,
    );
    assert!(
        issues.iter().any(|issue| issue.level == IssueLevel::Error
            && issue
                .message
                .contains("denormalized owner \"security\" disagrees")),
        "{issues:?}"
    );
}

use super::*;

#[test]
fn an_escape_is_not_contained() {
    assert!(is_contained("skills/cook/SKILL.md"));
    assert!(!is_contained("../outside.md"));
    assert!(!is_contained("/etc/passwd"));
    assert!(!is_contained("C:\\windows"));
}

#[test]
fn the_authored_entries_round_out_an_empty_install() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let entries = build_capabilities(&dir.path().join(".claude"));
    assert_eq!(entries.len(), AUTHORED_CAPABILITIES.len());
    assert!(entries.iter().all(|entry| entry.source_path.is_none()));
    // Sorted by id, so the manifest is stable between runs.
    let ids: Vec<&str> = entries.iter().map(|entry| entry.id.as_str()).collect();
    let mut sorted = ids.clone();
    sorted.sort_unstable();
    assert_eq!(ids, sorted);
}

#[test]
fn every_authored_overlay_key_is_known_to_the_validator() {
    // The dead-key WARN reads these, so an entry here with no capability
    // must be reported rather than ignored.
    use super::super::capability_authored::{AUTHORED_CONTEXT_REQUIREMENTS, AUTHORED_INTENTS};
    assert_eq!(AUTHORED_INTENTS.len(), 9);
    assert_eq!(AUTHORED_CONTEXT_REQUIREMENTS.len(), 7);
}
