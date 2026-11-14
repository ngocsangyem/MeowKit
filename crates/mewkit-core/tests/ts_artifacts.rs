//! The Rust readers accept what the TypeScript WRITERS emit.
//!
//! Every other schema test builds a hand-written `json!` literal, which proves
//! only that the Rust reader agrees with the Rust test author: a
//! render→parse round trip inside one implementation passes while the on-disk
//! format diverges. These fixtures were produced by running the shipped
//! TypeScript writers — `activateTask`, `writeDossier`, `VerdictSchema.parse` —
//! before that implementation was retired. They are frozen: projects installed
//! by the npm CLI still carry files in exactly this shape, so the Rust readers
//! must keep accepting them.
//!
//! What this catches that nothing else does: a field the TS writes and the Rust
//! does not model, a key spelling that drifted, a renderer whose output the Rust
//! reader cannot parse at all.

use std::fs;
use std::path::{Path, PathBuf};

use mewkit_core::schema::active_task_pointer::ActiveTaskPointer;
use mewkit_core::schema::dossier_parse::{DossierRead, parse_dossier};
use mewkit_core::schema::task_record::TaskRecord;
use mewkit_core::schema::verdict::Verdict;

fn fixture(name: &str) -> String {
    let path: PathBuf = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
        .join(name);
    fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("{} could not be read: {e}", path.display()))
}

fn json(name: &str) -> serde_json::Value {
    serde_json::from_str(&fixture(name)).unwrap_or_else(|e| panic!("{name} is not JSON: {e}"))
}

#[test]
fn a_task_record_written_by_activate_task_reads_back() {
    let value = json("task-record.json");
    let record = TaskRecord::parse(&value).expect("the TypeScript writer's own output");
    assert_eq!(record.task_id, "261112-rust-port-fixture");
    assert_eq!(record.schema_version, "1.0");
    assert_eq!(record.repos.len(), 1);
    assert_eq!(record.repos[0].identity, "/work/meowkit");
    assert_eq!(record.repos[0].revision.as_deref(), Some("6e2dddc4"));
    // Written as `updatedAt` on both sides; a camel-case slip here is exactly
    // what a hand-written literal cannot catch.
    assert_eq!(record.updated_at, "2026-11-12T09:00:00.000Z");
}

#[test]
fn an_active_task_pointer_keeps_the_legacy_mirror_through_a_round_trip() {
    let value = json("active-task-pointer.json");
    let pointer = ActiveTaskPointer::parse(&value).expect("the TypeScript writer's own output");
    assert_eq!(pointer.task_id, "261112-rust-port-fixture");
    let back = serde_json::to_value(&pointer).expect("serializes");
    // `path`/`slug` are the legacy mirror the checkpoint reader still reads.
    // They are not modelled fields; dropping them would blind that reader.
    assert_eq!(back["path"], value["path"]);
    assert_eq!(back["slug"], value["slug"]);
    assert_eq!(back, value, "a read→write round trip changed the pointer");
}

#[test]
fn a_dossier_rendered_by_the_typescript_parses_with_every_field_intact() {
    let text = fixture("dossier.md");
    let DossierRead::Found(dossier) = parse_dossier(&text) else {
        panic!("the TypeScript renderer's own output did not parse");
    };
    assert_eq!(dossier.run_id, "run-261112-090000-abcd");
    assert_eq!(dossier.skill, "mk:cook");
    assert_eq!(dossier.correction_count, 2);
    assert_eq!(
        dossier.locked_decision_pointers,
        vec!["plan.md#locked-decisions".to_string()]
    );
    assert_eq!(
        dossier.latest_directive,
        "port the memory scan before the verbs"
    );
    assert_eq!(dossier.next_safe_action, "run the differential corpus");
    let checkpoint = dossier.checkpoint.as_ref().expect("an open checkpoint");
    assert_eq!(checkpoint.checkpoint_id, "cp-1");
    assert_eq!(checkpoint.partition.as_deref(), Some("phase-2"));
    assert!(!dossier.escalated_to_human);
}

#[test]
fn a_verdict_shaped_by_the_zod_schema_reads_back() {
    let value = json("verdict.json");
    let verdict = Verdict::parse(&value).expect("the TypeScript schema's own output");
    assert_eq!(verdict.slug, "rust-port-mewkit-cli");
    assert_eq!(verdict.dimensions.len(), 2);
    assert_eq!(verdict.dimensions[1].name, "Security");
    assert_eq!(
        verdict.dimensions[1].note.as_deref(),
        Some("scanner parity pinned against Node")
    );
}
