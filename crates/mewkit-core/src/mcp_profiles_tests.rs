use super::*;
use serde_json::json;

fn profile(servers: Value) -> Profile {
    Profile {
        description: String::new(),
        servers: servers.as_object().unwrap().clone(),
    }
}

#[test]
fn selection_never_defaults_to_something() {
    assert!(Selection::parse("").is_empty());
    assert_eq!(Selection::parse("ALL"), Selection::All);
    assert_eq!(
        Selection::parse(" a, b ,"),
        Selection::Names(vec!["a".into(), "b".into()])
    );
}

#[test]
fn a_typo_is_an_error_naming_what_exists() {
    let cat = Catalog {
        profiles: vec![("github-context".into(), profile(json!({})))],
    };
    let err = cat
        .resolve(&Selection::Names(vec!["github".into()]))
        .unwrap_err();
    assert_eq!(
        err,
        "unknown MCP profile \"github\" (known: github-context)"
    );
}

#[test]
fn env_values_must_be_whole_references() {
    let ok = profile(json!({"s": {"command": "npx", "env": {"T": "${env:TOKEN}"}}}));
    assert!(lint("p", &ok).is_empty());
    let bad = profile(json!({"s": {"env": {"T": "abc ${env:TOKEN}"}}}));
    assert_eq!(lint("p", &bad).len(), 1);
}

#[test]
fn undocumented_tokens_and_literal_secrets_are_refused() {
    let p = profile(
        json!({"s": {"url": "https://x/${secret:y}", "args": ["ghp_abcdefghijklmnopqrstuvwxyz"]}}),
    );
    let issues = lint("p", &p);
    assert!(
        issues
            .iter()
            .any(|i| i.contains("undocumented interpolation token"))
    );
    assert!(
        issues
            .iter()
            .any(|i| i.contains("args[0]") && i.contains("literal secret"))
    );
    let fine = profile(json!({"s": {"args": ["${workspaceFolder}/x"]}}));
    assert!(lint("p", &fine).is_empty());
}

#[test]
fn the_users_server_wins_and_a_different_one_is_reported() {
    let existing = r#"{"mcpServers": {"mine": {"command": "a"}, "github": {"command": "other"}}}"#;
    let p = profile(
        json!({"github": {"command": "npx"}, "mine": {"command": "a"}, "new": {"command": "n"}}),
    );
    let m = plan_merge(Some(existing), &[("p", &p)]).unwrap();
    assert_eq!(m.added.keys().collect::<Vec<_>>(), ["new"]);
    assert_eq!(m.conflicts, ["github"]);
}
