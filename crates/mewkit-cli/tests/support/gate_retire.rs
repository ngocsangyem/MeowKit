//! Installing from the previous kit, upgrading off it, and the end state every
//! retirement case must reach.
//!
//! Split from the cases themselves so each case reads as the situation it sets
//! up plus the one thing that situation changes.

use std::path::Path;
use std::process::Output;

use super::gate_kit::{GATE_SCRIPT_NAME, GateHook, current_archive, previous_archive};
use super::temp_home::TempHome;
use super::{code, text};

/// A project with `gate.runtime` installed from the kit that still had the gate,
/// proved to carry both the hook file and its registration before a test starts.
pub fn installed_from_previous_kit(gate: &GateHook) -> TempHome {
    let env = TempHome::new();
    let (zip, sha) = previous_archive();
    let zip = zip.to_string_lossy().into_owned();
    let out = env.mewkit(&[
        "init",
        "--target",
        gate.runtime,
        "--kit-archive",
        &zip,
        "--kit-sha256",
        sha,
        "--allow-unverified-kit",
    ]);
    assert_eq!(code(&out), 0, "[{}] init: {}", gate.runtime, text(&out));
    assert!(
        env.project().join(gate.installed_file).is_file(),
        "[{}] the previous kit did not install the gate hook",
        gate.runtime
    );
    assert!(
        registration_names_the_gate(&env.project(), gate),
        "[{}] the previous kit did not register the gate hook",
        gate.runtime
    );
    env
}

/// `upgrade` onto this checkout's kit, plus whatever flags the case adds.
pub fn upgrade_to_current(env: &TempHome, extra: &[&str]) -> Output {
    let (zip, sha) = current_archive();
    let zip = zip.to_string_lossy().into_owned();
    let mut args = vec![
        "upgrade",
        "--kit-archive",
        &zip,
        "--kit-sha256",
        sha,
        "--allow-unverified-kit",
    ];
    args.extend_from_slice(extra);
    env.mewkit(&args)
}

/// The ownership index for one runtime, project-relative.
pub fn index_path(gate: &GateHook) -> String {
    format!(".meowkit/state/ownership/{}.json", gate.runtime)
}

/// True when the runtime's hook file still names the gate script.
pub fn registration_names_the_gate(project: &Path, gate: &GateHook) -> bool {
    std::fs::read_to_string(project.join(gate.installed_registration))
        .is_ok_and(|text| text.contains(GATE_SCRIPT_NAME))
}

/// `doctor` reports a registration whose script is not on disk as
/// `registered but missing`. Nothing may be dangling after a retirement — that
/// is the state the registration-before-file order exists to avoid.
pub fn assert_no_dangling_registration(env: &TempHome, gate: &GateHook) {
    let out = env.mewkit(&["doctor", "--json", "--target", gate.runtime]);
    let shown = text(&out);
    assert!(
        !shown.contains("registered but missing"),
        "[{}] a registration outlived its script: {shown}",
        gate.runtime
    );
}

/// What a completed retirement looks like: no gate file, no gate registration,
/// and nothing dangling.
pub fn assert_gate_fully_retired(env: &TempHome, gate: &GateHook) {
    assert!(
        !env.project().join(gate.installed_file).exists(),
        "[{}] the gate hook file survived the upgrade",
        gate.runtime
    );
    assert!(
        !registration_names_the_gate(&env.project(), gate),
        "[{}] the gate registration survived the upgrade",
        gate.runtime
    );
    assert_no_dangling_registration(env, gate);
}
