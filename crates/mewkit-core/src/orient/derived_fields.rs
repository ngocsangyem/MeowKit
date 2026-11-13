//! The values the envelope DERIVES from a record, rather than copies.
//!
//! Three small pure functions, split out so the resolution rules in
//! `envelope.rs` read as rules: which plan slug a path implies, which recorded
//! revisions have definitely moved, and which record fields a fresh session
//! actually needs.
use super::envelope::{OrientActiveTask, RepoRevisionProbe};
use crate::schema::task_record::{TaskRecord, TaskStatus};

/// Derive a plan slug from a plan path: the directory holding `plan.md`, else
/// the basename without its `.md` extension. Pure and separator-tolerant. Used
/// for EXACT legacy-pointer matching only.
pub fn plan_slug_from_path(plan_path: Option<&str>) -> Option<String> {
    let path = plan_path?;
    let parts: Vec<&str> = path
        .split(['/', '\\'])
        .filter(|part| !part.is_empty())
        .collect();
    let last = *parts.last()?;
    // The TypeScript test is `/\.md$/i`, so an upper-case extension counts.
    // `str::get` returns None rather than panicking on a non-char boundary.
    let cut = last.len().checked_sub(3);
    let stem = cut
        .filter(|cut| {
            last.get(*cut..)
                .is_some_and(|tail| tail.eq_ignore_ascii_case(".md"))
        })
        .map(|cut| &last[..cut]);
    match stem {
        Some(_) if parts.len() >= 2 => Some(parts[parts.len() - 2].to_string()),
        Some(stem) => Some(stem.to_string()),
        None => Some(last.to_string()),
    }
}

/// Exact (never substring) match of a legacy plan reference against a record's
/// plan path or slug.
pub(super) fn matches_legacy_ref(record: &TaskRecord, plan_ref: &str) -> bool {
    record.plan_path.as_deref() == Some(plan_ref)
        || plan_slug_from_path(record.plan_path.as_deref()).as_deref() == Some(plan_ref)
}

/// Definite revision mismatches (both revisions known and unequal) for one
/// task's repos. A repo with no probe, or no recorded revision, is silent:
/// "unknown" is not "moved".
pub(super) fn stale_warnings(record: &TaskRecord, probes: &[RepoRevisionProbe]) -> Vec<String> {
    let mut warnings = Vec::new();
    for repo in &record.repos {
        let Some(recorded) = repo.revision.as_deref() else {
            continue;
        };
        let Some(probe) = probes.iter().find(|p| p.identity == repo.identity) else {
            continue;
        };
        if let Some(now) = probe.current_revision.as_deref()
            && now != recorded
        {
            warnings.push(format!(
                "repo {} moved from {recorded} to {now}",
                repo.identity
            ));
        }
    }
    warnings
}

pub(super) fn flatten(record: &TaskRecord) -> OrientActiveTask {
    OrientActiveTask {
        task_id: record.task_id.clone(),
        blocked: record.status == TaskStatus::Blocked,
        plan_path: record.plan_path.clone(),
        plan_slug: plan_slug_from_path(record.plan_path.as_deref()),
        current_step: record.current_step.clone(),
        next_action: record.next_action.clone(),
        blockers: record.blockers.clone(),
    }
}
