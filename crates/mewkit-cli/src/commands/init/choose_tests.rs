use super::*;

#[test]
fn a_delivery_needs_claude_code_among_the_targets() {
    assert_eq!(delivery(&[Runtime::Codex], None), Ok(Delivery::Native));
    assert_eq!(
        delivery(&[Runtime::Codex], Some("  ")),
        Ok(Delivery::Native)
    );
    let err = delivery(&[Runtime::Codex], Some("plugin")).unwrap_err();
    assert!(
        err.contains("--target claude-code only") && err.contains("\"codex\""),
        "{err}"
    );
    assert_eq!(
        delivery(&[Runtime::ClaudeCode, Runtime::Codex], Some("plugin")),
        Ok(Delivery::Plugin)
    );
}

#[test]
fn an_unknown_delivery_lists_the_valid_ones() {
    let err = delivery(&[Runtime::ClaudeCode], Some("zip")).unwrap_err();
    assert_eq!(
        err,
        "Unknown --delivery \"zip\". The deliveries are native, plugin. Nothing was written."
    );
}

#[test]
fn skill_packs_read_the_way_the_npm_cli_reads_them() {
    assert!(skill_packs(None).is_empty());
    assert_eq!(skill_packs(Some("")), [DEFAULT_ONLY]);
    assert_eq!(skill_packs(Some("ALL")), [ALL_PACKS]);
    assert_eq!(skill_packs(Some(" core , media,")), ["core", "media"]);
}
