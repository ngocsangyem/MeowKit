//! End-to-end checks of the `mewkit` binary's entry surface.
mod support;

use support::temp_home::{TempHome, assert_home_is_temp};

#[test]
fn harness_home_is_under_temp_dir() {
    let env = TempHome::new();
    assert_home_is_temp(&env.home());
}

#[test]
#[should_panic(expected = "is not under the temp dir")]
fn harness_refuses_a_home_outside_temp_dir() {
    // The workspace root is never inside the OS temp dir in a normal checkout.
    assert_home_is_temp(std::path::Path::new(env!("CARGO_MANIFEST_DIR")));
}

#[test]
fn spawned_command_sees_the_redirected_home() {
    let env = TempHome::new();
    let probe = if cfg!(windows) {
        env.command("cmd")
            .args(["/C", "echo %USERPROFILE%"])
            .output()
    } else {
        env.command("sh").args(["-c", "echo $HOME"]).output()
    }
    .expect("spawn probe");
    let printed = String::from_utf8_lossy(&probe.stdout).trim().to_string();
    assert_eq!(std::path::PathBuf::from(printed), env.home());
}

#[test]
fn version_prints_workspace_version() {
    let out = TempHome::new().mewkit(&["--version"]);
    assert!(out.status.success());
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert_eq!(
        stdout.trim(),
        format!("mewkit {}", env!("CARGO_PKG_VERSION"))
    );
}

/// The installer places `mk` and `mewkit-next` beside `mewkit`: a link on Unix, a copy on
/// Windows. `mk` must behave exactly as `mewkit`; `mewkit-next` may only add the rename
/// notice on stderr, so a script or old kit that still calls it keeps parsing stdout.
#[test]
fn mk_and_mewkit_next_run_the_same_binary() {
    let env = TempHome::new();
    let dir = tempfile::tempdir().unwrap();
    let run = |name: &str| {
        let path = dir
            .path()
            .join(format!("{name}{}", std::env::consts::EXE_SUFFIX));
        #[cfg(unix)]
        std::os::unix::fs::symlink(env!("CARGO_BIN_EXE_mewkit"), &path).unwrap();
        #[cfg(not(unix))]
        std::fs::copy(env!("CARGO_BIN_EXE_mewkit"), &path).unwrap();
        env.command(&path).arg("--version").output().unwrap()
    };
    let canonical = env.mewkit(&["--version"]);
    let mk = run("mk");
    assert_eq!(mk.status.code(), Some(0));
    assert_eq!(mk.stdout, canonical.stdout);
    assert_eq!(mk.stderr, canonical.stderr);

    let next = run("mewkit-next");
    assert_eq!(next.status.code(), Some(0));
    assert_eq!(next.stdout, canonical.stdout);
    assert_eq!(
        String::from_utf8_lossy(&next.stderr).trim(),
        r#"mewkit-next is now mewkit; run "mewkit" (or "mk")"#
    );
}

#[test]
fn help_succeeds() {
    let out = TempHome::new().mewkit(&["--help"]);
    assert!(out.status.success());
    assert!(String::from_utf8_lossy(&out.stdout).contains("npm `mewkit` package"));
}

/// The example verb has to be one this binary does NOT implement. It named
/// `plan`, then `review`, then `capabilities` as each was ported; once every
/// npm verb is ported, no real verb is left, so it names one that neither CLI
/// has. This stays the only check that a verb this binary lacks points the user
/// at the npm CLI, until cutover retires that CLI and this wording with it.
#[test]
fn unknown_command_exits_2_and_names_the_npm_cli() {
    let out = TempHome::new().mewkit(&["no-such-verb", "--json"]);
    assert_eq!(out.status.code(), Some(2));
    let stderr = String::from_utf8_lossy(&out.stderr);
    assert!(
        stderr.contains("unknown command 'no-such-verb'"),
        "stderr: {stderr}"
    );
    assert!(stderr.contains("npm `mewkit` CLI"), "stderr: {stderr}");
}

/// The npm CLI parses with minimist, which keeps an undeclared flag or a stray
/// word as data that `orient` never reads. Hooks and skills were written against
/// that, so the port tolerates the same invocations instead of failing them.
#[test]
fn an_unknown_flag_or_a_stray_positional_is_ignored_like_the_npm_cli() {
    for args in [
        vec!["orient", "--no-recrd", "--no-record"],
        vec!["orient", "--json=yes", "--no-record"],
        vec!["orient", "stray", "--no-record"],
    ] {
        let out = TempHome::new().mewkit(&args);
        assert_eq!(out.status.code(), Some(0), "args {args:?}");
        assert!(!out.stdout.is_empty(), "args {args:?} must still orient");
    }
}

/// Bare `orient` records the advisory measurement, as its help says; this is
/// a deliberate change from the npm CLI, which recorded only on `--record`.
#[test]
fn bare_orient_records_and_no_record_does_not() {
    let trace = ".meowkit/telemetry/trace-log.jsonl";
    let env = TempHome::new();
    assert_eq!(
        env.mewkit(&["orient", "--no-record"]).status.code(),
        Some(0)
    );
    assert!(
        !env.project().join(trace).exists(),
        "--no-record wrote a trace"
    );
    assert_eq!(env.mewkit(&["orient"]).status.code(), Some(0));
    assert!(
        env.project().join(trace).exists(),
        "bare orient did not record"
    );
}
