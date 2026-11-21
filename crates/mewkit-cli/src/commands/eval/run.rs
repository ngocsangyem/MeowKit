//! `eval run`: select cases, enforce the ceiling, run each arm, write the report.

use std::path::Path;
use std::time::Duration;

use mewkit_core::eval::ledger::Ledger;
use mewkit_core::eval::sandbox::{child_env, has_auth};
use mewkit_core::eval::{
    Arm, CaseKind, CaseResult, LoadedCase, REPORT_SCHEMA_VERSION, Report, Runtime, SkippedCase,
    load_cases,
};
use mewkit_core::time_utc::now_millis;

use super::RunArgs;
use super::arm::{self, Ctx};
use super::output::{below, write_report};
use crate::failure::{FAILED, Failure, OK};

fn parse_runtime(s: &str) -> Result<Runtime, Failure> {
    match s {
        "claude-code" => Ok(Runtime::ClaudeCode),
        "codex" => Ok(Runtime::Codex),
        other => Err(Failure::usage(format!(
            "unknown runtime {other:?}; use claude-code or codex"
        ))),
    }
}

fn arms(kind: CaseKind) -> Vec<Option<Arm>> {
    match kind {
        CaseKind::Paired => vec![Some(Arm::On), Some(Arm::Off)],
        _ => vec![None],
    }
}

/// Ends the ledger session however the run stops.
struct Session(Ledger);
impl Drop for Session {
    fn drop(&mut self) {
        let _ = self.0.end();
    }
}

pub fn run(a: &RunArgs) -> Result<u8, Failure> {
    let runtime = parse_runtime(&a.runtime)?;
    let cwd = std::env::current_dir()?;
    let project = cwd
        .ancestors()
        .find(|d| d.join(".claude").is_dir())
        .map(Path::to_path_buf)
        .unwrap_or(cwd.clone());
    let default_root = project.join(".claude/skills");
    let case_root = a.case_root.clone().unwrap_or(default_root.clone());
    let outside = case_root.canonicalize().ok() != default_root.canonicalize().ok();
    if outside && !a.trust_cases {
        return Err(Failure::usage(format!(
            "{} is not this project's .claude/skills; its cases run model turns. Read them, then pass --trust-cases",
            case_root.display()
        )));
    }
    let set = load_cases(&case_root).map_err(|e| Failure::failed(e.to_string()))?;
    let selected: Vec<&LoadedCase> = set
        .cases
        .iter()
        .filter(|l| l.case.suite == a.suite)
        .filter(|l| a.cases.is_empty() || a.cases.contains(&l.case.id))
        .collect();
    if selected.is_empty() {
        return Err(Failure::failed(format!("no cases in suite {:?}", a.suite)));
    }
    if a.dry_run {
        let mut total = 0;
        for l in &selected {
            let n = l.case.runs as usize * arms(l.case.kind).len();
            total += n;
            println!(
                "{:<28} {:<10} {n:>3} runs",
                l.case.id,
                format!("{:?}", l.case.kind).to_lowercase()
            );
        }
        println!(
            "{} cases, {total} runs, case-set hash {}",
            selected.len(),
            set.hash
        );
        return Ok(OK);
    }

    let (Some(model), Some(max_usd), Some(max_runs), Some(kit_archive)) = (
        a.model.as_deref(),
        a.max_cost_usd,
        a.max_runs,
        a.kit_archive.as_deref(),
    ) else {
        return Err(Failure::usage(
            "--model, --max-cost-usd, --max-runs and --kit-archive are required to run cases",
        ));
    };
    let parent_env: Vec<(String, String)> = std::env::vars().collect();
    if !has_auth(
        &child_env(parent_env.iter().cloned(), runtime, Path::new("/")),
        runtime,
    ) {
        return Err(Failure::failed(match runtime {
            Runtime::ClaudeCode => {
                "set CLAUDE_CODE_OAUTH_TOKEN (from `claude setup-token`) or ANTHROPIC_API_KEY; eval runs use an empty config home and copy no login file"
            }
            Runtime::Codex => {
                "set CODEX_API_KEY or OPENAI_API_KEY; eval runs use an empty CODEX_HOME and copy no login file"
            }
        }));
    }
    let telemetry = project.join(".meowkit/telemetry");
    let session_id = format!("eval-{}-{}", now_millis(), std::process::id());
    let ledger = Session(Ledger::new(&telemetry, &session_id));
    ledger
        .0
        .begin()
        .map_err(|e| Failure::failed(e.to_string()))?;

    let ctx = Ctx {
        runtime,
        model,
        timeout: Duration::from_secs(a.timeout_secs),
        max_turns: a.max_turns,
        parent_env: &parent_env,
        kit_archive,
        kit_sha256: a.kit_sha256.as_deref(),
    };
    let mut results = Vec::new();
    let mut skipped = Vec::new();
    let mut estimate = 0.0_f64;
    let mut stopped = false;
    for l in &selected {
        let mut result = CaseResult::planned(&l.case);
        let skip = |reason: String| SkippedCase {
            id: l.case.id.clone(),
            reason,
        };
        if stopped {
            skipped.push(skip("cost ceiling or run cap reached".into()));
            results.push(result);
            continue;
        }
        if l.case.needs_judge() {
            skipped.push(skip(
                "needs a judge model; model-graded runs are not supported yet".into(),
            ));
            results.push(result);
            continue;
        }
        'arms: for arm_kind in arms(l.case.kind) {
            let template = match arm::prepare(&ctx, &case_root, l, arm_kind) {
                Ok(t) => t,
                Err(e) => {
                    skipped.push(skip(e));
                    break 'arms;
                }
            };
            for _ in 0..l.case.runs {
                let allowed = ledger
                    .0
                    .reserve(max_usd, max_runs, estimate)
                    .map_err(|e| Failure::failed(e.to_string()))?;
                if !allowed {
                    stopped = true;
                    skipped.push(skip("cost ceiling or run cap reached".into()));
                    break 'arms;
                }
                let (run, cost) = arm::run_once(&ctx, &template, l, arm_kind);
                let spent = cost.unwrap_or(estimate);
                estimate = estimate.max(spent);
                ledger
                    .0
                    .record(spent)
                    .map_err(|e| Failure::failed(e.to_string()))?;
                let side = match arm_kind {
                    Some(Arm::On) => " on",
                    Some(Arm::Off) => " off",
                    None => "",
                };
                println!("{}{side}: {:?}", l.case.id, run.outcome);
                result.runs.push(run);
            }
        }
        results.push(result);
    }

    let mut report = Report {
        schema_version: REPORT_SCHEMA_VERSION,
        runtime,
        model: model.to_owned(),
        judge_model: None,
        case_set_hash: set.hash.clone(),
        off_arm: "scratch-install".into(),
        complete: false,
        skipped,
        cases: results,
        totals: Default::default(),
        spread_pp: None,
        margin_pp: 0.0,
        probes: vec![],
        gates: vec![],
    };
    report.finalize();
    let path = write_report(&telemetry, &a.suite, &a.runtime, &report)?;
    println!("Report: {} (complete: {})", path.display(), report.complete);
    Ok(if below(&report, a.fail_under) {
        FAILED
    } else {
        OK
    })
}
