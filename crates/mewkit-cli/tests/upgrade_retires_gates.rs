//! `upgrade` retires the plan-approval hook on every runtime: the registration that
//! reaches it and the file it reaches.
//!
//! The order matters more than either step. `prepare` emits the hook merge,
//! which strips the handler ids a past install recorded and this kit no longer
//! carries, and `drop_retired` appends the file removals after it — so a
//! registration never outlives its script. A registration left behind pointing
//! at a removed script is the dangerous state, because a hook that cannot start
//! exits non-blocking and an unloadable guard reads as permission. Every case
//! below therefore ends by asking `doctor` whether anything now dangles.
//!
//! Five of the six cases are not the happy path: an install with no ownership
//! index, a hand-edited registration file, a user-modified retired file with and
//! without `--force`, and a registration whose file is already gone. Retirement
//! is driven by the ownership index, so each of those changes what `upgrade` can
//! prove, and the expected outcome differs case by case.
mod support;

use support::gate_kit::{GATE_SCRIPT_NAME, GATES};
use support::gate_retire::{
    assert_gate_fully_retired, assert_no_dangling_registration, index_path,
    installed_from_previous_kit, registration_names_the_gate, upgrade_to_current,
};
use support::{code, text};

#[test]
fn an_upgrade_from_the_previous_kit_retires_the_gate_on_every_runtime() {
    for gate in &GATES {
        let env = installed_from_previous_kit(gate);
        let out = upgrade_to_current(&env, &[]);
        assert_eq!(code(&out), 0, "[{}] upgrade: {}", gate.runtime, text(&out));
        assert_gate_fully_retired(&env, gate);
    }
}

/// With no ownership index there is no record of what the kit installed, so
/// `upgrade` has nothing to upgrade and says so. It must not guess: removing a
/// file it cannot prove it wrote is how an installer eats a user's work. The
/// install is left for `init` to take over, which the report names.
#[test]
fn an_install_with_no_ownership_index_is_reported_rather_than_guessed_at() {
    for gate in &GATES {
        let env = installed_from_previous_kit(gate);
        std::fs::remove_file(env.project().join(index_path(gate)))
            .expect("remove the ownership index");

        let out = upgrade_to_current(&env, &[]);
        assert_eq!(code(&out), 0, "[{}] upgrade: {}", gate.runtime, text(&out));
        let shown = text(&out);
        assert!(
            shown.contains("nothing installed here"),
            "[{}] an index-less install must be reported, not retired silently: {shown}",
            gate.runtime
        );
        assert!(
            shown.contains("mewkit init --target"),
            "[{}] the report must name the command that takes the install over: {shown}",
            gate.runtime
        );
        // Nothing was proved, so nothing was removed — and nothing dangles either.
        assert!(env.project().join(gate.installed_file).is_file());
        assert_no_dangling_registration(&env, gate);
    }
}

/// A registration file the user has edited is still merged, not replaced, so the
/// gate handler comes out and the user's own key stays.
#[test]
fn a_hand_edited_registration_keeps_the_users_handler_and_loses_the_gate() {
    for gate in &GATES {
        let env = installed_from_previous_kit(gate);
        let file = env.project().join(gate.installed_registration);
        let mine = std::fs::read_to_string(&file)
            .expect("read the registration")
            .replacen('{', "{\n  \"mineOwnKey\": \"keep me\",", 1);
        std::fs::write(&file, &mine).expect("hand-edit the registration");

        let out = upgrade_to_current(&env, &[]);
        assert_eq!(code(&out), 0, "[{}] upgrade: {}", gate.runtime, text(&out));
        let after = std::fs::read_to_string(&file).expect("read the registration");
        assert!(
            after.contains("mineOwnKey"),
            "[{}] the user's own key was dropped: {after}",
            gate.runtime
        );
        assert_gate_fully_retired(&env, gate);
    }
}

/// A retired file the user edited is KEPT and named, because the bytes no longer
/// match what the kit installed and `upgrade` will not remove what it cannot
/// corroborate. Its registration still goes, so what is left is an inert file
/// rather than a live gate.
///
/// The keeping is permanent as far as `upgrade` is concerned: corroboration
/// reads the kit the install RECORDS, and after this run that is the new kit,
/// which never shipped the path. A later `upgrade --force` therefore reports
/// "ownership is not corroborated" rather than removing it, which is why the
/// forced case below starts from a fresh install instead.
#[test]
fn a_user_modified_retired_file_is_kept_and_its_registration_still_goes() {
    for gate in &GATES {
        let env = installed_from_previous_kit(gate);
        let file = env.project().join(gate.installed_file);
        std::fs::write(&file, "// mine now\n").expect("edit the retired file");

        let out = upgrade_to_current(&env, &[]);
        assert_eq!(code(&out), 6, "[{}] upgrade: {}", gate.runtime, text(&out));
        let shown = text(&out);
        assert!(
            shown.contains(GATE_SCRIPT_NAME) && shown.contains("edited since install"),
            "[{}] a kept file must be named with its reason: {shown}",
            gate.runtime
        );
        assert_eq!(
            std::fs::read_to_string(&file).expect("read the kept file"),
            "// mine now\n",
            "[{}] the user's edit was overwritten",
            gate.runtime
        );
        assert!(
            !registration_names_the_gate(&env.project(), gate),
            "[{}] the registration must go even when the file stays",
            gate.runtime
        );
        assert_no_dangling_registration(&env, gate);
    }
}

/// The same edit, with `--force` on the upgrade that retires the file: the user
/// is overruled on purpose, and the gate goes completely.
#[test]
fn a_forced_upgrade_removes_a_user_modified_retired_file() {
    for gate in &GATES {
        let env = installed_from_previous_kit(gate);
        std::fs::write(env.project().join(gate.installed_file), "// mine now\n")
            .expect("edit the retired file");

        let out = upgrade_to_current(&env, &["--force", "--yes"]);
        assert_eq!(
            code(&out),
            0,
            "[{}] forced upgrade: {}",
            gate.runtime,
            text(&out)
        );
        assert_gate_fully_retired(&env, gate);
    }
}

/// A registration whose script is already gone: the index still owns the path,
/// so the upgrade drops the ownership record and the registration, and reports
/// no removal it did not make.
#[test]
fn a_registration_whose_file_is_already_gone_is_stripped_too() {
    for gate in &GATES {
        let env = installed_from_previous_kit(gate);
        std::fs::remove_file(env.project().join(gate.installed_file))
            .expect("remove the gate hook by hand");
        assert!(registration_names_the_gate(&env.project(), gate));

        let out = upgrade_to_current(&env, &[]);
        assert_eq!(code(&out), 0, "[{}] upgrade: {}", gate.runtime, text(&out));
        assert_gate_fully_retired(&env, gate);
        let index = std::fs::read_to_string(env.project().join(index_path(gate)))
            .expect("read the ownership index");
        assert!(
            !index.contains(GATE_SCRIPT_NAME),
            "[{}] the index still owns a path that is gone: {index}",
            gate.runtime
        );
    }
}
