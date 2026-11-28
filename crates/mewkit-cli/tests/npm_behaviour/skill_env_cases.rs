//! `skill env` against both CLIs.
//!
//! Python and pip are never real here. Each case that would start one puts a
//! fixture's `stub-bin/` FIRST on PATH (as a relative entry, which every process
//! resolves against its own working directory): the stubs answer the presence
//! probe, lay down a venv-shaped directory and append what they were asked to do
//! to `calls.log` in the project, so "what would have run" is part of the
//! compared file tree. The stubs are shell scripts, so those cases are Unix-only.
use crate::npm;

/// PATH with a fixture's `stub-bin/` in front.
#[cfg(unix)]
pub(crate) use super::review_cases::stubbed_path;

const OWN_HELP: &str = "help text is rendered by each CLI's own parser";

#[test]
fn a_missing_or_unknown_sub_verb_is_an_invocation_error() {
    let (ts, _) = npm::case("skill-no-subcommand").args(&["skill"]).run();
    assert_eq!(ts.code, 2, "{}", ts.describe());
    assert!(
        ts.stderr.contains("needs a subcommand"),
        "{}",
        ts.describe()
    );

    let (ts, _) = npm::case("skill-unknown-subcommand")
        .args(&["skill", "bogus"])
        .run();
    assert_eq!(ts.code, 2, "{}", ts.describe());

    // A flag in the sub-verb slot is a flag, so the sub-verb is still missing.
    let (ts, _) = npm::case("skill-flag-only")
        .args(&["skill", "--list"])
        .run();
    assert_eq!(ts.code, 2, "{}", ts.describe());
}

#[test]
fn help_is_answered_without_running_anything() {
    for (name, args) in [
        ("skill-help", vec!["skill", "--help"]),
        ("skill-env-help", vec!["skill", "env", "--help"]),
    ] {
        let (ts, _) = npm::case(name).args(&args).ignore_stdout(OWN_HELP).run();
        assert_eq!(ts.code, 0, "{}", ts.describe());
    }
}

#[test]
fn env_without_a_skill_prints_usage_and_fails() {
    let (ts, _) = npm::case("skill-env-no-skill")
        .args(&["skill", "env"])
        .run();
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stdout.contains("mewkit skill env <skill>"),
        "{}",
        ts.describe()
    );
}

#[test]
fn list_with_nothing_declared_says_so() {
    let (ts, _) = npm::case("skill-env-list-none")
        .args(&["skill", "env", "--list"])
        .run();
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout
            .contains("No skill declares requires_runtime or pins packages."),
        "{}",
        ts.describe()
    );
}

#[test]
fn list_shows_state_pins_and_orphans() {
    let (ts, _) = npm::case("skill-env-list")
        .fixture("skill-env-py")
        .args(&["skill", "env", "--list"])
        .run();
    assert_eq!(ts.code, 0, "{}", ts.describe());
    for needle in [
        "broken",
        "absent",
        "binary only",
        "No longer declared: gone",
    ] {
        assert!(ts.stdout.contains(needle), "{needle}\n{}", ts.describe());
    }
}

#[test]
fn a_skill_that_cannot_have_an_environment_is_refused() {
    for (name, skill, needle) in [
        (
            "skill-env-bad-name",
            "Bad_Name",
            "Not a skill directory name",
        ),
        ("skill-env-no-such-skill", "ghost", "No such skill: ghost"),
        (
            "skill-env-needs-none",
            "plain",
            "so it needs no environment",
        ),
    ] {
        let (ts, _) = npm::case(name)
            .fixture("skill-env-py")
            .args(&["skill", "env", skill])
            .run();
        assert_eq!(ts.code, 1, "{}", ts.describe());
        assert!(ts.stderr.contains(needle), "{needle}\n{}", ts.describe());
    }
}

#[cfg(unix)]
#[test]
fn a_rejected_requirement_line_installs_nothing() {
    let (ts, _) = npm::case("skill-env-bad-pin")
        .fixture("skill-env-py")
        .env("PATH", &stubbed_path())
        .args(&["skill", "env", "badpin"])
        .run();
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr.contains("Rejected 2 requirement line(s)"),
        "{}",
        ts.describe()
    );
}

#[cfg(unix)]
#[test]
fn a_missing_interpreter_is_reported_with_what_the_skill_requires() {
    let (ts, _) = npm::case("skill-env-no-python")
        .fixture("skill-env-nopython")
        .env("PATH", &stubbed_path())
        .args(&["skill", "env", "alpha"])
        .run();
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr.contains("alpha requires python>=3.9"),
        "{}",
        ts.describe()
    );
}

#[cfg(unix)]
#[test]
fn an_environment_is_created_and_only_that_skills_pins_are_installed() {
    let (ts, _) = npm::case("skill-env-create-with-pins")
        .fixture("skill-env-py")
        .env("PATH", &stubbed_path())
        .args(&["skill", "env", "alpha"])
        .writes(&[
            "calls.log",
            ".meowkit/envs/alpha/bin/pip",
            ".meowkit/envs/alpha/installed",
        ])
        .run();
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout.contains("created .meowkit/envs/alpha"),
        "{}",
        ts.describe()
    );
    assert!(
        ts.stdout.contains("2 package(s) installed"),
        "{}",
        ts.describe()
    );
}

#[cfg(unix)]
#[test]
fn a_pinned_binary_skill_without_a_runtime_still_gets_an_environment() {
    let (ts, _) = npm::case("skill-env-pins-only")
        .fixture("skill-env-py")
        .env("PATH", &stubbed_path())
        .args(&["skill", "env", "pinonly"])
        .writes(&[".meowkit/envs/pinonly/installed"])
        .run();
    assert_eq!(ts.code, 0, "{}", ts.describe());
}

#[cfg(unix)]
#[test]
fn a_standard_library_skill_gets_an_empty_environment_and_a_broken_one_is_repaired() {
    let (ts, _) = npm::case("skill-env-stdlib-repair")
        .fixture("skill-env-py")
        .env("PATH", &stubbed_path())
        .args(&["skill", "env", "stdlib"])
        .writes(&[".meowkit/envs/stdlib/bin/python3"])
        .run();
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout.contains("repaired .meowkit/envs/stdlib"),
        "{}",
        ts.describe()
    );
    assert!(
        ts.stdout.contains("standard library only"),
        "{}",
        ts.describe()
    );
}

#[cfg(unix)]
#[test]
fn an_existing_environment_is_reused() {
    let (ts, _) = npm::case("skill-env-already-present")
        .fixture("skill-env-ready")
        .env("PATH", &stubbed_path())
        .args(&["skill", "env", "alpha"])
        .writes(&["calls.log"])
        .run();
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(ts.stdout.contains("already present"), "{}", ts.describe());
}

#[cfg(unix)]
#[test]
fn a_failed_install_and_a_failed_venv_both_exit_one() {
    let (ts, _) = npm::case("skill-env-pip-fails")
        .fixture("skill-env-py")
        .env("PATH", &stubbed_path())
        .args(&["skill", "env", "failpin"])
        .run();
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stdout
            .contains("No matching distribution found for fail-pkg==1"),
        "{}",
        ts.describe()
    );
    assert!(
        ts.stderr.contains("1 of 1 package(s) failed to install."),
        "{}",
        ts.describe()
    );

    let (ts, _) = npm::case("skill-env-venv-fails")
        .fixture("skill-env-py")
        .env("PATH", &stubbed_path())
        .args(&["skill", "env", "vfail"])
        .run();
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr.contains("Command failed: python3 -m venv"),
        "{}",
        ts.describe()
    );
}
