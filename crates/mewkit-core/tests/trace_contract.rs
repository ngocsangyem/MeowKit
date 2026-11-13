//! The trace writer's constants ARE the TypeScript writer's constants.
//!
//! Three writers append to one log — this crate, `core/trace-append.ts`, and the
//! shell hook — so the log name, the lock name, the rotation threshold and the
//! schema version are a cross-language contract, not local choices. Asserting a
//! Rust constant against a Rust test literal would compare the port to itself;
//! this reads the TypeScript at test time instead.
//!
//! The provenance DEFAULTS matter for the same reason, and for one more: the
//! TS-vs-Rust parity harness folds `x.y.z` version strings away before it
//! compares two runs (the two CLIs have separate version lines until cutover),
//! so a drifted `harness_version` default is invisible there. Here it is not.

use mewkit_core::trace::{TRACE_LOCK_NAME, TRACE_LOG_NAME, TRACE_MAX_BYTES, TRACE_SCHEMA_VERSION};

#[path = "support/js_literals.rs"]
mod js_literals;
use js_literals::read_source;

const TRACE_TS: &str = "packages/mewkit/src/core/trace-append.ts";

/// The right-hand side of `export const <name> = …;`, trimmed.
fn exported(source: &str, name: &str) -> String {
    let marker = format!("export const {name} = ");
    let start = source
        .find(&marker)
        .unwrap_or_else(|| panic!("{name} is no longer exported from {TRACE_TS}"));
    let rest = &source[start + marker.len()..];
    let end = rest
        .find(";\n")
        .unwrap_or_else(|| panic!("{name}'s declaration has no `;`"));
    rest[..end].trim().to_string()
}

#[test]
fn the_log_name_lock_name_and_schema_version_match_the_typescript() {
    let ts = read_source(TRACE_TS);
    for (name, rust) in [
        ("TRACE_SCHEMA_VERSION", TRACE_SCHEMA_VERSION),
        ("TRACE_LOG_NAME", TRACE_LOG_NAME),
        ("TRACE_LOCK_NAME", TRACE_LOCK_NAME),
    ] {
        assert_eq!(
            exported(&ts, name),
            format!("{rust:?}"),
            "{name} drifted from {TRACE_TS}"
        );
    }
}

/// The rotation threshold is shared with the shell writer too, so the NUMBER is
/// the contract and `50 * 1024 * 1024` is just how one side spells it.
#[test]
fn the_rotation_threshold_matches_the_typescript() {
    let ts = read_source(TRACE_TS);
    let spelled = exported(&ts, "TRACE_MAX_BYTES");
    let product: u64 = spelled
        .split('*')
        .map(|factor| {
            factor
                .trim()
                .parse::<u64>()
                .unwrap_or_else(|_| panic!("{spelled:?} is no longer a product of literals"))
        })
        .product();
    assert_eq!(product, TRACE_MAX_BYTES, "the 50MB threshold drifted");
}

/// Every provenance field falls back to an environment variable, then to a
/// literal. A record whose `harness_version` default drifted would be read as a
/// different harness generation by anything querying the log.
#[test]
fn the_provenance_env_names_and_defaults_match_the_typescript() {
    let ts = read_source(TRACE_TS);
    for fallback in [
        r#"input.runId ?? process.env["MEOWKIT_RUN_ID"] ?? """#,
        r#"input.harnessVersion ?? process.env["MEOWKIT_HARNESS_VERSION"] ?? "3.0.0""#,
        r#"input.model ?? process.env["MEOWKIT_MODEL_HINT"] ?? """#,
        r#"input.density ?? process.env["MEOWKIT_AUTOBUILD_MODE"] ?? """#,
    ] {
        assert!(
            ts.contains(fallback),
            "{TRACE_TS} no longer reads {fallback} — the Rust writer's \
             fallbacks in src/trace.rs must change with it"
        );
    }
}
