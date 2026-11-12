//! Each rejection class fires its own rule, names its own key, and rejects the
//! whole file. The fixture corpus drives the same rules from disk in
//! `tests/config_loader.rs`; these cover the cases a fixture cannot, such as one
//! file holding two offences.
use super::*;

fn names() -> Vec<String> {
    ["budget-tracker", "learning-observer"]
        .iter()
        .map(|name| (*name).to_string())
        .collect()
}

fn verdict(pairs: Vec<(&str, ConfigValue)>, scope: ConfigScope) -> Result<(), Box<RuleError>> {
    let values: ConfigValues = pairs.into_iter().collect();
    apply_rules(&values, &names(), scope)
}

fn code(pairs: Vec<(&str, ConfigValue)>) -> &'static str {
    verdict(pairs, ConfigScope::ProjectConfig)
        .expect_err("a rule must fire")
        .code
}

#[test]
fn a_file_inside_the_surface_applies() {
    assert!(
        verdict(
            vec![
                ("tdd", ConfigValue::Bool(true)),
                ("budget.cap", ConfigValue::Int(5)),
                ("autobuild.mode", ConfigValue::Str("LEAN".into())),
                ("workflow.telemetry", ConfigValue::Str("off".into())),
                ("hooks.budget-tracker", ConfigValue::Bool(false)),
            ],
            ConfigScope::ProjectConfig,
        )
        .is_ok()
    );
}

#[test]
fn a_schema_pointer_is_not_subject_to_the_rules() {
    assert!(
        verdict(
            vec![(
                "$schema",
                ConfigValue::Str(super::super::schema::SCHEMA_URL.into())
            )],
            ConfigScope::ProjectConfig,
        )
        .is_ok(),
        "the schema pointer is an absolute URL and not a setting"
    );
}

#[test]
fn every_rejection_class_fires_its_own_rule() {
    assert_eq!(
        code(vec![("gates.presenceOnly", ConfigValue::Bool(true))]),
        "forbidden-namespace"
    );
    assert_eq!(
        code(vec![("paths.plans", ConfigValue::Str("src".into()))]),
        "forbidden-namespace"
    );
    assert_eq!(
        code(vec![("apiToken", ConfigValue::Str("abc123".into()))]),
        "secret-in-config"
    );
    assert_eq!(
        code(vec![(
            "autobuild.mode",
            ConfigValue::Str("my-secret-mode".into())
        )]),
        "secret-in-config"
    );
    assert_eq!(
        code(vec![(
            "autobuild.mode",
            ConfigValue::Str("/etc/meowkit".into())
        )]),
        "absolute-path"
    );
    assert_eq!(
        code(vec![("autobuild.mode", ConfigValue::Str("C:\\kit".into()))]),
        "absolute-path"
    );
    assert_eq!(
        code(vec![("hooks.gate2-check", ConfigValue::Bool(false))]),
        "protected-hook"
    );
    assert_eq!(
        code(vec![("skip_eng_review", ConfigValue::Bool(true))]),
        "state-only-key"
    );
    assert_eq!(
        code(vec![("gate1PresenceOnly", ConfigValue::Bool(true))]),
        "user-scope-only"
    );
    assert_eq!(
        code(vec![("sparkles", ConfigValue::Bool(true))]),
        "unknown-key"
    );
    assert_eq!(code(vec![("tdd", ConfigValue::Int(7))]), "wrong-type");
    assert_eq!(
        code(vec![("budget.cap", ConfigValue::Str("5".into()))]),
        "wrong-type"
    );
    assert_eq!(
        code(vec![("autobuild.mode", ConfigValue::Bool(true))]),
        "wrong-type"
    );
    assert_eq!(
        code(vec![("autobuild.mode", ConfigValue::Str("TURBO".into()))]),
        "not-in-enum"
    );
}

#[test]
fn the_hatch_key_is_legal_in_the_user_file_only() {
    let pairs = vec![("gate1PresenceOnly", ConfigValue::Bool(true))];
    assert!(verdict(pairs.clone(), ConfigScope::UserConfig).is_ok());
    let error = verdict(pairs, ConfigScope::ProjectConfig).expect_err("a committed downgrade");
    assert_eq!(error.code, "user-scope-only");
    assert!(
        error.fix.contains("MEOWKIT_GATE1_PRESENCE_ONLY"),
        "{}",
        error.fix
    );
}

#[test]
fn an_unregistered_observer_toggle_is_an_unknown_key() {
    let values: ConfigValues = vec![("hooks.not-installed", ConfigValue::Bool(false))]
        .into_iter()
        .collect();
    let error = apply_rules(&values, &[], ConfigScope::ProjectConfig).expect_err("no registry");
    assert_eq!(error.code, "unknown-key");
    assert_eq!(error.key, "hooks.not-installed");
}

#[test]
fn a_protected_hook_is_refused_even_with_no_registry() {
    let values: ConfigValues = vec![("hooks.pre-ship", ConfigValue::Bool(false))]
        .into_iter()
        .collect();
    let error = apply_rules(&values, &[], ConfigScope::ProjectConfig).expect_err("protected");
    assert_eq!(error.code, "protected-hook");
    assert!(error.message.contains("Gate 2"), "{}", error.message);
}

#[test]
fn the_message_names_the_key_the_scope_and_the_fix() {
    let values: ConfigValues = vec![("sparkles", ConfigValue::Bool(true))]
        .into_iter()
        .collect();
    for scope in [ConfigScope::ProjectConfig, ConfigScope::UserConfig] {
        let error = apply_rules(&values, &names(), scope).expect_err("unknown");
        assert_eq!(error.key, "sparkles");
        assert!(error.message.contains(scope.as_str()), "{}", error.message);
        assert!(error.fix.contains(".meowkit/config.yaml"), "{}", error.fix);
    }
}

#[test]
fn a_wrong_type_message_quotes_a_string_and_not_a_number() {
    let number = verdict(
        vec![("tdd", ConfigValue::Int(7))],
        ConfigScope::ProjectConfig,
    )
    .expect_err("a number for a boolean");
    assert!(number.message.ends_with("not 7"), "{}", number.message);
    let text = verdict(
        vec![("budget.cap", ConfigValue::Str("5".into()))],
        ConfigScope::ProjectConfig,
    )
    .expect_err("a string for an integer");
    assert!(text.message.ends_with("not \"5\""), "{}", text.message);
}

#[test]
fn the_first_offending_key_in_file_order_is_the_one_reported() {
    // Two offences, one file. The reader the hooks run reports the key it met
    // first, so this one has to as well — a message about the second key sends
    // the user to the wrong line.
    let error = verdict(
        vec![
            ("sparkles", ConfigValue::Bool(true)),
            ("apiToken", ConfigValue::Str("abc".into())),
        ],
        ConfigScope::ProjectConfig,
    )
    .expect_err("two offences");
    assert_eq!(error.key, "sparkles");
}
