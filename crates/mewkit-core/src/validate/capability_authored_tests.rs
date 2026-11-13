//! Unit tests for `capability_authored` — the capability authored rules.
use super::*;

#[test]
fn the_overlay_keys_are_skill_capability_ids() {
    // A key that is not `mk:`-prefixed could never match a built
    // capability, so the dead-key WARN would fire forever.
    for (key, _, _) in AUTHORED_INTENTS {
        assert!(key.starts_with("mk:"), "{key} is not a skill id");
    }
    for key in AUTHORED_CONTEXT_REQUIREMENTS {
        assert!(key.starts_with("mk:"), "{key} is not a skill id");
    }
}

#[test]
fn a_tool_entry_claims_no_intent() {
    for capability in AUTHORED_CAPABILITIES {
        if capability.kind == "tool" {
            assert!(
                capability.intents.is_empty(),
                "{} would win intent resolution with invocation none",
                capability.id
            );
        }
    }
}
