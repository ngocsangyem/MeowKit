use std::fs;
use std::path::Path;
#[cfg(unix)]
use std::time::Duration;

#[cfg(unix)]
use super::runner::run_child;
use super::sandbox::*;
use super::*;

fn parent() -> Vec<(String, String)> {
    [
        ("PATH", "/usr/bin:/bin"),
        ("AWS_SECRET_ACCESS_KEY", "leak-me"),
        ("GITHUB_TOKEN", "leak-me-too"),
        ("CLAUDE_CODE_OAUTH_TOKEN", "tok"),
        ("OPENAI_API_KEY", "sk"),
        ("HOME", "/Users/someone"),
        ("TERM", ""),
    ]
    .into_iter()
    .map(|(k, v)| (k.to_owned(), v.to_owned()))
    .collect()
}

fn keys(env: &[(String, String)]) -> Vec<&str> {
    env.iter().map(|(k, _)| k.as_str()).collect()
}

#[test]
fn child_env_keeps_only_the_allowlist_and_points_home_inside() {
    let home = Path::new("/sandbox/home");
    let env = child_env(parent(), Runtime::ClaudeCode, home);
    assert_eq!(
        keys(&env),
        [
            "CLAUDE_CODE_OAUTH_TOKEN",
            "CLAUDE_CONFIG_DIR",
            "HOME",
            "PATH"
        ]
    );
    assert!(env.contains(&("HOME".into(), "/sandbox/home".into())));
    // Joined the way the sandbox joins it, so the separator matches on Windows.
    let config = home.join(".claude").display().to_string();
    assert!(env.contains(&("CLAUDE_CONFIG_DIR".into(), config)));
    assert!(has_auth(&env, Runtime::ClaudeCode));
}

#[test]
fn each_runtime_sees_only_its_own_credentials() {
    let env = child_env(parent(), Runtime::Codex, Path::new("/h"));
    assert_eq!(keys(&env), ["CODEX_HOME", "HOME", "OPENAI_API_KEY", "PATH"]);
    let none = child_env(
        vec![("PATH".into(), "/bin".into())],
        Runtime::Codex,
        Path::new("/h"),
    );
    assert!(!has_auth(&none, Runtime::Codex));
}

#[cfg(unix)]
#[test]
fn a_secret_in_the_parent_is_absent_in_the_real_child_process() {
    let dir = tempfile::tempdir().expect("tmp");
    let env = child_env(parent(), Runtime::ClaudeCode, dir.path());
    let out = run_child(
        "/usr/bin/env",
        &[],
        &env,
        dir.path(),
        &dir.path().join("out.txt"),
        Duration::from_secs(10),
    )
    .expect("env runs");
    assert!(!out.contains("leak-me"), "{out}");
    assert!(!out.contains("AWS_SECRET_ACCESS_KEY"), "{out}");
    assert!(out.contains("CLAUDE_CONFIG_DIR="), "{out}");
}

#[test]
fn copy_tree_copies_dotfiles_and_nested_folders() {
    let src = tempfile::tempdir().expect("tmp");
    fs::create_dir_all(src.path().join(".claude/x")).expect("mkdir");
    fs::write(src.path().join(".claude/x/a.md"), "a").expect("write");
    fs::write(src.path().join("README.md"), "r").expect("write");
    let dst = tempfile::tempdir().expect("tmp");
    copy_tree(src.path(), &dst.path().join("w")).expect("copies");
    assert_eq!(
        fs::read_to_string(dst.path().join("w/.claude/x/a.md")).expect("read"),
        "a"
    );
    assert!(dst.path().join("w/README.md").is_file());
}

#[cfg(unix)]
#[test]
fn copy_tree_refuses_symlinks() {
    let src = tempfile::tempdir().expect("tmp");
    std::os::unix::fs::symlink("/etc/hosts", src.path().join("hosts")).expect("symlink");
    let dst = tempfile::tempdir().expect("tmp");
    assert!(copy_tree(src.path(), &dst.path().join("w")).is_err());
}

#[test]
fn remove_skill_deletes_every_installed_copy_and_nothing_else() {
    let root = tempfile::tempdir().expect("tmp");
    for d in [
        ".claude/skills/cook",
        ".agents/skills/mk-cook",
        ".claude/skills/cook-helper",
        ".claude/skills/fix",
        "src/cook",
    ] {
        fs::create_dir_all(root.path().join(d)).expect("mkdir");
        fs::write(root.path().join(d).join("SKILL.md"), "x").expect("write");
    }
    let removed = remove_skill(root.path(), "cook").expect("removes");
    assert_eq!(removed.len(), 2);
    assert!(!root.path().join(".claude/skills/cook").exists());
    assert!(!root.path().join(".agents/skills/mk-cook").exists());
    for kept in [
        ".claude/skills/cook-helper",
        ".claude/skills/fix",
        "src/cook",
    ] {
        assert!(root.path().join(kept).exists(), "{kept}");
    }
}

#[test]
fn dir_workspace_matches_star_segments_and_reads_contents() {
    use crate::fsx::RelPath;
    let root = tempfile::tempdir().expect("tmp");
    for (p, c) in [
        ("tasks/plans/261122-flag/plan.md", "# Plan"),
        ("tasks/plans/261122-flag/phase-01-x.md", "- [x] done"),
        ("tasks/reports/debug-report.md", "root cause"),
    ] {
        let path = root.path().join(p);
        fs::create_dir_all(path.parent().expect("parent")).expect("mkdir");
        fs::write(path, c).expect("write");
    }
    let ws = DirWorkspace(root.path().to_path_buf());
    let read = |p: &str| ws.read_matching(&RelPath::new(p).expect("rel"));
    assert_eq!(read("tasks/plans/*/plan.md"), ["# Plan"]);
    assert_eq!(read("tasks/plans/*/phase-*.md"), ["- [x] done"]);
    assert_eq!(read("tasks/reports/*"), ["root cause"]);
    assert!(read("tasks/plans/*/missing.md").is_empty());
    assert!(read("tasks/*").is_empty(), "folders are not files");
}
