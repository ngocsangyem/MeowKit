//! A project the binary installs reaches the binary through its committed
//! launcher, with no `node_modules` and no npm CLI anywhere.
//!
//! Hooks stay Node scripts and run the CLI through `.meowkit/bin/mewkit`
//! (orientation via `.claude/runtime.json`, the agent's shell via PATH, the
//! ship-boundary memory lint directly). These cases run that launcher under
//! node, as the hooks do, with only the built binary and node on PATH. Node is
//! required, as it is for the hooks themselves.
mod support;

use std::path::{Path, PathBuf};
use std::process::Output;

use mewkit_adapters::claude_code::launcher::LAUNCHER;
use support::temp_home::TempHome;
use support::{code, text};

/// The directory holding the binary under test.
fn binary_dir() -> PathBuf {
    Path::new(env!("CARGO_BIN_EXE_mewkit"))
        .parent()
        .expect("the binary has a directory")
        .to_path_buf()
}

/// Node's own path, found the way a hook's environment would find it.
fn node() -> PathBuf {
    let probe = std::process::Command::new("node")
        .args(["-e", "process.stdout.write(process.execPath)"])
        .output()
        .expect("node is required to run the launcher, as it is for the hooks");
    PathBuf::from(String::from_utf8(probe.stdout).expect("UTF-8 path"))
}

/// Run the project's launcher with `args`, PATH holding only the binary and node.
fn launch(env: &TempHome, args: &[&str]) -> Output {
    let node = node();
    let path = std::env::join_paths([binary_dir(), node.parent().unwrap().to_path_buf()])
        .expect("join PATH");
    env.command(&node)
        .arg(env.project().join(LAUNCHER))
        .args(args)
        .env("PATH", path)
        .env_remove("MEWKIT_INSTALL_DIR")
        .output()
        .expect("run the launcher")
}

fn installed() -> TempHome {
    let env = TempHome::new();
    let out = env.with_kit(&["init", "--target", "claude-code"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    env
}

#[test]
fn init_writes_an_executable_launcher_and_a_descriptor_the_hook_trusts() {
    let env = installed();
    let p = env.project();
    let launcher = p.join(LAUNCHER);
    assert!(launcher.is_file(), "no launcher at {}", launcher.display());
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = std::fs::metadata(&launcher).unwrap().permissions().mode();
        assert_ne!(mode & 0o111, 0, "the launcher is not executable");
    }
    let descriptor: serde_json::Value =
        serde_json::from_slice(&std::fs::read(p.join(".claude/runtime.json")).unwrap()).unwrap();
    let accepted = mewkit_core::schema::runtime_descriptor::accept(&descriptor, &p)
        .unwrap_or_else(|e| panic!("the orientation hook would refuse it: {e}: {descriptor}"));
    assert!(Path::new(&accepted.executable).ends_with(LAUNCHER));
}

#[test]
fn the_launcher_runs_the_binary_with_no_node_modules() {
    let env = installed();
    assert!(!env.project().join("node_modules").exists());
    let out = launch(&env, &["--version"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert_eq!(
        String::from_utf8_lossy(&out.stdout).trim(),
        format!("mewkit {}", mewkit_core::VERSION)
    );
    // What the SessionStart orientation hook runs through the descriptor.
    let out = launch(&env, &["orient", "--no-record"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
}

#[test]
fn a_reinstall_leaves_the_launcher_alone_and_uninstall_removes_both() {
    let env = installed();
    let p = env.project();
    let dry = env.with_kit(&["upgrade", "--dry-run"]);
    assert_eq!(
        code(&dry),
        0,
        "an unchanged install plans no change: {}",
        text(&dry)
    );

    let out = env.with_kit(&["uninstall", "--yes"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(!p.join(LAUNCHER).exists(), "the launcher was left behind");
    assert!(
        !p.join(".claude/runtime.json").exists(),
        "the descriptor was left behind"
    );
}
