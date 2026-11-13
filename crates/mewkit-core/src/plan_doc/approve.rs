//! `plan approve <plan-dir|plan.md>` — stamp the Gate 1 approval receipt after
//! a human has approved the plan. Port of `commands/plan-approve.ts`.
//!
//! Anti-accidental: this records "an approval was stamped against THIS plan
//! revision", NOT a host-authenticated "a human approved". The agent must only
//! run it after a real human approval.
//!
//! Stamp and activation are SEPARATE facts. A failed activation does not
//! un-stamp the receipt, but it MUST exit non-zero and never claim activation
//! succeeded.
use std::path::{Path, PathBuf};

use super::receipt::{FRESH, stamp};
use super::{Output, resolve_against};
use crate::schema::task_record::normalize_task_id;
use crate::task_store::{ActivateTask, ActivationFailure, activate_task, iso_millis};
use crate::time_utc::{now_millis, utc_date};
use crate::trace::{TraceRecord, append_trace_record};

/// The verifier the write guard runs. Its PRESENCE is the precondition: a
/// receipt stamped into a project whose hook cannot read it is a receipt
/// nothing will ever check, so the npm CLI refuses — and so does this.
const RECEIPT_HELPER: [&str; 4] = [".claude", "hooks", "lib", "approval-receipt.cjs"];

pub struct ApproveOptions<'a> {
    pub target: Option<&'a str>,
    /// Recorded in the receipt as `approved_by`.
    pub by: Option<&'a str>,
    /// Durable activation. OFF by default, matching the npm CLI: its flag table
    /// declares `activate` a boolean, so the parser pre-sets it to false and
    /// `--no-activate` is what the command sees unless `--activate` is passed.
    pub activate: bool,
    /// Invoking CLI version, for record provenance.
    pub cli_version: &'a str,
    /// The approver when none was given and git has no identity.
    pub fallback_approver: String,
}

/// Resolve a `plan.md` from either a directory or a direct file path.
fn resolve_plan_file(project_root: &Path, target: &str) -> PathBuf {
    let resolved = resolve_against(project_root, target);
    if resolved.is_dir() {
        return resolved.join("plan.md");
    }
    resolved
}

/// Best-effort installed kit version (provenance only).
fn kit_version(project_root: &Path) -> String {
    for rel in [
        project_root.join(".meowkit").join("metadata.json"),
        project_root.join(".claude").join("metadata.json"),
    ] {
        if let Ok(text) = std::fs::read_to_string(&rel)
            && let Ok(value) = serde_json::from_str::<serde_json::Value>(&text)
            && let Some(version) = value.get("version").and_then(|v| v.as_str())
        {
            return version.to_string();
        }
    }
    String::new()
}

pub fn plan_approve(project_root: &Path, opts: &ApproveOptions<'_>) -> Output {
    let Some(target) = opts.target else {
        return Output::code(
            1,
            "plan approve: missing <plan-dir> or <plan.md>\n\
             Usage: mewkit plan approve <plan-dir|plan.md> [--by <approver>]",
        );
    };
    let plan_file = resolve_plan_file(project_root, target);
    if !plan_file.exists() {
        return Output::code(
            1,
            format!("plan approve: plan file not found: {}", plan_file.display()),
        );
    }
    let helper = RECEIPT_HELPER
        .iter()
        .fold(project_root.to_path_buf(), |acc, part| acc.join(part));
    if !helper.exists() {
        return Output::code(
            1,
            format!(
                "plan approve: approval-receipt helper not found at {}\n\
                 This project may predate the receipt mechanism — reinstall .claude/ hooks.",
                helper.display()
            ),
        );
    }

    let approver = match opts.by.map(str::trim).filter(|by| !by.is_empty()) {
        Some(by) => by.to_string(),
        None => opts.fallback_approver.clone(),
    };
    let now = now_millis();
    let receipt = stamp(&plan_file, &approver, &utc_date(now));
    if receipt.code != FRESH {
        // The refusal itself goes to stderr, the way the helper writes it; the
        // command's own line names what failed.
        let mut out = Output::code(
            1,
            format!("plan approve: failed to stamp receipt — {}", receipt.status),
        );
        out.stderr = format!("{}\n", receipt.status);
        return out;
    }

    let mut out = Output::code(
        0,
        format!(
            "{}\n✓ Gate 1 approval receipt stamped.\n\
             Anti-accidental: this records an approval against THIS plan revision, \
             not a host-authenticated human approval. Editing the plan body invalidates it \
             (re-approval required).",
            receipt.status
        ),
    );
    if !opts.activate {
        out.push("Skipped durable activation (--no-activate).");
        return out;
    }
    activate(project_root, &plan_file, opts, now, &mut out);
    out
}

/// Durably activate the plan as a task, then emit an advisory transition trace.
///
/// The two failure modes are reported differently because the npm CLI reports
/// them differently, and the difference matters to whoever reads the output: a
/// POINTER failure left a record behind (hence the rollback report), while a
/// RECORD failure wrote nothing at all. The npm CLI lets the latter escape
/// `activatePlan` into `planApprove`'s own catch, so it prints as a stamp
/// failure — misleading about WHICH step failed, but it is the text callers
/// have, and the receipt lines above it already say the stamp succeeded.
fn activate(
    project_root: &Path,
    plan_file: &Path,
    opts: &ApproveOptions<'_>,
    now: i64,
    out: &mut Output,
) {
    let plan_path = plan_file
        .strip_prefix(project_root)
        .map(|rel| rel.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| plan_file.to_string_lossy().into_owned());
    let plan_slug = plan_file
        .parent()
        .and_then(Path::file_name)
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    let task_id = normalize_task_id(&plan_slug);
    // Both provenance fields are always SET, never left to the existing record:
    // the npm writer passes its own version and an empty kit version when there
    // is no install metadata, so a reactivated record's stale provenance is
    // overwritten rather than preserved.
    let kit = kit_version(project_root);
    let activated = activate_task(
        project_root,
        &ActivateTask {
            task_id: &task_id,
            plan_path: Some(&plan_path),
            plan_slug: Some(&plan_slug),
            now: &iso_millis(now),
            cli_version: Some(opts.cli_version),
            kit_version: Some(&kit),
            next_action: Some("begin approved plan"),
            ..ActivateTask::default()
        },
    );
    let created_record = match activated {
        Ok(done) => done.created_record,
        Err(ActivationFailure::Record(error)) => {
            out.push(format!("plan approve: failed to stamp receipt — {error}"));
            out.code = 1;
            return;
        }
        Err(ActivationFailure::Pointer(error)) => {
            out.push(format!(
                "✗ Activation FAILED for task {} — approval was stamped, but this task is NOT active.",
                error.task_id
            ));
            out.push(if error.rolled_back {
                "  The partial record was rolled back. Re-run `mewkit plan approve` after resolving the cause.".to_string()
            } else {
                format!(
                    "  A partial record may remain at tasks/active/{}.json — inspect and repair before re-approving.",
                    error.task_id
                )
            });
            out.push(format!("  cause: {}", error.message));
            out.code = 1;
            return;
        }
    };

    out.push(format!(
        "✓ Activated task {task_id} → tasks/active/{task_id}.json (+ active pointer)."
    ));
    // The transition trace is advisory: a failed append never fails an
    // already-durable activation.
    let mut data = serde_json::Map::new();
    data.insert("status".into(), "active".into());
    data.insert("trigger".into(), "plan-approve".into());
    data.insert("createdRecord".into(), created_record.into());
    if let Err(error) = append_trace_record(
        project_root,
        &TraceRecord {
            event: "task_transition".to_string(),
            data,
            task_id: Some(task_id),
            plan_path: Some(plan_path),
            ..TraceRecord::default()
        },
    ) {
        out.push(format!(
            "⚠ activated, but transition trace emission failed: {error}"
        ));
    }
}
