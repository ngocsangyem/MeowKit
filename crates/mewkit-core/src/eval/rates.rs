//! Rate arithmetic over run results, shared by the report and the comparison.
//!
//! A paired case counts by pairs: the i-th `on` run with the i-th `off` run.
//! A pair with an errored arm is left out of both rates. A case whose run count
//! differs from its plan (the ceiling stopped it, or one arm ran without the
//! other) makes the report incomplete.

use super::case::CaseKind;
use super::report::{Arm, CaseResult, RunOutcome, Totals};

#[derive(Debug, Clone, Copy, Default)]
struct Tally {
    pass: u32,
    fail: u32,
}

impl Tally {
    fn add(&mut self, o: RunOutcome) {
        match o {
            RunOutcome::Pass => self.pass += 1,
            RunOutcome::Fail => self.fail += 1,
            RunOutcome::Error => {}
        }
    }
    fn merge(&mut self, o: Tally) {
        self.pass += o.pass;
        self.fail += o.fail;
    }
    fn pass_rate(self) -> Option<f64> {
        let n = self.pass + self.fail;
        (n > 0).then(|| f64::from(self.pass) / f64::from(n))
    }
    fn fail_rate(self) -> Option<f64> {
        self.pass_rate().map(|r| 1.0 - r)
    }
}

/// Paired arms as tallies.
fn paired_tallies(c: &CaseResult) -> (Tally, Tally) {
    let arm = |a: Arm| -> Vec<RunOutcome> {
        c.runs
            .iter()
            .filter(|r| r.arm == Some(a))
            .map(|r| r.outcome)
            .collect()
    };
    let (on, off) = (arm(Arm::On), arm(Arm::Off));
    let (mut t_on, mut t_off) = (Tally::default(), Tally::default());
    for (a, b) in on.iter().zip(&off) {
        if *a != RunOutcome::Error && *b != RunOutcome::Error {
            t_on.add(*a);
            t_off.add(*b);
        }
    }
    (t_on, t_off)
}

/// Did this case run exactly what it planned? A paired case runs each arm
/// `planned_runs` times and every run names its arm; any other case runs
/// `planned_runs` times with no arm. A case stopped part-way fails this.
fn ran_as_planned(c: &CaseResult) -> bool {
    let n = c.planned_runs as usize;
    let count = |a: Option<Arm>| c.runs.iter().filter(|r| r.arm == a).count();
    n > 0
        && match c.kind {
            CaseKind::Paired => {
                count(Some(Arm::On)) == n && count(Some(Arm::Off)) == n && count(None) == 0
            }
            _ => c.runs.len() == n && count(None) == n,
        }
}

fn tally(c: &CaseResult) -> Tally {
    let mut t = Tally::default();
    c.runs.iter().for_each(|r| t.add(r.outcome));
    t
}

/// Suite totals, and whether every case ran exactly as planned.
pub(crate) fn totals(cases: &[CaseResult]) -> (Totals, bool) {
    let [mut trigger, mut on, mut off, mut wrong, mut control] = [Tally::default(); 5];
    let mut as_planned = true;
    let mut out = Totals::default();
    for c in cases {
        as_planned &= ran_as_planned(c);
        out.runs += c.runs.len() as u32;
        out.errors += c
            .runs
            .iter()
            .filter(|r| r.outcome == RunOutcome::Error)
            .count() as u32;
        match c.kind {
            CaseKind::Trigger => trigger.merge(tally(c)),
            CaseKind::Paired => {
                let (a, b) = paired_tallies(c);
                on.merge(a);
                off.merge(b);
            }
            CaseKind::Parachute if c.control => control.merge(tally(c)),
            CaseKind::Parachute => wrong.merge(tally(c)),
        }
    }
    out.trigger_rate = trigger.pass_rate();
    out.paired_on_rate = on.pass_rate();
    out.paired_off_rate = off.pass_rate();
    out.mismatch_report_rate = wrong.pass_rate();
    // On a control brief a failure is a mismatch reported where there was none.
    out.false_report_rate = control.fail_rate();
    (out, as_planned)
}

/// The suite rates by name, in a fixed order.
pub(crate) fn named(t: &Totals) -> [(&'static str, Option<f64>); 5] {
    [
        ("triggerRate", t.trigger_rate),
        ("pairedOnRate", t.paired_on_rate),
        ("pairedOffRate", t.paired_off_rate),
        ("mismatchReportRate", t.mismatch_report_rate),
        ("falseReportRate", t.false_report_rate),
    ]
}

/// One case's rates by name: `pass` for trigger and parachute, `on` and `off`
/// for paired. For a control brief `pass` means no false report.
pub(crate) fn case_rates(c: &CaseResult) -> Vec<(&'static str, Option<f64>)> {
    match c.kind {
        CaseKind::Paired => {
            let (on, off) = paired_tallies(c);
            vec![("on", on.pass_rate()), ("off", off.pass_rate())]
        }
        _ => vec![("pass", tally(c).pass_rate())],
    }
}
