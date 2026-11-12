//! Accept/reject cases for a capability entry and its manifest, including the
//! two schema-level refusals asserted in `core/__tests__/capability.test.ts`:
//! an unknown invocation id and a `sourcePath` that escapes `.claude/`.

use serde_json::{Value, json};

use super::super::capability::VerificationKind;
use super::*;

fn entry() -> Value {
    json!({
        "id": "mk:cook",
        "kind": "skill",
        "description": "Build",
        "aliases": [],
        "sourcePath": "skills/cook/SKILL.md",
        "inventoryId": "skill:cook",
        "owner": "lifecycle",
        "installedState": "installed",
        "intents": ["build"],
        "whenToUse": "build",
        "invocation": { "kind": "skill", "id": "invoke-skill" },
        "requirements": [{ "type": "host_tool", "id": "Read", "provenance": "inferred" }],
        "contextRequirement": { "scope": "task-repo", "reason": "source-grounded verification" },
        "support": { "claude-code": {
            "discoverable": true, "selectable": true, "invocable": true, "enforceable": false
        }},
        "verification": { "kind": "command", "id": "npm test" },
        "dependencies": { "upstream": [], "downstream": ["mk:ship"] },
        "provenance": { "contextRequirement": "authored" }
    })
}

fn with(key: &str, value: Value) -> Value {
    let mut out = entry();
    out[key] = value;
    out
}

#[test]
fn accepts_a_well_formed_entry() {
    let parsed = CapabilityEntry::parse(&entry()).expect("valid entry");
    assert_eq!(parsed.kind, CapabilityKind::Skill);
    assert_eq!(parsed.installed_state, InstalledState::Installed);
    assert_eq!(
        parsed.provenance["contextRequirement"],
        FieldProvenance::Authored
    );
    assert!(parsed.support["claude-code"].invocable);
}

#[test]
fn applies_every_default_so_an_authored_only_entry_parses() {
    let parsed = CapabilityEntry::parse(&json!({
        "id": "tool:gh",
        "kind": "tool",
        "invocation": { "kind": "none", "id": "none" }
    }))
    .expect("an authored tool has no disk artifact");
    assert_eq!(parsed.source_path, None);
    assert_eq!(parsed.inventory_id, None);
    assert_eq!(parsed.installed_state, InstalledState::Unknown);
    assert_eq!(parsed.verification.kind, VerificationKind::Unknown);
    assert!(parsed.context_requirement.is_none());
    assert!(parsed.support.is_empty());
}

#[test]
fn refuses_an_unknown_invocation_id() {
    let checked = CapabilityEntry::parse(&with(
        "invocation",
        json!({ "kind": "skill", "id": "rm -rf /" }),
    ))
    .expect_err("hostile frontmatter cannot smuggle a command");
    assert!(
        checked
            .iter()
            .any(|e| e.contains("unknown logical invocation id")),
        "{checked:?}"
    );
}

#[test]
fn refuses_a_source_path_that_escapes_claude() {
    // The last three are Windows spellings the first version of this check let
    // through: it tested only `starts_with('/')` and split on `/`.
    for path in [
        "../../etc/passwd",
        "/etc/passwd",
        "skills/../../x",
        "..\\x",
        "a\\..\\..\\b",
        "C:\\x",
    ] {
        let errors = CapabilityEntry::parse(&with("sourcePath", json!(path)))
            .expect_err("a path leaving .claude/ is refused");
        assert!(
            // The TS message, verbatim: `sourcePath escapes .claude/: <path>`.
            errors
                .iter()
                .any(|e| e == &format!("sourcePath escapes .claude/: {path}")),
            "{path}: {errors:?}"
        );
    }
}

#[test]
fn a_relative_source_path_with_dots_in_a_name_is_still_contained() {
    for path in ["skills/cook/SKILL.md", "rules/..rules.md", "a/.../b"] {
        assert!(
            CapabilityEntry::parse(&with("sourcePath", json!(path))).is_ok(),
            "{path} was refused"
        );
    }
}

#[test]
fn refuses_an_empty_id_and_an_unknown_kind() {
    assert!(CapabilityEntry::parse(&with("id", json!(""))).is_err());
    assert!(CapabilityEntry::parse(&with("kind", json!("rule"))).is_err());
}

#[test]
fn a_null_source_path_and_inventory_id_round_trip_as_null() {
    let mut authored = entry();
    authored["sourcePath"] = Value::Null;
    authored["inventoryId"] = Value::Null;
    let parsed = CapabilityEntry::parse(&authored).expect("authored kinds carry nulls");
    let back = serde_json::to_value(&parsed).expect("serializable");
    assert_eq!(back["sourcePath"], Value::Null);
    assert_eq!(back["inventoryId"], Value::Null);
}

#[test]
fn a_manifest_reports_a_nested_entry_problem_with_its_index() {
    let errors = CapabilityManifest::parse(&json!({
        "schemaVersion": "1.0",
        "entries": [entry(), with("invocation", json!({ "kind": "skill", "id": "exec" }))]
    }))
    .expect_err("the second entry names an unknown invocation id");
    assert!(
        errors.iter().any(|e| e.starts_with("entries.1.")),
        "{errors:?}"
    );
}

#[test]
fn a_manifest_refuses_an_unsupported_schema_version() {
    assert!(CapabilityManifest::parse(&json!({ "schemaVersion": "2.0", "entries": [] })).is_err());
    assert!(CapabilityManifest::parse(&json!({ "schemaVersion": "1.0", "entries": [] })).is_ok());
}
