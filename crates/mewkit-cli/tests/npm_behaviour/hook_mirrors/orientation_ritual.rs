//! `orientation-ritual.cjs` runs the committed launcher only when it stays
//! inside the project.

use super::*;

const DRIVER: &str = r#"
const path = require('node:path');
const root = process.env.CLAUDE_PROJECT_DIR;
const handler = require(path.join(root, '.claude', 'hooks', 'handlers', 'orientation-ritual.cjs'));
process.stdout.write(handler({ source: 'resume' }) || '');
"#;

/// Install the handler in a scratch project, let `place_launcher` put (or not
/// put) something at `.meowkit/bin/mewkit`, and return what the handler injects.
fn handler_output(place_launcher: impl FnOnce(&Path, &Path)) -> String {
    let s = scratch("mewkit-mirror-handler-", "active-task");
    let hooks = s.project.join(".claude/hooks");
    copy_tree(
        &npm::repo_root().join(".claude/hooks/lib"),
        &hooks.join("lib"),
    );
    std::fs::create_dir_all(hooks.join("handlers")).expect("create the handlers dir");
    std::fs::copy(
        hook("handlers/orientation-ritual.cjs"),
        hooks.join("handlers/orientation-ritual.cjs"),
    )
    .expect("copy the handler");
    let launcher = s.project.join(".meowkit/bin/mewkit");
    std::fs::create_dir_all(launcher.parent().unwrap()).expect("create the launcher dir");
    place_launcher(Path::new(env!("CARGO_BIN_EXE_mewkit")), &launcher);

    let driver = s.project.join("drive-handler.cjs");
    std::fs::write(&driver, DRIVER).expect("write the driver");
    let (code, text) = node(&s, &[driver.as_ref()]);
    assert_eq!(code, 0, "the handler failed: {text}");
    text
}

#[test]
fn the_handler_runs_the_committed_launcher() {
    let injected = handler_output(|binary, launcher| {
        std::fs::copy(binary, launcher).expect("copy the binary");
    });
    assert!(
        injected.contains("orientation: active") && injected.contains("task: alpha"),
        "the handler did not run the launcher: {injected:?}"
    );
}

#[cfg(unix)]
#[test]
fn the_handler_refuses_a_launcher_that_leaves_the_project() {
    let injected = handler_output(|binary, launcher| {
        std::os::unix::fs::symlink(binary, launcher).expect("link outside the project");
    });
    assert!(
        !injected.contains("orientation: active"),
        "the handler ran a launcher outside the project: {injected:?}"
    );
}
