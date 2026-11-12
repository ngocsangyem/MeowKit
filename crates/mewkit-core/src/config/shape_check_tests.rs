// The layer exists to catch a shape the RULES let through, so each case here
// states what the rules would have said about the same input. Where the two
// agree the redundancy is doing nothing — that is expected, and is why only the
// rules' message reaches the user.
use super::super::config_values::ConfigValue;
use super::*;

fn values(pairs: &[(&str, ConfigValue)]) -> ConfigValues {
    let mut out = ConfigValues::default();
    for (key, value) in pairs {
        out.insert(*key, value.clone());
    }
    out
}

fn names() -> Vec<String> {
    vec!["budget-tracker".to_string()]
}

#[test]
fn the_declared_surface_passes_at_both_scopes() {
    let config = values(&[
        (
            "$schema",
            ConfigValue::Str(super::super::schema::SCHEMA_URL.into()),
        ),
        ("tdd", ConfigValue::Bool(true)),
        ("budget.block", ConfigValue::Int(100)),
        ("autobuild.mode", ConfigValue::Str("LEAN".into())),
        ("hooks.budget-tracker", ConfigValue::Bool(false)),
    ]);
    for scope in [ConfigScope::ProjectConfig, ConfigScope::UserConfig] {
        assert_eq!(check_shape(&config, &names(), scope), Ok(()));
    }
}

#[test]
fn a_non_string_schema_pointer_is_refused_in_zods_wording() {
    let config = values(&[("$schema", ConfigValue::Int(5))]);
    let error = check_shape(&config, &names(), ConfigScope::ProjectConfig)
        .expect_err("a number is not a pointer");
    assert_eq!(error.key, "$schema");
    // zod says `received number`, not `received 5`.
    assert_eq!(error.detail, "Expected string, received number");
}

#[test]
fn an_unknown_key_names_the_child_the_way_zod_does() {
    let config = values(&[("budget.cpa", ConfigValue::Int(1))]);
    let error =
        check_shape(&config, &names(), ConfigScope::ProjectConfig).expect_err("not a config key");
    assert_eq!(error.key, "budget.cpa");
    assert_eq!(error.detail, "Unrecognized key(s) in object: 'cpa'");
}

#[test]
fn a_wrong_leaf_type_is_refused() {
    let config = values(&[("tdd", ConfigValue::Int(1))]);
    let error = check_shape(&config, &names(), ConfigScope::ProjectConfig).expect_err("not a bool");
    assert_eq!(error.detail, "Expected boolean, received number");
}

#[test]
fn a_value_outside_an_enum_is_refused() {
    let config = values(&[("workflow.telemetry", ConfigValue::Str("loud".into()))]);
    let error = check_shape(&config, &names(), ConfigScope::ProjectConfig).expect_err("not a mode");
    assert_eq!(
        error.detail,
        "Invalid enum value. Expected 'off' | 'community' | 'anonymous', received 'loud'"
    );
}

#[test]
fn the_hatch_key_is_in_the_user_shape_only() {
    let config = values(&[(USER_SCOPE_ONLY_KEY, ConfigValue::Bool(true))]);
    assert_eq!(
        check_shape(&config, &names(), ConfigScope::UserConfig),
        Ok(())
    );
    let error = check_shape(&config, &names(), ConfigScope::ProjectConfig)
        .expect_err("a committed file cannot downgrade Gate 1");
    assert_eq!(
        error.detail,
        format!("Unrecognized key(s) in object: '{USER_SCOPE_ONLY_KEY}'")
    );
}

#[test]
fn an_observer_toggle_for_an_unregistered_hook_is_unknown() {
    let config = values(&[("hooks.not-a-hook", ConfigValue::Bool(true))]);
    assert!(check_shape(&config, &names(), ConfigScope::ProjectConfig).is_err());
}
