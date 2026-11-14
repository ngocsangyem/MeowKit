//! `advice` — the parent-side surface for `--advice`: `begin`, `commit`,
//! `status`, `validate-packet`.
//!
//! Skills are prose, so they cannot call the supervision core directly; this
//! command is how a checkpoint reaches it. That is the point of the split: the
//! SKILL decides when a checkpoint fires, and this command decides whether it
//! MAY — cap accounting, stage legality, idempotency and the durable record all
//! live below, in [`mewkit_core::advice`], where a skill body cannot talk its
//! way past them.
//!
//! Nothing here approves anything. `begin` may refuse a call and `commit` may
//! refuse a disposition, but no path advances a gate, and the disposition is
//! recorded verbatim beside the parent's own outcome.
use std::path::Path;

use clap::{ArgAction, Args};
use mewkit_core::advice::store::{StoreError, read_dossier};
use mewkit_core::schema::dossier::Dossier;
use mewkit_core::schema::dossier_doc::dossier_path;
use mewkit_core::schema::dossier_parse::DossierRead;

use crate::failure::{FAILED, Failure, OK, USAGE};

mod begin;
mod commit;
mod escalation;
mod evidence_correction;
mod packet;
mod receipt;
mod status;

#[derive(Args, Debug)]
pub struct AdviceArgs {
    /// `begin`, `commit`, `status` or `validate-packet`.
    pub subcommand: Option<String>,
    /// The supervision run id; it names the dossier.
    #[arg(long)]
    pub run: Option<String>,
    /// The wrapped skill, e.g. `mk:cook`.
    #[arg(long)]
    pub skill: Option<String>,
    /// GUIDE, RESCUE, REVIEW or RECHECK.
    #[arg(long)]
    pub stage: Option<String>,
    /// Caller-chosen checkpoint id, unique within the run.
    #[arg(long)]
    pub checkpoint: Option<String>,
    /// The returned routing signal, recorded verbatim.
    #[arg(long)]
    pub disposition: Option<String>,
    /// What the PARENT did with the directive: adopted, rejected, deferred.
    #[arg(long)]
    pub outcome: Option<String>,
    /// Why — required even when the directive was adopted.
    #[arg(long)]
    pub reason: Option<String>,
    /// The question the checkpoint asked.
    #[arg(long)]
    pub question: Option<String>,
    /// The directive that came back.
    #[arg(long)]
    pub directive: Option<String>,
    /// One required correction; repeat for more.
    #[arg(long, action = ArgAction::Append)]
    pub correction: Vec<String>,
    /// One evidence pointer; repeat for more.
    #[arg(long = "evidence-pointer", action = ArgAction::Append)]
    pub evidence_pointer: Vec<String>,
    /// The next safe action recorded on the receipt.
    #[arg(long)]
    pub next: Option<String>,
    /// Receipt filename slug; defaults to the run id.
    #[arg(long)]
    pub slug: Option<String>,
    /// Task id recorded on the receipt.
    #[arg(long = "task-id")]
    pub task_id: Option<String>,
    /// Runtime recorded on the receipt.
    #[arg(long)]
    pub provider: Option<String>,
    /// `commit`: the workflow evidence index a correction supersedes.
    /// `validate-packet`: the packet to check.
    #[arg(long)]
    pub evidence: Option<String>,
    /// `commit`: source or scope — scope also returns Gate 1 to required.
    #[arg(long = "correction-kind")]
    pub correction_kind: Option<String>,
    /// `validate-packet`: input, output or brief.
    #[arg(long = "packet-kind")]
    pub packet_kind: Option<String>,
    /// The release stage whose budget this call spends (`mk:ship` only).
    #[arg(long = "release-stage")]
    pub release_stage: Option<String>,
    /// `status`: print the dossier as JSON.
    #[arg(long)]
    pub json: bool,
}

const SUBCOMMANDS: [&str; 4] = ["begin", "commit", "status", "validate-packet"];

/// How a subcommand stops early.
pub(crate) enum AdviceError {
    /// A refusal. `escalate` means hand this to a human — it is not a retry hint.
    Refusal { message: String, escalate: bool },
    /// A dossier exists but cannot be read, so supervision stops for that run.
    Corrupt(String),
    /// A failure that is not a supervision decision — a caller-supplied run id
    /// that is not a filename, a record the schema refuses. The npm CLI lets
    /// these escape its command and answers them from its top-level handler.
    Hard(String),
}

pub(crate) fn refuse(message: impl Into<String>) -> AdviceError {
    AdviceError::Refusal {
        message: message.into(),
        escalate: false,
    }
}

pub(crate) fn escalate(message: impl Into<String>) -> AdviceError {
    AdviceError::Refusal {
        message: message.into(),
        escalate: true,
    }
}

pub fn run(args: &AdviceArgs) -> Result<u8, Failure> {
    // Classified before anything runs, the way the npm CLI's dispatcher does: a
    // missing or mistyped sub-verb is an invocation error (exit 2), never a
    // silent no-op.
    match args.subcommand.as_deref() {
        None => return Ok(invocation_error(None)),
        Some(sub) if !SUBCOMMANDS.contains(&sub) => return Ok(invocation_error(Some(sub))),
        _ => {}
    }
    let root = std::env::current_dir()?;
    let outcome = match args.subcommand.as_deref().expect("classified above") {
        "begin" => begin::run(&root, args),
        "commit" => commit::run(&root, args),
        "status" => status::run(&root, args),
        _ => packet::run(&root, args),
    };
    match outcome {
        Ok(()) => Ok(OK),
        Err(AdviceError::Refusal { message, escalate }) => {
            eprintln!("{message}");
            if escalate {
                eprintln!("Escalate to a human — this is not a retry.");
            }
            Ok(FAILED)
        }
        // A damaged record surfaces as a refusal, not a stack trace: the
        // operator needs the repair instruction, and supervision must stop
        // rather than start fresh.
        Err(AdviceError::Corrupt(message)) => {
            eprintln!(
                "{message}\nSupervision is disabled for this run until that file is repaired or removed."
            );
            eprintln!("The ordinary workflow continues unsupervised — it is not blocked by this.");
            Ok(FAILED)
        }
        // `Fatal:` on stdout's sibling stream and exit 1, which is what the npm
        // CLI's top-level handler prints — not this binary's own
        // `mewkit: …`, because a skill greps these lines.
        Err(AdviceError::Hard(message)) => {
            eprintln!("Fatal: {message}");
            Ok(FAILED)
        }
    }
}

fn invocation_error(subcommand: Option<&str>) -> u8 {
    match subcommand {
        Some(sub) => eprintln!("Unknown `advice` subcommand: {sub}"),
        None => eprintln!("`mewkit advice` needs a subcommand."),
    }
    eprintln!("Valid subcommands: {}", SUBCOMMANDS.join(", "));
    eprintln!("Run `mewkit advice --help` for usage.");
    USAGE
}

/// Load a run's dossier, refusing to continue on a damaged one.
///
/// A corrupt record is NOT treated as a fresh run: that would reset every cap
/// the moment the file became unreadable, so the cheapest way to buy unlimited
/// supervision would be to break the file that counts it. Supervision stops
/// until the record is recovered; the ordinary workflow continues unsupervised.
pub(crate) fn load_dossier(
    project_root: &Path,
    run_id: &str,
) -> Result<Option<Dossier>, AdviceError> {
    match read_dossier(project_root, run_id) {
        Ok(DossierRead::Found(dossier)) => Ok(Some(*dossier)),
        Ok(DossierRead::Absent) => Ok(None),
        Ok(DossierRead::Corrupt(reason)) => {
            let path = dossier_path(project_root, run_id)
                .map(|p| p.display().to_string())
                .unwrap_or_default();
            Err(refuse(format!(
                "Supervision state for run \"{run_id}\" is unreadable ({reason}).\n\
                 Supervision is disabled for this run until {path} is repaired or removed.\n\
                 The ordinary workflow continues unsupervised — it is not blocked by this."
            )))
        }
        Err(message) => Err(AdviceError::Hard(message)),
    }
}

/// A store failure in the shape the command prints it.
pub(crate) fn store_error(error: StoreError) -> AdviceError {
    match error {
        StoreError::Corrupt { .. } => AdviceError::Corrupt(error.to_string()),
        other => AdviceError::Hard(other.to_string()),
    }
}

/// `String(v).trim()` over a repeatable flag, dropping the blanks — the npm
/// CLI's `toArray`.
pub(crate) fn to_array(values: &[String]) -> Vec<String> {
    values
        .iter()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
        .collect()
}

/// A trimmed `--release-stage`, where blank means "not given".
pub(crate) fn partition_of(args: &AdviceArgs) -> Option<&str> {
    args.release_stage
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
}

/// `value || fallback` — the JS truthiness the npm CLI prints with.
pub(crate) fn or_else<'a>(value: &'a str, fallback: &'a str) -> &'a str {
    if value.is_empty() { fallback } else { value }
}
