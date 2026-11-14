//! `doctor`'s flags and its `provenance` subcommand.
//!
//! `doctor provenance` and `doctor --adopt` are compared line for line: they
//! are self-contained reports about the npm CLI's baseline. The default
//! `doctor` report is NOT comparable — this binary's doctor checks what the
//! kit projects per runtime, the npm CLI's checks its own toolchain — so the
//! diagnostic flags (`--state`, `--providers`, `--report`, `--hard-gates`) add
//! rows to each CLI's OWN report and are checked as such: `--hard-gates`
//! compares which probes pass or fail on both, the rest assert what the Rust
//! report carries.
//!
//! `--providers` reports adapter enforcement (`providers --lifecycle`'s truth)
//! where the npm CLI reports per-surface contract diagnostics from its retired
//! migrate layer; that is a difference kept on purpose.
use std::path::Path;

use crate::npm;

fn doctor(name: &'static str, fixture: &'static str, args: &[&str]) -> (npm::Run, npm::Run) {
    let mut argv = vec!["doctor"];
    argv.extend_from_slice(args);
    npm::case(name).fixture(fixture).args(&argv).run()
}

// ── provenance ────────────────────────────────────────────────────────────

#[test]
fn provenance_counts_each_class_and_names_the_files_on_request() {
    let (ts, _) = doctor("doctor-provenance", "doctor-provenance", &["provenance"]);
    assert_eq!(ts.code, 0, "{}", ts.describe());
    for expected in [
        "verified       2 —",
        "known-modified 12 —",
        "unknown        1 —",
        "No repair is proposed here",
    ] {
        assert!(
            ts.stdout.contains(expected),
            "missing {expected:?}: {}",
            ts.describe()
        );
    }
    let (ts, _) = doctor(
        "doctor-provenance-explain",
        "doctor-provenance",
        &["provenance", "--explain"],
    );
    assert!(
        ts.stdout.contains("…(+2)"),
        "the sample is cut at ten: {}",
        ts.describe()
    );
}

#[test]
fn provenance_of_a_clean_baseline_needs_no_repair() {
    let (ts, _) = doctor(
        "doctor-provenance-clean",
        "doctor-provenance-clean",
        &["provenance"],
    );
    assert!(ts.stdout.contains("No repair needed."), "{}", ts.describe());
}

#[test]
fn provenance_says_what_it_cannot_prove() {
    let (ts, _) = doctor(
        "doctor-provenance-legacy",
        "doctor-provenance-legacy",
        &["provenance"],
    );
    assert!(ts.stdout.contains("NOT provable"), "{}", ts.describe());
    let (ts, _) = doctor("doctor-provenance-bare", "doctor-bare", &["provenance"]);
    assert!(
        ts.stdout.contains("No installed metadata found"),
        "{}",
        ts.describe()
    );
    let (ts, _) = doctor(
        "doctor-provenance-no-project",
        "validate-empty",
        &["provenance"],
    );
    assert!(
        ts.stdout.contains("Project root not found"),
        "{}",
        ts.describe()
    );
}

#[test]
fn a_mistyped_subcommand_is_an_invocation_error() {
    let (ts, _) = doctor("doctor-unknown-sub", "doctor-bare", &["provenence"]);
    assert_eq!(ts.code, 2, "{}", ts.describe());
    assert!(
        ts.stderr.contains("Valid subcommands: provenance"),
        "{}",
        ts.describe()
    );
}

// ── --adopt ───────────────────────────────────────────────────────────────

#[test]
fn adopt_rebuilds_the_baseline_against_the_cache() {
    let (ts, _) = npm::case("doctor-adopt")
        .fixture("doctor-adopt-cache")
        .args(&["doctor", "--adopt"])
        .writes(&[".meowkit/metadata.json"])
        .run();
    assert_eq!(ts.code, 0, "{}", ts.describe());
    // One unchanged, one edited; b.md (not in the kit) and the user-layer note are the
    // user's, and the scratch worktree is outside the kit scope.
    assert!(
        ts.stdout.contains(
            "Adopted 4 file(s) against the cached kit 1.2.3: 1 unchanged, 1 edited, 2 yours."
        ),
        "{}",
        ts.describe()
    );
    let (ts, _) = npm::case("doctor-adopt-json")
        .fixture("doctor-adopt-cache")
        .args(&["doctor", "--adopt", "--json"])
        .writes(&[".meowkit/metadata.json"])
        .run();
    assert!(ts.stdout.contains("\"counts\""), "{}", ts.describe());
}

#[test]
fn adopt_refuses_without_a_trusted_cache_and_writes_nothing() {
    for (name, fixture, expected) in [
        (
            "doctor-adopt-no-cache",
            "doctor-adopt-nocache",
            "the local kit cache is missing",
        ),
        (
            "doctor-adopt-wrong-release",
            "doctor-adopt-mismatch",
            "the cache holds kit 1.2.3 while this install records 9.9.9",
        ),
    ] {
        let (ts, _) = doctor(name, fixture, &["--adopt"]);
        assert_eq!(ts.code, 1, "{name}: {}", ts.describe());
        assert!(ts.stderr.contains(expected), "{name}: {}", ts.describe());
        assert!(
            ts.stderr.contains("Fix: mewkit upgrade"),
            "{name}: {}",
            ts.describe()
        );
    }
    let (ts, _) = doctor(
        "doctor-adopt-refusal-json",
        "doctor-adopt-mismatch",
        &["--adopt", "--json"],
    );
    assert!(ts.stdout.contains("\"ok\": false"), "{}", ts.describe());
}

#[test]
fn adopt_refuses_a_project_the_binary_installed_and_one_that_is_not_a_project() {
    let (ts, rust) = npm::case("doctor-adopt-next")
        .fixture("doctor-adopt-next")
        .args(&["doctor", "--adopt"])
        .ignore_stderr(
            "the npm CLI sent the user to `mewkit-next`; the binary is `mewkit` now, \
             so the refusal names its own verbs",
        )
        .run();
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        rust.stderr.contains("was installed by the mewkit binary")
            && rust.stderr.contains("`mewkit upgrade`")
            && !rust.stderr.contains("mewkit-next"),
        "{}",
        rust.describe()
    );
    let (ts, _) = doctor("doctor-adopt-no-project", "validate-empty", &["--adopt"]);
    assert!(
        ts.stderr.contains("No MeowKit project here."),
        "{}",
        ts.describe()
    );
}

// ── the diagnostic flags, on this binary's own report ─────────────────────

/// Run only the Rust CLI, on a copy of `fixture`.
fn rust_only(fixture: &str, args: &[&str]) -> npm::Run {
    let scratch = tempfile::tempdir().expect("scratch dir");
    let (home, project) = (scratch.path().join("home"), scratch.path().join("project"));
    std::fs::create_dir_all(&home).expect("home");
    std::fs::create_dir_all(&project).expect("project");
    npm::copy_fixture(fixture, &project);
    let mut argv = vec!["doctor"];
    argv.extend_from_slice(args);
    npm::run_rust(&project, &home, &argv, &[], None)
}

#[test]
fn state_adds_the_taxonomy_rows() {
    let run = rust_only("doctor-bare", &["--state", "--target", "claude-code"]);
    assert!(
        run.stdout.contains("Runtime state directory"),
        "{}",
        run.describe()
    );
    assert!(
        run.stdout.contains("Pre-move session state: "),
        "{}",
        run.describe()
    );
    let none = rust_only("validate-empty", &["--state", "--target", "claude-code"]);
    assert!(
        none.stdout
            .contains("State taxonomy: Project root not found"),
        "{}",
        none.describe()
    );
}

#[test]
fn providers_adds_one_row_per_adapted_provider() {
    let run = rust_only(
        "doctor-bare",
        &["--providers", "--target", "claude-code", "--json"],
    );
    for provider in ["claude-code", "claude-plugin", "codex"] {
        assert!(
            run.stdout
                .contains(&format!("Provider adapter: {provider}")),
            "{}",
            run.describe()
        );
    }
}

#[test]
fn report_appends_a_shareable_block_to_text_output_only() {
    let run = rust_only("doctor-bare", &["--report", "--target", "claude-code"]);
    assert!(
        run.stdout
            .contains("--- Report ---\n# MeowKit Doctor Report"),
        "{}",
        run.describe()
    );
    assert!(run.stdout.contains("## Summary:"), "{}", run.describe());
    let json = rust_only(
        "doctor-bare",
        &["--report", "--json", "--target", "claude-code"],
    );
    assert!(
        !json.stdout.contains("Doctor Report"),
        "{}",
        json.describe()
    );
}

#[test]
fn hard_gates_without_a_harness_has_nothing_to_probe() {
    let run = rust_only("doctor-bare", &["--hard-gates", "--target", "claude-code"]);
    assert!(
        run.stdout
            .contains("Hard gates: No .claude/settings.json + hooks/ found"),
        "{}",
        run.describe()
    );
}

/// The npm CLI reported every one of these probes as passing on the shipped
/// hooks, and the hooks have not changed in a way either CLI should notice, so
/// each must still pass here.
#[test]
fn hard_gates_pass_every_probe_the_npm_cli_passed() {
    let scratch = tempfile::tempdir().expect("scratch dir");
    let (home, project) = (scratch.path().join("home"), scratch.path().join("project"));
    for dir in [&home, &project] {
        std::fs::create_dir_all(dir).expect("dir");
    }
    copy_kit(&project);
    let rust = npm::run_rust(
        &project,
        &home,
        &["doctor", "--hard-gates", "--target", "claude-code"],
        &[],
        None,
    );
    let probes = [
        "Gate 1: blocks source write with no plan",
        "Gate 1: blocks source write when the plan is not approved",
        "Gate 1 + contract: allows source write once the plan is approved and the contract is signed",
        "Privacy: blocks .env read",
        "Injection: reports remote-exec Bash",
        "Injection: allows a normal Bash command",
        "Gate 2: blocks a commit with no verdict",
        "Runtime: every configured hook executes cleanly",
        "Runtime: no leftover shell or interpreter hooks",
    ];
    for probe in probes {
        let verdict = rust
            .stdout
            .lines()
            .find(|l| l.contains(probe))
            .map(|l| l.starts_with("ok "));
        assert_eq!(
            verdict,
            Some(true),
            "probe {probe:?} did not pass\n{}",
            rust.describe()
        );
    }
}

/// The repository's own hooks and settings: the harness the probes exercise.
fn copy_kit(project: &Path) {
    let claude = npm::repo_root().join(".claude");
    for rel in ["hooks", "settings.json"] {
        copy(&claude.join(rel), &project.join(".claude").join(rel));
    }
}

fn copy(from: &Path, to: &Path) {
    if from.is_dir() {
        std::fs::create_dir_all(to).expect("dir");
        for entry in std::fs::read_dir(from).expect("read dir").flatten() {
            copy(&entry.path(), &to.join(entry.file_name()));
        }
    } else {
        std::fs::create_dir_all(to.parent().expect("parent")).expect("dir");
        std::fs::copy(from, to).expect("copy");
    }
}
