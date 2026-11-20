//! Changing the set of runtimes in a project: adding one and taking another
//! out leaves exactly what a fresh install of those that remain writes, for
//! every ordered pair and for the full set taken down one runtime at a time.
mod support;

use std::collections::BTreeMap;
use std::path::PathBuf;

use support::kit::sha_tree;
use support::temp_home::TempHome;
use support::{code, text};

const RUNTIMES: [&str; 6] = ["claude-code", "codex", "cursor", "grok", "pi", "omp"];

/// Records the launcher's absolute path, so it differs between two projects.
const DESCRIPTOR: &str = ".claude/runtime.json";

/// The project tree without mewkit's own state.
fn kit_files(env: &TempHome) -> BTreeMap<PathBuf, String> {
    sha_tree(&env.project())
        .into_iter()
        .filter(|(path, _)| !path.starts_with(".meowkit") && !path.ends_with(DESCRIPTOR))
        .collect()
}

fn run(env: &TempHome, args: &[&str], step: &str) {
    let out = env.with_kit(args);
    assert_eq!(code(&out), 0, "{step}: {}", text(&out));
}

/// What a fresh install of `set` leaves in an empty project.
fn fresh(set: &[&str]) -> BTreeMap<PathBuf, String> {
    let env = TempHome::new();
    run(&env, &["init", "--target", &set.join(",")], "fresh init");
    kit_files(&env)
}

/// The paths on which two trees differ, for a failure message short enough to read.
fn differing(a: &BTreeMap<PathBuf, String>, b: &BTreeMap<PathBuf, String>) -> Vec<PathBuf> {
    a.keys()
        .chain(b.keys())
        .filter(|path| a.get(*path) != b.get(*path))
        .cloned()
        .collect::<std::collections::BTreeSet<_>>()
        .into_iter()
        .take(12)
        .collect()
}

/// `first` installed, each other runtime added and `first` removed: what is
/// left is a fresh install of the other one.
fn leaving_after_each_other_runtime_joins(first: &str) {
    for stays in RUNTIMES.iter().filter(|r| **r != first) {
        let alone = fresh(&[stays]);
        let env = TempHome::new();
        let pair = format!("{first} then {stays}");
        run(&env, &["init", "--target", first], &pair);
        run(&env, &["init", "--target", stays], &pair);
        run(&env, &["uninstall", "--target", first, "--yes"], &pair);
        let left = kit_files(&env);
        assert!(
            left == alone,
            "{pair}, {first} removed: differs from a fresh {stays} install at {:?}",
            differing(&left, &alone)
        );
        run(&env, &["uninstall", "--target", stays, "--yes"], &pair);
        let left = kit_files(&env);
        assert!(left.is_empty(), "{pair}, both removed: left {left:?}");
    }
}

#[test]
fn claude_code_leaves_a_fresh_install_of_each_other_runtime() {
    leaving_after_each_other_runtime_joins("claude-code");
}

#[test]
fn codex_leaves_a_fresh_install_of_each_other_runtime() {
    leaving_after_each_other_runtime_joins("codex");
}

#[test]
fn cursor_leaves_a_fresh_install_of_each_other_runtime() {
    leaving_after_each_other_runtime_joins("cursor");
}

#[test]
fn grok_leaves_a_fresh_install_of_each_other_runtime() {
    leaving_after_each_other_runtime_joins("grok");
}

#[test]
fn pi_leaves_a_fresh_install_of_each_other_runtime() {
    leaving_after_each_other_runtime_joins("pi");
}

#[test]
fn omp_leaves_a_fresh_install_of_each_other_runtime() {
    leaving_after_each_other_runtime_joins("omp");
}

#[test]
fn the_full_set_taken_down_one_runtime_at_a_time_matches_a_fresh_install_each_time() {
    let env = TempHome::new();
    for runtime in RUNTIMES {
        run(
            &env,
            &["init", "--target", runtime],
            "building the full set",
        );
    }
    let all = fresh(&RUNTIMES);
    let built = kit_files(&env);
    assert!(
        built == all,
        "six added one at a time differ from six at once at {:?}",
        differing(&built, &all)
    );
    let mut remaining: Vec<&str> = RUNTIMES.to_vec();
    while remaining.len() > 1 {
        let leaving = remaining.remove(0);
        run(&env, &["uninstall", "--target", leaving, "--yes"], leaving);
        let left = kit_files(&env);
        let expected = fresh(&remaining);
        assert!(
            left == expected,
            "{leaving} removed, {remaining:?} stay: differs from a fresh install at {:?}",
            differing(&left, &expected)
        );
    }
    run(
        &env,
        &["uninstall", "--target", remaining[0], "--yes"],
        "last",
    );
    assert!(kit_files(&env).is_empty(), "{:?}", kit_files(&env));
}
