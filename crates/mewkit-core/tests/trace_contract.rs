//! The trace writer's constants ARE the hook writer's constants.
//!
//! Two writers append to one log — this crate and the `append-trace` hook
//! (`.claude/hooks/lib/trace-log.cjs`) — so the log name, the lock name, the
//! rotation threshold, the schema version and the provenance defaults are a
//! cross-language contract, not local choices. Asserting a Rust constant
//! against a Rust test literal would compare the crate to itself; this reads
//! the hook's source at test time instead.

use std::path::Path;

use mewkit_core::trace::{TRACE_LOCK_NAME, TRACE_LOG_NAME, TRACE_MAX_BYTES, TRACE_SCHEMA_VERSION};

const HOOK_WRITER: &str = ".claude/hooks/lib/trace-log.cjs";

fn hook_source() -> String {
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join(HOOK_WRITER);
    std::fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("{} could not be read: {e}", path.display()))
}

/// The right-hand side of `const <name> = …;`, trimmed.
fn declared(source: &str, name: &str) -> String {
    let marker = format!("const {name} = ");
    let start = source
        .find(&marker)
        .unwrap_or_else(|| panic!("{name} is no longer declared in {HOOK_WRITER}"));
    let rest = &source[start + marker.len()..];
    // `;` alone, not `;\n`: a Windows checkout may give the source CRLF.
    let end = rest
        .find(';')
        .unwrap_or_else(|| panic!("{name}'s declaration has no `;`"));
    rest[..end].trim().to_string()
}

/// A JavaScript single-quoted string literal as Rust's `{:?}` would print it.
fn js_quoted(value: &str) -> String {
    format!("'{value}'")
}

#[test]
fn the_log_name_lock_name_and_schema_version_match_the_hook() {
    let hook = hook_source();
    assert_eq!(
        declared(&hook, "SCHEMA_VERSION"),
        js_quoted(TRACE_SCHEMA_VERSION),
        "the schema version drifted from {HOOK_WRITER}"
    );
    for name in [TRACE_LOG_NAME, TRACE_LOCK_NAME] {
        assert!(
            hook.contains(&js_quoted(name)),
            "{HOOK_WRITER} no longer writes {name:?}"
        );
    }
}

/// The NUMBER is the contract; `50 * 1024 * 1024` is just how one side spells it.
#[test]
fn the_rotation_threshold_matches_the_hook() {
    let spelled = declared(&hook_source(), "MAX_BYTES");
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

/// A record whose `harness_version` default drifted would be read as a
/// different harness generation by anything querying the log.
#[test]
fn the_shared_provenance_env_names_and_defaults_match_the_hook() {
    let hook = hook_source();
    assert_eq!(
        declared(&hook, "DEFAULT_HARNESS_VERSION"),
        js_quoted("3.0.0")
    );
    for read in [
        "env.MEOWKIT_RUN_ID",
        "env.MEOWKIT_HARNESS_VERSION || DEFAULT_HARNESS_VERSION",
        "env.MEOWKIT_AUTOBUILD_MODE || ''",
    ] {
        assert!(
            hook.contains(read),
            "{HOOK_WRITER} no longer reads {read} — the Rust writer's \
             fallbacks in src/trace.rs must change with it"
        );
    }
}
