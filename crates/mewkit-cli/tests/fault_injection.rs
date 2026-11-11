//! A run killed part-way (debug builds abort on `MEWKIT_NEXT_FAULT_AFTER`)
//! and run again ends exactly where an uninterrupted run does.
mod support;

use support::kit::sha_tree;
use support::temp_home::TempHome;
use support::{code, text, write};

const USER_AGENTS: &str = "# Mine\n";

fn project_with_user_file() -> TempHome {
    let env = TempHome::new();
    write(&env.project(), "AGENTS.md", USER_AGENTS);
    env
}

#[test]
fn an_interrupted_init_rerun_matches_a_clean_init() {
    let clean = project_with_user_file();
    assert_eq!(
        code(&clean.with_kit(&["init", "--target", "codex,cursor"])),
        0
    );

    let env = project_with_user_file();
    let out = env.with_kit_crashing_after(40, &["init", "--target", "codex,cursor"]);
    assert!(!out.status.success(), "the fault fired: {}", text(&out));
    let out = env.with_kit(&["init", "--target", "codex,cursor"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert_eq!(sha_tree(&env.project()), sha_tree(&clean.project()));
}

#[test]
fn an_interrupted_uninstall_rerun_matches_a_clean_uninstall() {
    let env = project_with_user_file();
    assert_eq!(
        code(&env.with_kit(&["init", "--target", "codex,cursor"])),
        0
    );
    let out = env.with_kit_crashing_after(25, &["uninstall", "--yes"]);
    assert!(!out.status.success(), "the fault fired: {}", text(&out));
    let out = env.with_kit(&["uninstall", "--yes"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    let left = sha_tree(&env.project());
    assert_eq!(left.len(), 1, "only the user's AGENTS.md: {left:?}");
    assert_eq!(
        std::fs::read_to_string(env.project().join("AGENTS.md")).unwrap(),
        USER_AGENTS
    );
}

const USER_HOOKS: &str = "{\n  \"version\": 1,\n  \"hooks\": {\n    \"stop\": [\n      { \"command\": \"./mine.sh\" }\n    ]\n  }\n}\n";

fn project_with_user_hooks() -> TempHome {
    let env = TempHome::new();
    write(&env.project(), ".cursor/hooks.json", USER_HOOKS);
    env
}

/// The writes a cursor init makes, in order (the index comes last).
fn cursor_init_writes() -> Vec<String> {
    let env = project_with_user_hooks();
    let out = env.with_kit(&["init", "--target", "cursor", "--dry-run", "--json"]);
    assert_eq!(code(&out), 3, "{}", text(&out));
    let doc: serde_json::Value = serde_json::from_slice(&out.stdout).unwrap();
    doc[0]["written"]
        .as_array()
        .unwrap()
        .iter()
        .map(|p| p.as_str().unwrap().to_owned())
        .collect()
}

#[test]
fn a_crash_after_a_merge_leaves_the_users_hooks_file_as_it_was() {
    let clean = project_with_user_hooks();
    assert_eq!(code(&clean.with_kit(&["init", "--target", "cursor"])), 0);

    let writes = cursor_init_writes();
    let merged = writes
        .iter()
        .position(|p| p == ".cursor/hooks.json")
        .expect("init merges into hooks.json");
    // Right after the merge, and right before the index is written.
    for n in [merged + 1, writes.len()] {
        let env = project_with_user_hooks();
        let out = env.with_kit_crashing_after(n as u32, &["init", "--target", "cursor"]);
        assert!(!out.status.success(), "fault {n} fired: {}", text(&out));
        let out = env.with_kit(&["init", "--target", "cursor"]);
        assert_eq!(code(&out), 0, "{}", text(&out));
        assert!(text(&out).contains("interrupted run"), "{}", text(&out));
        assert_eq!(
            sha_tree(&env.project()),
            sha_tree(&clean.project()),
            "fault {n}"
        );

        let out = env.with_kit(&["uninstall", "--yes"]);
        assert_eq!(code(&out), 0, "{}", text(&out));
        // Uninstall re-serializes the file; what must survive is its content.
        let left: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(env.project().join(".cursor/hooks.json")).unwrap(),
        )
        .unwrap();
        let mine: serde_json::Value = serde_json::from_str(USER_HOOKS).unwrap();
        assert_eq!(left, mine, "fault {n}");
    }
}

#[test]
fn a_dry_run_after_a_crash_says_the_next_run_restores_first() {
    let env = project_with_user_hooks();
    let out = env.with_kit_crashing_after(3, &["init", "--target", "cursor"]);
    assert!(!out.status.success(), "{}", text(&out));
    let out = env.with_kit(&["init", "--target", "cursor", "--dry-run"]);
    assert!(text(&out).contains("interrupted"), "{}", text(&out));
}
