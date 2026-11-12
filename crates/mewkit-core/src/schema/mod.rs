//! Serde ports of the npm CLI's zod schemas.
//!
//! Every type here is the Rust half of a contract the npm CLI already writes to
//! disk, so three zod behaviours are reproduced deliberately rather than
//! approximated:
//!
//! - `.passthrough()` → a flattened [`Extra`] map, so an unknown additive field
//!   survives a read→write round-trip instead of being silently dropped by an
//!   older binary.
//! - `.strict()` → `#[serde(deny_unknown_fields)]`, where an unknown key is a
//!   refusal because the schema's guarantee depends on every field being seen.
//! - plain `z.object()` → serde's default, which ignores unknown keys the way
//!   zod strips them.
//!
//! Field-level rules zod expresses inline (`min(1)`, `regex`, `literal`,
//! `positive`, `max`) are NOT expressible in a serde derive, so each schema
//! carries an explicit `validate` that reports every problem at once — the same
//! shape the TS validators return, so a caller sees one complete refusal rather
//! than the first field that happened to fail.
//!
//! ## What is ported, and what is not
//!
//! Twenty TypeScript files define a zod schema. Twelve are ported here (several
//! to more than one Rust module: a dossier needs a type, a renderer and a
//! reader); one is ported as validation only; seven are deferred, each for a
//! reason that names the phase that needs it.
//!
//! | TypeScript source | Rust |
//! | --- | --- |
//! | `core/task-record.ts` | [`task_record`], [`active_task_pointer`] |
//! | `core/capability.ts` | [`capability`], [`capability_entry`] |
//! | `core/repo-context.ts` | [`context_envelope`] |
//! | `core/athena-supervision-dossier.ts` | [`dossier`], [`dossier_doc`], [`dossier_parse`] |
//! | `core/athena-supervision-packet.ts` | [`supervision_packet`], [`supervision_output`], [`supervision_scan`] |
//! | `core/athena-supervision-protocol.ts` | [`supervision_protocol`] |
//! | `core/athena-supervision-receipt.ts` | [`supervision_receipt`] |
//! | `core/athena-strategy-brief.ts` | [`strategy_brief`] |
//! | `core/install-metadata.ts` | [`install_metadata`], [`install_metadata_read`] |
//! | `core/hook-runtime.ts` | [`runtime_descriptor`] |
//! | `review/schema.ts` | [`review_manifest`], [`review_session`] |
//! | `review/verdict-schema.ts` | [`verdict`], [`review_findings`] |
//! | `review/roster.ts` | [`roster`] |
//! | `config/schema.ts` | validation only, as `config::shape_check`; the zod JSON-Schema builders are not ported |
//!
//! Deferred, with the real reason:
//!
//! | TypeScript source | Why it is not here yet |
//! | --- | --- |
//! | `core/release-metadata.ts` | the release feed the updater reads; `kit::` owns that path and types it where it is used |
//! | `migrate/types.ts` | the migrate verb was deleted in phase 1, so nothing reads it |
//! | `migrate/modules/artifact-manifest-schema.ts` | same — a migrate-only manifest with no remaining reader |
//! | `migrate/reconcile/portable-manifest.ts` | reconcile is maintainer tooling, out of the CLI surface the port covers |
//! | `migrate/reconcile/portable-registry.ts` | same |
//! | `migrate/modules/codex-skill-packs.ts` | NOT migrate-only: `init`, `emit` and `doctor` all read it. It is adapter-BUNDLE data, owned by `mewkit-adapters`, and is typed there in phase 5 |
//! | `migrate/modules/cursor-mcp-profile-catalog.ts` | same — live in `init`/`emit`/`doctor-cursor-environment`, deferred because the type belongs to `mewkit-adapters`, not because nothing reads it |

pub mod active_task_pointer;
pub mod capability;
pub mod capability_entry;
pub mod context_envelope;
pub mod dossier;
pub mod dossier_doc;
pub mod dossier_parse;
pub mod install_metadata;
pub mod install_metadata_read;
pub mod review_findings;
pub mod review_manifest;
pub mod review_session;
pub mod roster;
pub mod runtime_descriptor;
pub mod strategy_brief;
pub mod supervision_output;
pub mod supervision_packet;
mod supervision_patterns;
pub mod supervision_protocol;
pub mod supervision_receipt;
pub mod supervision_scan;
pub mod task_record;
pub mod verdict;

/// Unknown keys a `.passthrough()` schema preserves through a read→write
/// round-trip. `serde_json::Map` (built with `preserve_order`) keeps them in the
/// order they were read, so a round-trip is byte-stable for an [`Extra`] map.
///
/// It is NOT byte-stable for every modelled field: a `BTreeMap` field such as
/// `CapabilityEntry::support` sorts its keys, where the TypeScript preserves
/// insertion order. A read→write of a manifest therefore reorders the providers
/// inside those two maps. Sorted is deterministic, which is the property that
/// matters for a diff; it is simply not the same bytes the npm CLI wrote.
pub type Extra = serde_json::Map<String, serde_json::Value>;

/// The outcome of an explicit validation pass. Carries EVERY problem, not the
/// first: a caller fixing a refused record should need one round-trip.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Validation {
    pub ok: bool,
    pub errors: Vec<String>,
}

impl Validation {
    /// `ok` is derived from the error list so the two can never disagree.
    pub fn new(errors: Vec<String>) -> Self {
        Self {
            ok: errors.is_empty(),
            errors,
        }
    }
}

/// `JSON.stringify(value)` for a string, so an error message quoting a bad
/// value reads exactly like the TS one it replaces.
pub fn quote(value: &str) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| format!("\"{value}\""))
}

/// Deserialize, then run the schema's explicit `validate`: the two halves of
/// what one `zod` `.parse()` call does. Every problem is reported at once.
pub fn parse_with<T, F>(value: &serde_json::Value, validate: F) -> Result<T, Vec<String>>
where
    T: for<'de> serde::Deserialize<'de>,
    F: Fn(&T) -> Validation,
{
    let parsed: T = serde_json::from_value(value.clone()).map_err(|e| vec![e.to_string()])?;
    let checked = validate(&parsed);
    if checked.ok {
        Ok(parsed)
    } else {
        Err(checked.errors)
    }
}

/// Push `label must not be empty` when a `z.string().min(1)` field is blank.
pub fn require_non_empty(label: &str, value: &str, errors: &mut Vec<String>) {
    if value.is_empty() {
        errors.push(format!("{label}: must not be empty"));
    }
}

/// The keys of a JSON object, or an empty list for any other value. Used by the
/// forbidden-field scans, which run against the RAW candidate: once serde has
/// narrowed the value, an unknown key only reports as "unknown field", and the
/// caller needs to be told it tried to store authority.
pub fn object_keys(candidate: &serde_json::Value) -> Vec<&str> {
    match candidate {
        serde_json::Value::Object(map) => map.keys().map(String::as_str).collect(),
        _ => Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validation_ok_follows_the_error_list() {
        assert!(Validation::new(vec![]).ok);
        assert!(!Validation::new(vec!["x".into()]).ok);
    }

    #[test]
    fn quote_matches_json_stringify() {
        assert_eq!(quote("a/b"), "\"a/b\"");
        assert_eq!(quote("say \"hi\""), "\"say \\\"hi\\\"\"");
    }

    #[test]
    fn object_keys_reads_only_objects() {
        let v = serde_json::json!({ "a": 1, "b": 2 });
        assert_eq!(object_keys(&v), vec!["a", "b"]);
        assert!(object_keys(&serde_json::json!([1, 2])).is_empty());
    }
}
