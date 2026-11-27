//! Changing the set of runtimes in a project: adding one and taking another
//! out leaves exactly what a fresh install of those that remain writes, for
//! every ordered pair and for the full set taken down one runtime at a time.
mod support;

use std::collections::{BTreeMap, HashMap};
use std::path::PathBuf;
use std::sync::Mutex;

use support::kit::sha_tree;
use support::temp_home::TempHome;
use support::{code, text};

const RUNTIMES: [&str; 7] = [
    "claude-code",
    "codex",
    "cursor",
    "grok",
    "pi",
    "omp",
    "antigravity",
];

/// The project tree without mewkit's own state.
fn kit_files(env: &TempHome) -> BTreeMap<PathBuf, String> {
    sha_tree(&env.project())
        .into_iter()
        .filter(|(path, _)| !path.starts_with(".meowkit"))
        .collect()
}

fn run(env: &TempHome, args: &[&str], step: &str) {
    let out = env.with_kit(args);
    assert_eq!(code(&out), 0, "{step}: {}", text(&out));
}

/// What a fresh install of `set` leaves in an empty project. Installed once
/// per set in a process: the pair tests compare against the same seven
/// single-runtime installs over and over.
fn fresh(set: &[&str]) -> BTreeMap<PathBuf, String> {
    static SEEN: Mutex<Option<HashMap<String, BTreeMap<PathBuf, String>>>> = Mutex::new(None);
    let key = set.join(",");
    if let Some(tree) = SEEN.lock().unwrap().get_or_insert_default().get(&key) {
        return tree.clone();
    }
    let env = TempHome::new();
    run(&env, &["init", "--target", &key], "fresh init");
    let tree = kit_files(&env);
    SEEN.lock()
        .unwrap()
        .get_or_insert_default()
        .insert(key, tree.clone());
    tree
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

/// `first` installed, `stays` added and `first` removed: what is left is a
/// fresh install of `stays`; removing `stays` too leaves nothing.
fn leaving_after_other_runtime_joins(first: &str, stays: &str) {
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

/// One test per ordered pair of distinct runtimes, so a runner can spread
/// the pairs across processes and machines instead of six to a test.
macro_rules! pairs {
    ($($name:ident: $first:literal then $stays:literal;)*) => {$(
        #[test]
        fn $name() {
            leaving_after_other_runtime_joins($first, $stays);
        }
    )*};
}

pairs! {
    claude_code_then_codex: "claude-code" then "codex";
    claude_code_then_cursor: "claude-code" then "cursor";
    claude_code_then_grok: "claude-code" then "grok";
    claude_code_then_pi: "claude-code" then "pi";
    claude_code_then_omp: "claude-code" then "omp";
    claude_code_then_antigravity: "claude-code" then "antigravity";
    codex_then_claude_code: "codex" then "claude-code";
    codex_then_cursor: "codex" then "cursor";
    codex_then_grok: "codex" then "grok";
    codex_then_pi: "codex" then "pi";
    codex_then_omp: "codex" then "omp";
    codex_then_antigravity: "codex" then "antigravity";
    cursor_then_claude_code: "cursor" then "claude-code";
    cursor_then_codex: "cursor" then "codex";
    cursor_then_grok: "cursor" then "grok";
    cursor_then_pi: "cursor" then "pi";
    cursor_then_omp: "cursor" then "omp";
    cursor_then_antigravity: "cursor" then "antigravity";
    grok_then_claude_code: "grok" then "claude-code";
    grok_then_codex: "grok" then "codex";
    grok_then_cursor: "grok" then "cursor";
    grok_then_pi: "grok" then "pi";
    grok_then_omp: "grok" then "omp";
    grok_then_antigravity: "grok" then "antigravity";
    pi_then_claude_code: "pi" then "claude-code";
    pi_then_codex: "pi" then "codex";
    pi_then_cursor: "pi" then "cursor";
    pi_then_grok: "pi" then "grok";
    pi_then_omp: "pi" then "omp";
    pi_then_antigravity: "pi" then "antigravity";
    omp_then_claude_code: "omp" then "claude-code";
    omp_then_codex: "omp" then "codex";
    omp_then_cursor: "omp" then "cursor";
    omp_then_grok: "omp" then "grok";
    omp_then_pi: "omp" then "pi";
    omp_then_antigravity: "omp" then "antigravity";
    antigravity_then_claude_code: "antigravity" then "claude-code";
    antigravity_then_codex: "antigravity" then "codex";
    antigravity_then_cursor: "antigravity" then "cursor";
    antigravity_then_grok: "antigravity" then "grok";
    antigravity_then_pi: "antigravity" then "pi";
    antigravity_then_omp: "antigravity" then "omp";
}

/// The pair list above names every ordered pair of distinct runtimes once.
#[test]
fn the_pair_tests_cover_every_ordered_pair() {
    let listed: Vec<(&str, &str)> = PAIR_SOURCE
        .lines()
        .filter_map(|l| l.split_once(": \""))
        .filter_map(|(_, rest)| rest.split_once("\" then \""))
        .map(|(a, b)| (a, b.trim_end_matches("\";")))
        .collect();
    let mut want = Vec::new();
    for a in RUNTIMES {
        for b in RUNTIMES.iter().filter(|b| **b != a) {
            want.push((a, *b));
        }
    }
    assert_eq!(listed, want);
}

const PAIR_SOURCE: &str = include_str!("lifecycle_set_changes.rs");

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
        "seven added one at a time differ from seven at once at {:?}",
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
