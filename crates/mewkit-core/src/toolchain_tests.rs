use std::time::Duration;

use super::*;

#[cfg(unix)]
fn script(dir: &std::path::Path, name: &str, body: &str) -> std::path::PathBuf {
    use std::os::unix::fs::PermissionsExt;
    let path = dir.join(name);
    std::fs::write(&path, format!("#!/bin/sh\n{body}\n")).unwrap();
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
    path
}

#[cfg(unix)]
#[test]
fn a_successful_install_streams_trimmed_stdout() {
    let tmp = tempfile::tempdir().unwrap();
    let pip = script(tmp.path(), "pip", "echo ' collected x '");
    let mut seen = Vec::new();
    let result = pip_install(&pip, "x", &mut |t| seen.push(t.to_string()));
    assert!(result.success && result.error.is_none());
    assert_eq!(seen, ["collected x"]);
}

#[cfg(unix)]
#[test]
fn a_failed_install_reports_the_last_stderr_line() {
    let tmp = tempfile::tempdir().unwrap();
    let pip = script(
        tmp.path(),
        "pip",
        "echo first >&2; echo no such package >&2; exit 1",
    );
    let result = pip_install(&pip, "x", &mut |_| {});
    assert_eq!(result.error.as_deref(), Some("no such package"));
}

#[cfg(unix)]
#[test]
fn a_silent_failure_is_unknown_error() {
    let tmp = tempfile::tempdir().unwrap();
    let pip = script(tmp.path(), "pip", "exit 3");
    assert_eq!(
        pip_install(&pip, "x", &mut |_| {}).error.as_deref(),
        Some("Unknown error")
    );
}

#[cfg(unix)]
#[test]
fn a_hung_install_is_killed_at_the_timeout() {
    let tmp = tempfile::tempdir().unwrap();
    let pip = script(tmp.path(), "pip", "exec sleep 30");
    let result = pip_install_within(&pip, "x", Duration::from_millis(150), &mut |_| {});
    assert!(!result.success);
    assert_eq!(result.error.as_deref(), Some("Timeout: exceeded 120s"));
}

#[test]
fn a_missing_pip_names_the_path() {
    let result = pip_install(std::path::Path::new("/nope/pip"), "x", &mut |_| {});
    assert_eq!(result.error.as_deref(), Some("spawn /nope/pip ENOENT"));
}

#[cfg(unix)]
#[test]
fn a_failed_command_carries_node_s_wording() {
    let message = run_checked("sh", &["-c", "echo boom >&2; exit 2"]).unwrap_err();
    assert_eq!(
        message,
        "Command failed: sh -c echo boom >&2; exit 2\nboom\n"
    );
    assert_eq!(
        run_checked("/nope/x", &[]).unwrap_err(),
        "spawnSync /nope/x ENOENT"
    );
}
