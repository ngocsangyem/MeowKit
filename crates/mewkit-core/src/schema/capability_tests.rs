//! Vocabulary and logical-ID cases for the capability contract. The
//! cross-entry checks (owner agreement, dangling dependency, cycle) belong to
//! `validateCapabilityEntries`, which needs the inventory view and is deferred
//! with the `capabilities` verb.

use serde_json::json;

use super::*;

#[test]
fn kinds_use_their_kebab_case_wire_form() {
    assert_eq!(
        serde_json::to_value(CapabilityKind::ContextService).expect("serializable"),
        json!("context-service")
    );
    assert_eq!(
        serde_json::from_value::<CapabilityKind>(json!("state-service")).expect("known kind"),
        CapabilityKind::StateService
    );
    // `rule` artifacts are inventory-only context and deliberately NOT
    // capabilities.
    assert!(serde_json::from_value::<CapabilityKind>(json!("rule")).is_err());
}

#[test]
fn requirement_types_use_their_snake_case_wire_form() {
    assert_eq!(
        serde_json::to_value(RequirementType::ExternalBinary).expect("serializable"),
        json!("external_binary")
    );
    assert!(serde_json::from_value::<RequirementType>(json!("shell_command")).is_err());
}

#[test]
fn a_requirement_defaults_its_provenance_to_inferred() {
    let requirement: TypedRequirement =
        serde_json::from_value(json!({ "type": "host_tool", "id": "Read" }))
            .expect("valid requirement");
    assert_eq!(requirement.provenance, FieldProvenance::Inferred);
    assert!(requirement.validate("requirements.0").is_empty());
}

#[test]
fn a_requirement_with_an_empty_logical_id_is_refused() {
    let requirement: TypedRequirement =
        serde_json::from_value(json!({ "type": "external_binary", "id": "" }))
            .expect("deserializable");
    assert!(!requirement.validate("requirements.0").is_empty());
}

#[test]
fn refuses_an_unknown_logical_invocation_id() {
    // Hostile frontmatter must not be able to smuggle a command through the
    // invocation contract.
    let invocation: Invocation =
        serde_json::from_value(json!({ "kind": "skill", "id": "rm -rf /" }))
            .expect("deserializable");
    let checked = invocation.validate();
    assert!(!checked.ok);
    assert!(
        checked
            .errors
            .iter()
            .any(|e| e.contains("unknown logical invocation id")),
        "{:?}",
        checked.errors
    );
}

#[test]
fn accepts_every_known_logical_invocation_id() {
    for id in KNOWN_INVOCATION_IDS {
        let invocation: Invocation =
            serde_json::from_value(json!({ "kind": "none", "id": id })).expect("deserializable");
        assert!(invocation.validate().ok, "{id}");
    }
}

#[test]
fn a_context_requirement_defaults_to_the_task_repo_scope() {
    let requirement: ContextRequirement =
        serde_json::from_value(json!({})).expect("both fields default");
    assert_eq!(requirement.scope, "task-repo");
    assert_eq!(requirement.reason, "");
    assert!(requirement.validate().ok);
}

#[test]
fn a_context_requirement_outside_the_task_repo_scope_is_refused() {
    let requirement: ContextRequirement =
        serde_json::from_value(json!({ "scope": "whole-machine" })).expect("deserializable");
    assert!(!requirement.validate().ok);
}

#[test]
fn support_levels_are_four_independent_booleans() {
    let levels: SupportLevels = serde_json::from_value(json!({
        "discoverable": true, "selectable": true, "invocable": false, "enforceable": false
    }))
    .expect("valid levels");
    assert!(levels.discoverable);
    assert!(!levels.invocable);
    // Absence is unknown support, so a partial object is refused rather than
    // read as three falses.
    assert!(serde_json::from_value::<SupportLevels>(json!({ "discoverable": true })).is_err());
}

#[test]
fn verification_defaults_to_unknown_rather_than_to_none() {
    // `unknown` is an explicit gap; `none` is a claim that nothing needs
    // verifying. Defaulting to `none` would silently make the second claim.
    assert_eq!(Verification::default().kind, VerificationKind::Unknown);
    let verification: Verification =
        serde_json::from_value(json!({ "kind": "command", "id": "npm test" }))
            .expect("valid verification");
    assert_eq!(verification.kind, VerificationKind::Command);
}
