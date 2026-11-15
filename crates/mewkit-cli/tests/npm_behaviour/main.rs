//! `mewkit` against what the npm CLI did, on the same input.
//!
//! The npm CLI (`packages/mewkit`) was the reference this CLI was ported from.
//! Every case copies a fixture into a temp project, runs `mewkit` in it and
//! compares the exit code, stdout, stderr and the file tree it leaves with the
//! npm CLI's, frozen in `tests/golden/npm/<case-name>.json`. The npm CLI is
//! gone, so those files are the standing record of the behaviour users of the
//! npm CLI were promised: a change that breaks a case either regressed the port
//! or is a deliberate divergence, and the latter belongs in the case as a
//! declared, reasoned allowance rather than in a re-recorded golden.
//!
//! The goldens cannot be regenerated. To change an expectation, edit the JSON
//! by hand and say why in the case or in `tests/golden/DIVERGENCES.md`.
//!
//! ## Running them
//!
//! Plain `cargo test -p mewkit-cli --test npm_behaviour --locked`; no Node and
//! no build step. The hook-contract cases (`hook_contract.rs`, `hook_mirrors/`,
//! `validate_memory_hook_contract.rs`) run the shipped `.cjs` hooks and so need
//! `node` on PATH; they fail, not skip, when it is missing.
//!
//! Unix only. The goldens were recorded on macOS and the npm comparison only
//! ever ran on Linux, so their paths use `/`, their fixtures rely on the
//! executable bit, and the `git`/`gh` stand-ins are shell scripts. None of
//! that holds on Windows, where `tests/cli.rs` and the adapter tests cover
//! the binary instead.
//!
//! ## Writing a case (the whole API)
//!
//! ```ignore
//! npm::case("orient-json-active-task")         // names the golden file too
//!     .fixture("active-task")                  // tests/npm_behaviour/fixtures/<name>/
//!     .args(&["orient", "--json"])             // argv after the program
//!     .env("MEOWKIT_RUN_ID", "fixed-run")      // optional
//!     .stdin("## entry\n")                     // optional
//!     .writes(&[".meowkit/telemetry/trace-log.jsonl"]) // optional: a write case
//!     .run();                                  // asserts, or panics with a diff
//! ```
//!
//! The case name must be unique and have a golden file of the same name.
//! `run()` returns the recorded npm run and the live one, so a case can add an
//! assertion of its own — use that to pin what the case is ABOUT, because two
//! runs that both produce nothing agree. `.writes(paths)` is the same guard for
//! the file tree.
//!
//! A difference that is REAL and justified is declared on the case with a
//! reason, never allowed globally: `.redact(pattern, replacement, why)` for a
//! value the two engines cannot agree on (a parser's own error wording), and
//! `.ignore_stdout(why)` / `.ignore_stderr(why)` for a stream this CLI
//! deliberately renders itself (clap's help). A declared redaction that never
//! matches is itself a failure, so an allowance cannot outlive the difference
//! it was written for.
#![cfg(unix)]
mod advice_cases;
mod argv_table;
mod backups_cases;
mod budget_cases;
mod capabilities_cases;
mod doctor_cases;
mod harness;
mod hook_contract;
mod hook_mirrors;
mod init_cases;
mod note_cases;
mod orient_cases;
mod orient_flag_cases;
mod pack_cases;
mod plan_archive_cases;
mod plan_check_cases;
mod plan_invocation_cases;
mod plan_status_cases;
mod review_cases;
mod setup_cases;
mod skill_env_cases;
mod task_cases;
mod task_state_cases;
mod trace_cases;
mod validate_authoring_cases;
mod validate_default_cases;
mod validate_memory_cases;
mod validate_memory_hook_contract;
mod validate_repo_cases;
mod validate_scoped_cases;
mod validate_target_cases;
mod validate_usage_cases;

/// The harness, under the name the cases call it by.
pub(crate) use harness as npm;
