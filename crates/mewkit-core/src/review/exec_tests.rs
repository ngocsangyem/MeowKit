use std::path::Path;

use super::{Exec, ExecResult, RealExec, argv};

#[test]
fn a_missing_binary_reports_the_node_spawn_message() {
    let result = RealExec.run(
        "mewkit-no-such-binary-exists",
        &argv(&["--version"]),
        Path::new("."),
    );
    assert!(!result.ok);
    assert_eq!(result.err, "spawnSync mewkit-no-such-binary-exists ENOENT");
}

#[test]
fn a_failing_child_keeps_both_streams() {
    let dir = tempfile::tempdir().expect("a temp dir");
    // `ls` of a path that does not exist: non-zero, with text on stderr.
    let result = RealExec.run("ls", &argv(&["no-such-entry"]), dir.path());
    assert!(!result.ok);
    assert!(!result.err.is_empty(), "stderr was dropped");
}

#[test]
fn a_successful_child_reports_stdout() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let result = RealExec.run("echo", &argv(&["hello"]), dir.path());
    assert_eq!(
        (result.ok, result.out.trim()),
        (true, "hello"),
        "{result:?}"
    );
}

#[test]
fn failed_builds_an_error_only_result() {
    assert_eq!(
        ExecResult::failed("boom"),
        ExecResult {
            ok: false,
            out: String::new(),
            err: "boom".into()
        }
    );
}
