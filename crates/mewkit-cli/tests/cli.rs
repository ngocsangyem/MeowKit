//! End-to-end checks of the `mewkit-next` binary's entry surface.
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
    let out = TempHome::new().mewkit_next(&["--version"]);
    assert!(out.status.success());
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert_eq!(
        stdout.trim(),
        format!("mewkit-next {}", env!("CARGO_PKG_VERSION"))
    );
}

#[test]
fn help_succeeds() {
    let out = TempHome::new().mewkit_next(&["--help"]);
    assert!(out.status.success());
    assert!(String::from_utf8_lossy(&out.stdout).contains("npm `mewkit` CLI"));
}

#[test]
fn unknown_command_exits_2_and_names_the_npm_cli() {
    let out = TempHome::new().mewkit_next(&["plan", "--json"]);
    assert_eq!(out.status.code(), Some(2));
    let stderr = String::from_utf8_lossy(&out.stderr);
    assert!(
        stderr.contains("unknown command 'plan'"),
        "stderr: {stderr}"
    );
    assert!(stderr.contains("npm `mewkit` CLI"), "stderr: {stderr}");
}
