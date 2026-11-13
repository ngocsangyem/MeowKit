//! `setup` against both CLIs.
//!
//! The environment step starts Python and pip, so its cases put a fixture's
//! `stub-bin/` first on PATH, the same way `skill_env_cases.rs` does (see there
//! for how the stubs work); those cases are Unix-only because the stubs are shell
//! scripts.
//!
//! ## What is NOT compared with the npm CLI, and why
//!
//! `setup --system-deps` asks a yes/no question. Without a usable terminal the
//! npm CLI does not answer it: on macOS it dies in its prompt library with
//! `TTY initialization failed` (the result depends on the platform and on how
//! stdin is attached), and it has no flag that answers the question at all. The
//! Rust CLI adds `--yes`, and without a terminal and without it exits non-zero
//! naming the flag. Those two behaviours are pinned against the Rust CLI alone,
//! below; the `--dry-run` form, which asks nothing, is compared.
#[cfg(unix)]
use super::skill_env_cases::stubbed_path;
use crate::parity;

#[test]
#[ignore = "needs node and the TS build"]
fn a_dry_run_lists_every_change_and_writes_nothing() {
    let Some((ts, _)) = parity::case("setup-dry-run")
        .args(&["setup", "--dry-run"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout.contains("would create .mcp.json"),
        "{}",
        ts.describe()
    );

    let Some((ts, _)) = parity::case("setup-dry-run-json")
        .args(&["setup", "--dry-run", "--json"])
        .run()
    else {
        return;
    };
    assert!(ts.stdout.contains("\"dryRun\": true"), "{}", ts.describe());
    assert!(ts.stdout.contains("\"applied\": []"), "{}", ts.describe());
    // Narration moves to stderr so stdout is the envelope alone.
    assert!(ts.stderr.contains("Summary:"), "{}", ts.describe());
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_real_run_writes_the_default_files() {
    let Some((ts, _)) = parity::case("setup-empty-project")
        .args(&["setup"])
        .writes(&[
            ".mcp.json",
            ".meowkit/.env",
            ".meowkit/.gitignore",
            ".gitignore",
        ])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout.contains("3 configured, 1 skipped, 1 warnings"),
        "{}",
        ts.describe()
    );

    let Some((ts, _)) = parity::case("setup-json-envelope")
        .args(&["setup", "--json"])
        .writes(&[".mcp.json"])
        .run()
    else {
        return;
    };
    assert!(ts.stdout.contains("\"ok\": true"), "{}", ts.describe());
}

#[test]
#[ignore = "needs node and the TS build"]
fn the_shipped_templates_are_preferred_over_the_built_in_defaults() {
    let Some((ts, _)) = parity::case("setup-templates")
        .fixture("setup-templates")
        .args(&["setup"])
        .writes(&[".mcp.json", ".gitignore"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout.contains("did copy .mcp.json"),
        "{}",
        ts.describe()
    );
    assert!(
        ts.stdout.contains(".claude/.env already exists")
            || ts.stdout.contains(".claude\\.env already exists")
    );
    assert!(ts.stdout.contains("generate"), "{}", ts.describe());
}

#[test]
#[ignore = "needs node and the TS build"]
fn one_step_runs_alone_and_an_unknown_step_is_refused() {
    for (name, step) in [
        ("setup-only-mcp", "mcp"),
        ("setup-only-env", "env"),
        ("setup-only-gitignore", "gitignore"),
        ("setup-only-project-context", "project-context"),
        ("setup-only-skill-envs", "skill-envs"),
    ] {
        let Some((ts, _)) = parity::case(name).args(&["setup", "--only", step]).run() else {
            return;
        };
        assert_eq!(ts.code, 0, "{}", ts.describe());
        assert!(
            ts.stdout.contains(&format!(" {step}: ")),
            "{}",
            ts.describe()
        );
    }

    let Some((ts, _)) = parity::case("setup-only-unknown")
        .args(&["setup", "--only", "bogus"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr.contains(
            "Unknown step: bogus. Available: skill-envs, mcp, env, gitignore, project-context"
        ),
        "{}",
        ts.describe()
    );

    // With --json the refusal still arrives as one parseable envelope.
    let Some((ts, _)) = parity::case("setup-only-unknown-json")
        .args(&["setup", "--only", "bogus", "--json"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stdout.contains("\"fix\": \"Pass one of:"),
        "{}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_configured_project_is_skipped_and_stale_ignore_lines_are_removed() {
    let Some((ts, _)) = parity::case("setup-configured")
        .fixture("setup-configured")
        .args(&["setup"])
        .writes(&[".gitignore"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    for needle in [
        "Removed the stale .meowkit/memory/ ignore",
        "Removed 3 .meowkit/ line(s) now covered by .meowkit/.gitignore",
        "docs/project-context.md already exists",
    ] {
        assert!(ts.stdout.contains(needle), "{needle}\n{}", ts.describe());
    }

    let Some((_, _)) = parity::case("setup-configured-dry-run")
        .fixture("setup-configured")
        .args(&["setup", "--only", "gitignore", "--dry-run"])
        .run()
    else {
        return;
    };
}

#[test]
#[ignore = "needs node and the TS build"]
fn system_deps_in_a_dry_run_install_nothing() {
    let Some((ts, _)) = parity::case("setup-system-deps-dry-run")
        .args(&["setup", "--system-deps", "--dry-run"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(ts.stdout.contains("nothing was run"), "{}", ts.describe());

    let Some((ts, _)) = parity::case("setup-system-deps-dry-run-json")
        .args(&["setup", "--system-deps", "--dry-run", "--json"])
        .run()
    else {
        return;
    };
    assert!(
        ts.stdout.contains("\"command\": \"setup\""),
        "{}",
        ts.describe()
    );
}

#[cfg(unix)]
#[test]
#[ignore = "needs node and the TS build"]
fn named_skills_get_their_environment_and_nothing_else() {
    let Some((ts, _)) = parity::case("setup-skills-create")
        .fixture("skill-env-py")
        .env("PATH", &stubbed_path())
        .args(&["setup", "--only", "skill-envs", "--skills", "alpha,stdlib"])
        .writes(&["calls.log", ".meowkit/envs/alpha/installed"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout
            .contains("created alpha, stdlib; installed alpha (2)"),
        "{}",
        ts.describe()
    );

    // The same plan, previewed: the environments and the pins are reported, the
    // stubs are never started.
    let Some((ts, _)) = parity::case("setup-skills-dry-run")
        .fixture("skill-env-py")
        .env("PATH", &stubbed_path())
        .args(&[
            "setup",
            "--only",
            "skill-envs",
            "--skills",
            "alpha",
            "--dry-run",
        ])
        .run()
    else {
        return;
    };
    assert!(ts.stdout.contains("would install"), "{}", ts.describe());

    let Some((ts, _)) = parity::case("setup-skills-json")
        .fixture("skill-env-py")
        .env("PATH", &stubbed_path())
        .args(&["setup", "--skills", "pinonly", "--json"])
        .writes(&[".meowkit/envs/pinonly/installed", ".mcp.json"])
        .run()
    else {
        return;
    };
    assert!(
        ts.stdout.contains("\"action\": \"install\""),
        "{}",
        ts.describe()
    );
}

#[cfg(unix)]
#[test]
#[ignore = "needs node and the TS build"]
fn skills_that_cannot_be_set_up_are_reported_per_step() {
    for (name, skills, code, needle) in [
        (
            "setup-skills-unknown",
            "ghost",
            1,
            "Not a skill that needs an environment: ghost. Eligible: alpha, badpin, failpin, pinonly, stdlib, vfail",
        ),
        (
            "setup-skills-rejected-pin",
            "badpin",
            1,
            "rejected requirement line(s): -r evil.txt, git+https://example.invalid/x.git",
        ),
        (
            "setup-skills-pip-fails",
            "failpin",
            0,
            "failpin: 1 of 1 package(s) failed",
        ),
        (
            "setup-skills-venv-fails",
            "vfail",
            1,
            "vfail: Command failed: python3 -m venv",
        ),
    ] {
        let Some((ts, _)) = parity::case(name)
            .fixture("skill-env-py")
            .env("PATH", &stubbed_path())
            .args(&["setup", "--only", "skill-envs", "--skills", skills])
            .run()
        else {
            return;
        };
        assert_eq!(ts.code, code, "{}", ts.describe());
        assert!(ts.stdout.contains(needle), "{needle}\n{}", ts.describe());
    }
}

#[cfg(unix)]
#[test]
#[ignore = "needs node and the TS build"]
fn an_environment_that_is_already_set_up_is_skipped_and_a_missing_interpreter_skips_the_step() {
    let Some((ts, _)) = parity::case("setup-skills-already-configured")
        .fixture("skill-env-ready")
        .env("PATH", &stubbed_path())
        .args(&["setup", "--only", "skill-envs", "--skills", "alpha"])
        .run()
    else {
        return;
    };
    assert!(
        ts.stdout.contains("Already configured: alpha"),
        "{}",
        ts.describe()
    );

    let Some((ts, _)) = parity::case("setup-skills-no-python")
        .fixture("skill-env-nopython")
        .env("PATH", &stubbed_path())
        .args(&["setup", "--only", "skill-envs", "--skills", "alpha"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout.contains("No Python interpreter in PATH"),
        "{}",
        ts.describe()
    );
}

/// Rust-only: the two behaviours the npm CLI cannot be compared on.
#[cfg(unix)]
mod system_deps_flow {
    use crate::parity;

    fn run(args: &[&str]) -> (parity::Run, std::path::PathBuf, tempfile::TempDir) {
        let scratch = tempfile::tempdir().expect("a scratch dir");
        let project = scratch.path().join("project");
        let home = scratch.path().join("home");
        std::fs::create_dir_all(&home).unwrap();
        parity::copy_fixture("setup-system-deps", &project);
        let env = [("PATH".to_string(), super::stubbed_path())];
        let run = parity::run_rust(&project, &home, args, &env, None);
        (run, project, scratch)
    }

    #[test]
    fn without_a_terminal_and_without_yes_the_run_stops_and_names_the_flag() {
        let (run, project, _keep) = run(&["setup", "--system-deps"]);
        assert_ne!(run.code, 0, "{}", run.describe());
        assert!(run.stderr.contains("--yes"), "{}", run.describe());
        assert!(
            !project.join("calls.log").exists(),
            "nothing may be installed"
        );
    }

    #[test]
    fn yes_installs_what_is_missing_through_the_package_manager() {
        let (run, project, _keep) = run(&["setup", "--system-deps", "--yes"]);
        assert_eq!(run.code, 0, "{}", run.describe());
        let calls = std::fs::read_to_string(project.join("calls.log")).expect("calls.log");
        let expected: &[&str] = if cfg!(target_os = "macos") {
            &[
                "brew install ffmpeg",
                "brew install imagemagick",
                "pip install playwright==1.58.0",
                "playwright install chromium",
            ]
        } else {
            &[
                "sudo apt-get install -y ffmpeg",
                "sudo apt-get install -y imagemagick",
                "pip install playwright==1.58.0",
                "playwright install chromium",
            ]
        };
        assert_eq!(
            calls.lines().collect::<Vec<_>>(),
            expected,
            "{}",
            run.describe()
        );
        // A skill declaring a key the registry does not know is warned about.
        assert!(
            run.stderr
                .contains("declares unknown system dep \"ghost-dep\""),
            "{}",
            run.describe()
        );
    }
}
