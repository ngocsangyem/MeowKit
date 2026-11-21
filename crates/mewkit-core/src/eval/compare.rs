//! Compare two reports of the same suite. Every eval-based gate goes through here.
//!
//! It fails closed: reports that are incomplete, or that differ in schema
//! version, runtime, pinned or judge model, "skill off" arm, case-set hash or
//! listed cases, are refused rather than
//! compared, because a difference between them would not be a difference the
//! change under test made. Both reports are re-finalized first, so a stored
//! `complete: true` or a stored total is never trusted.

use serde::Serialize;

use super::rates;
use super::report::Report;

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum CompareError {
    #[error(
        "the {0} report is incomplete (skipped cases, unbalanced paired arms, or too many errors)"
    )]
    Incomplete(&'static str),
    #[error("report schema versions differ: {base} vs {new}")]
    SchemaVersion { base: u32, new: u32 },
    #[error("runtimes differ: {base} vs {new}")]
    Runtime { base: String, new: String },
    #[error("pinned models differ: {base} vs {new}")]
    Model { base: String, new: String },
    #[error("judge models differ: {base:?} vs {new:?}")]
    JudgeModel {
        base: Option<String>,
        new: Option<String>,
    },
    #[error("\"skill off\" arms were produced differently: {base} vs {new}")]
    OffArm { base: String, new: String },
    #[error(
        "the reports list different cases, or declare them differently, under one case-set hash"
    )]
    Cases,
    #[error("case sets differ: {base} vs {new}")]
    CaseSet { base: String, new: String },
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Delta {
    /// A suite rate name, or `<case id>:<pass|on|off>`.
    pub metric: String,
    pub base: f64,
    pub new: f64,
    pub delta_pp: f64,
    /// True when `|delta_pp|` exceeds the margin.
    pub beyond_margin: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Comparison {
    pub margin_pp: f64,
    pub suite: Vec<Delta>,
    pub cases: Vec<Delta>,
}

fn delta(metric: String, base: Option<f64>, new: Option<f64>, margin: f64) -> Option<Delta> {
    let (base, new) = (base?, new?);
    let delta_pp = (new - base) * 100.0;
    Some(Delta {
        metric,
        base,
        new,
        delta_pp,
        beyond_margin: delta_pp.abs() > margin,
    })
}

pub fn compare(base: &Report, new: &Report) -> Result<Comparison, CompareError> {
    let (mut base, mut new) = (base.clone(), new.clone());
    base.finalize();
    new.finalize();
    if !base.complete {
        return Err(CompareError::Incomplete("base"));
    }
    if !new.complete {
        return Err(CompareError::Incomplete("new"));
    }
    if base.schema_version != new.schema_version {
        return Err(CompareError::SchemaVersion {
            base: base.schema_version,
            new: new.schema_version,
        });
    }
    if base.runtime != new.runtime {
        return Err(CompareError::Runtime {
            base: format!("{:?}", base.runtime),
            new: format!("{:?}", new.runtime),
        });
    }
    if base.model != new.model {
        return Err(CompareError::Model {
            base: base.model,
            new: new.model,
        });
    }
    if base.case_set_hash != new.case_set_hash {
        return Err(CompareError::CaseSet {
            base: base.case_set_hash,
            new: new.case_set_hash,
        });
    }

    if base.judge_model != new.judge_model {
        return Err(CompareError::JudgeModel {
            base: base.judge_model,
            new: new.judge_model,
        });
    }
    if base.off_arm != new.off_arm {
        return Err(CompareError::OffArm {
            base: base.off_arm,
            new: new.off_arm,
        });
    }
    // Same hash, so the same planned cases: anything else is a runner bug or
    // a hand edit, and the deltas below would compare different things.
    let shapes = |r: &Report| {
        let mut v: Vec<_> = r.cases.iter().map(|c| c.shape()).collect();
        v.sort_by(|a, b| a.id.cmp(&b.id));
        v
    };
    if shapes(&base) != shapes(&new) {
        return Err(CompareError::Cases);
    }

    let margin = base.margin_pp.max(new.margin_pp);
    let suite = rates::named(&base.totals)
        .into_iter()
        .zip(rates::named(&new.totals))
        .filter_map(|((name, b), (_, n))| delta(name.to_owned(), b, n, margin))
        .collect();
    let mut cases = Vec::new();
    for bc in &base.cases {
        let nc = new
            .cases
            .iter()
            .find(|c| c.id == bc.id)
            .expect("case lists were checked equal above");
        for ((name, b), (_, n)) in rates::case_rates(bc).into_iter().zip(rates::case_rates(nc)) {
            cases.extend(delta(format!("{}:{name}", bc.id), b, n, margin));
        }
    }
    Ok(Comparison {
        margin_pp: margin,
        suite,
        cases,
    })
}
