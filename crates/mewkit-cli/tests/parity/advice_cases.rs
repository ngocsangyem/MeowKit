//! `advice` against both CLIs.
//!
//! The cases are grouped the way the command is: how an invocation is
//! classified, what `begin` refuses, what `commit` records, and what `status`
//! and `validate-packet` report. Every group pins at least one REFUSAL and one
//! success, because two CLIs that both refuse everything agree trivially.
//!
//! The standing invariant across all of them: no output and no written file
//! carries an approval. `nothing_written_here_records_an_approval` in
//! [`commit`] asserts it over the artifacts a full checkpoint leaves behind.
#[allow(unused_imports)]
use crate::parity;

mod begin;
mod begin_budget;
mod commit;
mod commit_refusals;
mod correction;
mod invocation;
mod status;
mod validate_packet;

/// The fixtures, named once so a case reads as the behaviour it pins.
pub(crate) mod fixtures {
    /// A GUIDE checkpoint open on `mk:cook`, nothing committed.
    pub(crate) const OPEN: &str = "advice-run-open";
    /// The same run with its GUIDE call committed.
    pub(crate) const COMMITTED: &str = "advice-run-committed";
    /// A REVIEW checkpoint open, plus a workflow evidence index and a decoy
    /// artifact a correction must refuse to write.
    pub(crate) const REVIEW_OPEN: &str = "advice-review-open";
    /// One REVIEW return already recorded, RECHECK open — a second return here
    /// is the one that escalates.
    pub(crate) const RETURNED: &str = "advice-run-returned";
    /// The call cap reached while a stage still has room.
    pub(crate) const SPENT: &str = "advice-run-spent";
    /// A run already handed to a human.
    pub(crate) const ESCALATED: &str = "advice-escalated";
    /// `mk:ship`, whose budget is per release stage.
    pub(crate) const SHIP: &str = "advice-ship-run";
    /// A dossier that cannot be read back.
    pub(crate) const CORRUPT: &str = "advice-corrupt";
    /// Packets and briefs, valid and not.
    pub(crate) const PACKETS: &str = "advice-packets";
}

/// One `advice` invocation against both CLIs.
pub(crate) fn advice(name: &'static str, fixture: Option<&'static str>, args: &[&str]) -> Case {
    let mut argv = vec!["advice"];
    argv.extend_from_slice(args);
    let case = parity::case(name).args(&argv);
    match fixture {
        Some(fixture) => case.fixture(fixture),
        None => case,
    }
}

pub(crate) use parity::{Case, Run};

/// `advice begin` with the full triple — `[run, skill, stage, checkpoint]` —
/// plus whatever else the case adds, and the paths it must leave behind.
///
/// The triple is spelled out in every case because an INCOMPLETE one is itself
/// a behaviour under test: a call missing any part of it is refused rather than
/// downgraded to a stateless consult.
pub(crate) fn begin_case(
    name: &'static str,
    fixture: Option<&'static str>,
    triple: [&str; 4],
    extra: &[&str],
    writes: &[&str],
) -> Option<(Run, Run)> {
    let [run, skill, stage, checkpoint] = triple;
    let mut args = vec![
        "begin",
        "--run",
        run,
        "--skill",
        skill,
        "--stage",
        stage,
        "--checkpoint",
        checkpoint,
    ];
    args.extend_from_slice(extra);
    advice(name, fixture, &args).writes(writes).run()
}

/// The dossier a run writes, relative to the project.
pub(crate) fn dossier(run_id: &str) -> String {
    format!("tasks/reports/{run_id}-athena-supervision.md")
}

/// The receipt a commit writes. The date is the LOCAL calendar day, which is
/// what both CLIs name a receipt with, so the test asks for it the same way
/// rather than hard-coding a day that would expire.
pub(crate) fn receipt(slug: &str, n: u32) -> String {
    format!(
        "tasks/reports/{}-{slug}-advice-{n}.md",
        mewkit_core::task_files::today_yymmdd()
    )
}
