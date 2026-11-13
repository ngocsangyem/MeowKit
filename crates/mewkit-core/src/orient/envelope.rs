//! The safe orientation envelope: a pure projection of durable task state into
//! one of four honest outcomes a fresh session can act on.
//!
//! It NEVER touches the filesystem or git — repo revisions arrive as injected
//! probes — so it is trivially testable and cannot become an existence oracle.
//! Excluding `done` records, surfacing corrupt ones as issues, and refusing to
//! silently pick one of several active records are the honesty guarantees.

use crate::schema::task_record::{TaskRecord, TaskStatus};
use crate::task_store::{ActiveTaskPointerRead, ResumeState, TaskIssue};

pub use super::derived_fields::plan_slug_from_path;
use super::derived_fields::{flatten, matches_legacy_ref, stale_warnings};

pub const ORIENT_ENVELOPE_SCHEMA_VERSION: &str = "1.0";

/// An injected current-revision reading per owning repo, so the builder stays
/// pure.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RepoRevisionProbe {
    pub identity: String,
    pub current_revision: Option<String>,
}

/// The four honest orientation outcomes:
/// - `active` — exactly one resumable task resolved (`active` or `blocked`).
/// - `none` — no resumable task (no records, or only `done` ones).
/// - `ambiguous` — several resumable tasks and the pointer did not decide.
/// - `corrupt-only` — the only durable state present is unreadable.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OrientOutcome {
    Active,
    None,
    Ambiguous,
    CorruptOnly,
}

impl OrientOutcome {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::None => "none",
            Self::Ambiguous => "ambiguous",
            Self::CorruptOnly => "corrupt-only",
        }
    }
}

/// The resumable task, flattened to the compact fields a fresh session needs.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OrientActiveTask {
    pub task_id: String,
    /// A blocked task is still "the" active task — it resolves, but must not
    /// silently auto-resume.
    pub blocked: bool,
    pub plan_path: Option<String>,
    pub plan_slug: Option<String>,
    pub current_step: String,
    pub next_action: String,
    pub blockers: Vec<String>,
}

impl OrientActiveTask {
    pub fn status(&self) -> &'static str {
        if self.blocked { "blocked" } else { "active" }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OrientEnvelope {
    pub outcome: OrientOutcome,
    /// Set only when `outcome` is `active`.
    pub active_task: Option<OrientActiveTask>,
    /// Task ids in play: the resolved one for `active`, every candidate for
    /// `ambiguous`, else empty.
    pub candidates: Vec<String>,
    /// Definite recorded-vs-current revision mismatches for the active task.
    pub stale_warnings: Vec<String>,
    /// Unreadable records, surfaced so one bad file never hides the rest.
    pub issues: Vec<TaskIssue>,
    /// How the pointer was read (diagnostic).
    pub pointer_kind: &'static str,
}

/// Build the envelope from reconstructed state, the pointer, and injected
/// probes. Resolution order:
///   1. The pointer resolves to exactly one NON-done record → `active`.
///   2. Otherwise, over the non-done records: 0 → `none` (or `corrupt-only`
///      when the ONLY state present is unreadable), 1 → `active`, >1 →
///      `ambiguous` with every candidate id.
///
/// Corrupt records are surfaced in `issues` whatever the outcome.
pub fn build_orient_envelope(
    resume: &ResumeState,
    pointer: Option<&ActiveTaskPointerRead>,
    probes: &[RepoRevisionProbe],
) -> OrientEnvelope {
    let pointer_kind = pointer.map_or("none", ActiveTaskPointerRead::kind);
    let issues = resume.issues.clone();
    let non_done: Vec<&TaskRecord> = resume
        .records
        .iter()
        .filter(|r| r.status != TaskStatus::Done)
        .collect();

    let pointed = match pointer {
        Some(ActiveTaskPointerRead::Canonical(p)) => {
            non_done.iter().find(|r| r.task_id == p.task_id).copied()
        }
        Some(ActiveTaskPointerRead::Legacy { plan_ref }) => non_done
            .iter()
            .find(|r| matches_legacy_ref(r, plan_ref))
            .copied(),
        None => None,
    };

    let resolved = pointed.or(if non_done.len() == 1 {
        Some(non_done[0])
    } else {
        None
    });
    if let Some(record) = resolved {
        return OrientEnvelope {
            outcome: OrientOutcome::Active,
            active_task: Some(flatten(record)),
            candidates: vec![record.task_id.clone()],
            stale_warnings: stale_warnings(record, probes),
            issues,
            pointer_kind,
        };
    }

    if non_done.is_empty() {
        let outcome = if resume.records.is_empty() && !issues.is_empty() {
            OrientOutcome::CorruptOnly
        } else {
            OrientOutcome::None
        };
        return OrientEnvelope {
            outcome,
            active_task: None,
            candidates: Vec::new(),
            stale_warnings: Vec::new(),
            issues,
            pointer_kind,
        };
    }

    let mut candidates: Vec<String> = non_done.iter().map(|r| r.task_id.clone()).collect();
    candidates.sort();
    OrientEnvelope {
        outcome: OrientOutcome::Ambiguous,
        active_task: None,
        candidates,
        stale_warnings: Vec::new(),
        issues,
        pointer_kind,
    }
}
