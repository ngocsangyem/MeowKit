//! The project config surface: one declaration, used for validation of a parsed
//! config.
//!
//! It does NOT generate the published JSON Schema that the config's own
//! `$schema` line points at. `buildConfigSchema`/`nestedShape` — the zod
//! builders the TypeScript emits `config-v1.json` from — are not ported, and no
//! Rust emitter exists; [`SCHEMA_URL`] below is the URL the stub writes, not a
//! promise that this crate produces the document. Which crate publishes
//! `config-v1.json` after cutover is a phase 7 decision. [`super::shape_check`]
//! is the validation half that the zod builders also provided.
//!
//! Observer toggles are not written out here. They are derived from the handler
//! registry, so an observer cannot exist without a toggle and a toggle cannot
//! name a handler that does not exist. The consequence is that the key table is
//! built per project rather than being a constant.
//!
//! What is deliberately absent matters as much as what is present. There is no
//! `gates.*` and no `paths.*` key, at any scope: a configurable workflow path
//! would move writes out of the rules Gate 1 keys off, and a gate is not a
//! preference. An unknown key is a loud error rather than a silently ignored
//! one.
//!
//! This module owns what a config may NOT say — the refused namespaces, the
//! protected hooks, the state-only keys, the user-scope hatch. The KEYS it may
//! set, and their types, live in [`super::key_surface`] and are re-exported
//! here so a caller still has one import.

/// Where the published JSON Schema lives, for the config's own `$schema` line.
pub const SCHEMA_URL: &str = "https://meowkit.dev/schemas/config-v1.json";

/// Namespaces that are rejected by name rather than merely being unknown.
pub const FORBIDDEN_NAMESPACES: &[(&str, &str)] = &[
    (
        "gates",
        "gate behaviour is not configurable from any file, at any scope",
    ),
    (
        "paths",
        "a configurable workflow path would move writes out of the gate rules that key off it",
    ),
];

/// Hooks that may never be switched off, and why, for the rejection message.
pub const PROTECTED_HOOKS: &[(&str, &str)] = &[
    (
        "gate-enforcement",
        "Gate 1 blocks source writes before the plan is approved",
    ),
    ("privacy-block", "it blocks reads of credential files"),
    (
        "pre-ship",
        "it proves Gate 2 before a commit, push or merge",
    ),
    ("gate2-check", "it is the Gate 2 proof the ship path runs"),
    ("check-careful", "it is a hard-blocking guard"),
    ("check-freeze", "it is a hard-blocking guard"),
    ("check-report-path", "it is a hard-blocking guard"),
];

/// The key that downgrades Gate 1 to a plan-presence check. Legal in the USER
/// file only; the gate reads it through its own single-key reader and never
/// through this table.
pub const USER_SCOPE_ONLY_KEY: &str = "gate1PresenceOnly";

/// Settings that live in session state and may never become config keys, with
/// the reason each one stays out. A committed key here would let a pull request
/// suppress a review step for everyone, which is a different thing from a user
/// opting out on their own machine — so the refusal names the state command
/// rather than reporting an unknown key.
pub const STATE_ONLY_KEYS: &[(&str, &str)] = &[(
    "skip_eng_review",
    "it suppresses the review step that gates shipping, so it is a per-project choice rather than a committed one",
)];

pub use super::key_surface::{
    AUTOBUILD_MODES, KEY_DOC, KeySpec, SCALAR_KEYS, TELEMETRY_MODES, ValueKind, key_doc, known_keys,
};

/// The reason a namespace does not exist, when it is one of the refused ones.
pub fn forbidden_namespace(namespace: &str) -> Option<&'static str> {
    lookup(FORBIDDEN_NAMESPACES, namespace)
}

/// Why a hook cannot be switched off, when it is one of the protected ones.
pub fn protected_hook(name: &str) -> Option<&'static str> {
    lookup(PROTECTED_HOOKS, name)
}

/// Why a key belongs to session state rather than to the config.
pub fn state_only_key(key: &str) -> Option<&'static str> {
    lookup(STATE_ONLY_KEYS, key)
}

pub(super) fn lookup(table: &[(&str, &'static str)], needle: &str) -> Option<&'static str> {
    table
        .iter()
        .find(|(key, _)| *key == needle)
        .map(|(_, value)| *value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn no_gate_and_no_path_is_a_key_at_any_scope() {
        for (key, _) in SCALAR_KEYS {
            assert!(!key.starts_with("gates."), "{key}");
            assert!(!key.starts_with("paths."), "{key}");
        }
        assert!(forbidden_namespace("gates").is_some());
        assert!(forbidden_namespace("paths").is_some());
    }
}
