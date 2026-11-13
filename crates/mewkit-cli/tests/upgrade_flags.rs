//! `upgrade --check`, `--list`, `--no-cleanup` and `--yes`, and the `--force`
//! confirmation `init` shares with `upgrade`. The queries run
//! `--offline` against a kit cached from a local archive, so no test reaches
//! GitHub; the online listing is the same code over `kit::list_available`.
mod support;

use support::archive;
use support::kit::sha_tree;
use support::temp_home::TempHome;
use support::{code, text};

/// A project with codex installed from a local archive, which also caches it.
fn installed_from_archive() -> (TempHome, tempfile::TempDir) {
    let env = TempHome::new();
    let scratch = tempfile::tempdir().unwrap();
    let (zip, sha) = archive(scratch.path());
    let out = env.mewkit_next(&[
        "init",
        "--target",
        "codex",
        "--kit-archive",
        &zip.to_string_lossy(),
        "--kit-sha256",
        &sha,
        "--allow-unverified-kit",
    ]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    (env, scratch)
}

fn json(out: &std::process::Output) -> serde_json::Value {
    serde_json::from_slice(&out.stdout).unwrap_or_else(|e| panic!("{e}: {}", text(out)))
}

#[test]
fn check_compares_the_install_with_the_cached_kit_and_changes_nothing() {
    let (env, _scratch) = installed_from_archive();
    let before = sha_tree(&env.project());

    let out = env.mewkit_next(&["upgrade", "--check", "--offline"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    let shown = text(&out);
    assert!(shown.contains("installed (project): codex kit"), "{shown}");
    assert!(shown.contains("already up to date"), "{shown}");

    let doc = json(&env.mewkit_next(&["upgrade", "--check", "--offline", "--json"]));
    let row = &doc["installed"][0];
    assert_eq!(row["target"], "codex");
    assert!(row["update"].is_null(), "{doc}");
    assert_eq!(
        doc["latestStable"]["version"].as_str(),
        row["kitVersion"]
            .as_str()
            .map(|v| v.trim_start_matches('v'))
    );
    assert_eq!(sha_tree(&env.project()), before, "--check writes nothing");
}

#[test]
fn list_marks_the_installed_release() {
    let (env, _scratch) = installed_from_archive();
    let doc = json(&env.mewkit_next(&["upgrade", "--list", "--offline", "--json"]));
    let releases = doc["releases"].as_array().expect("releases");
    assert_eq!(releases.len(), 1, "{doc}");
    assert_eq!(releases[0]["installedBy"], serde_json::json!(["codex"]));
    let out = env.mewkit_next(&["upgrade", "--list", "--offline"]);
    assert!(text(&out).contains("installed: codex"), "{}", text(&out));
}

#[test]
fn queries_answer_with_nothing_installed_or_cached() {
    let env = TempHome::new();
    let out = env.mewkit_next(&["upgrade", "--check", "--offline"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(
        text(&out).contains("installed (project): nothing"),
        "{}",
        text(&out)
    );
    assert!(
        text(&out).contains("no kit releases found"),
        "{}",
        text(&out)
    );
    let doc = json(&env.mewkit_next(&["upgrade", "--list", "--offline", "--json"]));
    assert_eq!(doc["releases"], serde_json::json!([]));
}

#[test]
fn check_is_not_a_dry_run_and_not_a_list() {
    let env = TempHome::new();
    for args in [
        ["upgrade", "--check", "--dry-run"],
        ["upgrade", "--check", "--list"],
    ] {
        let out = env.mewkit_next(&args);
        assert_eq!(code(&out), 2, "{args:?}: {}", text(&out));
    }
}

#[test]
fn no_cleanup_is_accepted_and_changes_nothing_about_the_run() {
    let env = TempHome::new();
    let out = env.with_kit(&["init", "--target", "cursor"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    let out = env.with_kit(&["upgrade", "--no-cleanup"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
}

#[test]
fn an_unconfirmed_force_names_yes_and_writes_nothing() {
    let env = TempHome::new();
    assert_eq!(code(&env.with_kit(&["init", "--target", "cursor"])), 0);
    let before = sha_tree(&env.project());
    let out = env.with_kit(&["upgrade", "--force"]);
    assert_eq!(code(&out), 3, "{}", text(&out));
    assert!(text(&out).contains("Re-run with --yes"), "{}", text(&out));
    assert_eq!(sha_tree(&env.project()), before);
}

#[test]
fn an_unconfirmed_init_force_previews_and_a_confirmed_one_replaces() {
    let env = TempHome::new();
    assert_eq!(code(&env.with_kit(&["init", "--target", "cursor"])), 0);
    support::write(&env.project(), ".cursor/agents/advisor.md", "mine\n");
    let before = sha_tree(&env.project());
    let out = env.with_kit(&["init", "--target", "cursor", "--force"]);
    assert_eq!(code(&out), 3, "{}", text(&out));
    assert!(text(&out).contains("init --force"), "{}", text(&out));
    assert_eq!(sha_tree(&env.project()), before);
    let out = env.with_kit(&["init", "--target", "cursor", "--force", "--yes"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert_ne!(sha_tree(&env.project()), before);
}
