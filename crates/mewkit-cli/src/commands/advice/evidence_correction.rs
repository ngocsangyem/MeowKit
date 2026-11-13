//! Advancing the workflow evidence index after a returned correction.
//!
//! Separate from the dossier write on purpose: the dossier records SUPERVISION,
//! the evidence index records the WORKFLOW. A correction that did not name an
//! evidence file simply says so — inventing a path here would fabricate workflow
//! state from a supervision event.
use std::path::Path;

use mewkit_core::advice::evidence::{
    CorrectionKind, apply_correction, current_revision, read_json_file, write_json_atomic,
};
use mewkit_core::advice::paths::{is_inside, real_root, resolve_from};

use super::{AdviceArgs, AdviceError, refuse};

/// The only file a returned correction may write.
///
/// The index is written under several roots — `.claude/`, `.codex/`,
/// `.meowkit/state/`, `tasks/plans/<plan>/reports/evidence/` — but always under
/// this name, so the NAME is what identifies it rather than any one path.
const EVIDENCE_INDEX_FILENAME: &str = "workflow-evidence.json";

pub(super) fn apply(project_root: &Path, args: &AdviceArgs) -> Result<(), AdviceError> {
    let kind = match args.correction_kind.as_deref().unwrap_or("source") {
        "source" => CorrectionKind::Source,
        "scope" => CorrectionKind::Scope,
        other => {
            return Err(refuse(format!(
                "--correction-kind must be source|scope, got {other}."
            )));
        }
    };
    let Some(evidence) = args.evidence.as_deref() else {
        println!(
            "  no --evidence path given: downstream evidence was NOT marked superseded.\n\
             \x20 re-run Verify and review before any gate, or pass --evidence <workflow-evidence.json>."
        );
        return Ok(());
    };

    // Resolve symlinks BEFORE deciding anything about the path. Normalising
    // text does not follow links, so checking the literal argument answers a
    // question about the caller's string rather than about the file that will
    // actually be opened — and the read below follows links at the OS level. A
    // symlink named `workflow-evidence.json` placed anywhere in the repo and
    // pointing outside it satisfied every textual check, and its contents were
    // merged into the correction and written back inside the repo.
    let absolute = resolve_from(project_root, evidence);
    let Ok(real) = std::fs::canonicalize(&absolute) else {
        // `--evidence` must name an index that already exists — a correction
        // supersedes recorded evidence and never creates it — so an unresolvable
        // path is simply absent.
        return Err(refuse(format!(
            "Cannot apply correction: evidence file not found: {evidence}"
        )));
    };

    // Stay inside the project: `--evidence` reaches a WRITE, and the value is
    // supplied by whatever assembled the checkpoint call.
    let root = real_root(project_root);
    if !is_inside(&root, &real) {
        return Err(refuse(format!(
            "Refused: --evidence must stay inside the project ({evidence} resolves to {}, outside {}).",
            real.display(),
            root.display()
        )));
    }

    // Inside the project is not narrow enough. A correction spreads whatever
    // JSON object it reads and writes it back, so any JSON file in the repo was
    // a legal write target. Pointed at another owner's approved artifact that
    // carries its own top-level `review.status`, a correction flipped that
    // status to "superseded" and broke the artifact against its own pinned hash.
    let name = real
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    if name != EVIDENCE_INDEX_FILENAME {
        return Err(refuse(format!(
            "Refused: --evidence must name a {EVIDENCE_INDEX_FILENAME} (got {name}).\n\
             \x20 A correction supersedes workflow evidence; it does not write any other artifact."
        )));
    }

    let loaded =
        read_json_file(&real).map_err(|why| refuse(format!("Cannot apply correction: {why}")))?;
    let updated = apply_correction(&loaded, kind);
    write_json_atomic(&real, &updated).map_err(|e| AdviceError::Hard(e.to_string()))?;
    let scope_note = if kind == CorrectionKind::Scope {
        "; Gate 1 returned to required (scope changed)"
    } else {
        ""
    };
    println!(
        "  evidence revision → {}; verification and review marked superseded{scope_note}.",
        current_revision(&updated)
    );
    println!("  re-run the normal checks; superseded evidence cannot satisfy a later gate.");
    Ok(())
}
