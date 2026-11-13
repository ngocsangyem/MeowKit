//! TS-vs-Rust parity: the same command, the same fixture, two CLIs.
//!
//! Every case copies a fixture into two temp projects, runs
//! `node packages/mewkit/dist/index.js <args>` in one and `mewkit-next` in the
//! other, and compares the exit code, stdout, stderr and the file tree each one
//! left behind. A port is "done" when its cases pass — not when its unit tests
//! do, because a unit test asserts what the porter BELIEVES the npm CLI does.
//!
//! ## Running them
//!
//! Every case is `#[ignore]`d, so the ordinary Rust CI leg stays independent of
//! Node and of a TypeScript build:
//!
//! ```text
//! npm run build                                      # once, for dist/index.js
//! cargo test -p mewkit-cli --test parity --locked -- --include-ignored
//! ```
//!
//! Under `--include-ignored` a missing prerequisite FAILS with a message naming
//! it, rather than printing a notice `cargo test` swallows. Set
//! `MEWKIT_SKIP_NODE_PARITY=1` to opt out deliberately — the same opt-out
//! `crates/mewkit-core/tests/reader_agreement.rs` uses.
//!
//! ## Writing a case (the whole API)
//!
//! ```ignore
//! parity::case("orient-json-active-task")      // the name in the failure message
//!     .fixture("active-task")                  // tests/parity/fixtures/<name>/
//!     .args(&["orient", "--json"])             // argv after the program
//!     .env("MEOWKIT_RUN_ID", "fixed-run")      // optional, applied to both CLIs
//!     .stdin("## entry\n")                     // optional: piped to both CLIs
//!     .writes(&[".meowkit/telemetry/trace-log.jsonl"]) // optional: a write case
//!     .run();                                  // asserts, or panics with a diff
//! ```
//!
//! `run()` hands back both runs, so a case can add an assertion of its own —
//! use that to pin what the case is ABOUT, because two CLIs that both produce
//! nothing agree. `.writes(paths)` is the same guard for the file tree.
//!
//! A difference that is REAL and justified is declared on the case with a
//! reason, never allowed globally: `.redact(pattern, replacement, why)` for a
//! value neither engine can agree on (a parser's own error wording), and
//! `.ignore_stdout(why)` / `.ignore_stderr(why)` for a stream a Rust CLI
//! deliberately renders itself (clap's help). A declared redaction that never
//! matches is itself a failure, so an allowance cannot outlive the difference
//! it was written for.
mod advice_cases;
mod argv_table;
mod budget_cases;
mod harness;
mod hook_contract;
mod note_cases;
mod orient_cases;
mod orient_flag_cases;
mod plan_approve_cases;
mod plan_archive_cases;
mod plan_check_cases;
mod plan_invocation_cases;
mod plan_receipt_consumer;
mod plan_status_cases;
mod review_cases;
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
mod verdict_gate_cases;

/// The harness, under the name the cases call it by.
pub(crate) use harness as parity;
