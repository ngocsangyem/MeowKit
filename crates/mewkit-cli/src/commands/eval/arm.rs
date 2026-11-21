//! One arm of one case: prepare its sandbox template, then run it.
//!
//! The template is the case's fixture with the kit installed by this binary's
//! own `init`; for the "off" arm, every installed copy of the skill under test
//! is then deleted. Each run copies the template into a fresh folder, so runs
//! never see each other's edits.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

use mewkit_core::eval::runner::{self, MAX_ATTEMPTS, RunSpec, backoff};
use mewkit_core::eval::sandbox::{child_env, copy_tree, remove_skill};
use mewkit_core::eval::{
    Arm, LoadedCase, RunOutcome, RunResult, Runtime, Verdict, grade_run, normalize_skill, parse,
};
use mewkit_core::fsx::RelPath;
use mewkit_core::trace_analysis::redact_friction_note;
use tempfile::TempDir;

pub struct Ctx<'a> {
    pub runtime: Runtime,
    pub model: &'a str,
    pub timeout: Duration,
    pub max_turns: u32,
    pub parent_env: &'a [(String, String)],
    pub kit_archive: &'a Path,
    pub kit_sha256: Option<&'a str>,
}

pub struct Template {
    _dir: TempDir,
    root: PathBuf,
}

fn target_name(r: Runtime) -> &'static str {
    match r {
        Runtime::ClaudeCode => "claude-code",
        Runtime::Codex => "codex",
    }
}

/// Fixture copy plus a fresh install; the skill removed when `arm` is `Off`.
pub fn prepare(
    ctx: &Ctx<'_>,
    case_root: &Path,
    lc: &LoadedCase,
    arm: Option<Arm>,
) -> Result<Template, String> {
    let dir = tempfile::tempdir().map_err(|e| e.to_string())?;
    let root = dir.path().join("project");
    match &lc.fixture_dir {
        Some(f) => copy_tree(&f.under(case_root), &root),
        None => std::fs::create_dir_all(&root),
    }
    .map_err(|e| format!("fixture copy: {e}"))?;

    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let mut init = Command::new(exe);
    init.current_dir(&root)
        .args(["init", "--target", target_name(ctx.runtime), "--yes"]);
    // Every run installs the same kit archive, with no network call.
    init.arg("--kit-archive").arg(ctx.kit_archive);
    if let Some(sha) = ctx.kit_sha256 {
        init.args(["--kit-sha256", sha]);
    }
    let out = init.output().map_err(|e| format!("kit install: {e}"))?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(format!("kit install failed: {}", err.trim()));
    }
    if arm == Some(Arm::Off) {
        let removed = remove_skill(&root, &lc.case.skill).map_err(|e| e.to_string())?;
        if removed.is_empty() {
            return Err(format!(
                "the install has no `{}` skill to switch off",
                lc.case.skill
            ));
        }
    }
    Ok(Template { _dir: dir, root })
}

/// One attempt: Ok(verdict, cost) or Err(message) for a run that errored.
fn attempt(
    ctx: &Ctx<'_>,
    t: &Template,
    lc: &LoadedCase,
    arm: Option<Arm>,
) -> Result<(Verdict, Option<f64>), String> {
    let work = tempfile::tempdir().map_err(|e| e.to_string())?;
    let project = work.path().join("project");
    copy_tree(&t.root, &project).map_err(|e| e.to_string())?;
    let home = work.path().join("home");
    std::fs::create_dir_all(&home).map_err(|e| e.to_string())?;
    let env = child_env(ctx.parent_env.iter().cloned(), ctx.runtime, &home);
    let (program, args) = runner::command_line(&RunSpec {
        runtime: ctx.runtime,
        model: ctx.model,
        prompt: &lc.case.prompt,
        tools: &lc.case.tools,
        max_turns: ctx.max_turns,
    });
    let out_file = work.path().join("transcript.jsonl");
    let output = runner::run_child(&program, &args, &env, &project, &out_file, ctx.timeout)
        .map_err(|e| e.to_string())?;
    let transcript = parse(ctx.runtime, &output).map_err(|e| e.to_string())?;
    let skill = normalize_skill(&lc.case.skill);
    if arm == Some(Arm::Off)
        && transcript
            .listed_skills
            .as_ref()
            .is_some_and(|l| l.contains(&skill))
    {
        return Err(format!("`{skill}` is still listed in the off arm"));
    }
    let exists = |p: &RelPath| p.under(&project).exists();
    Ok((
        grade_run(&lc.case, &transcript, &exists),
        transcript.cost_usd,
    ))
}

/// Run with retries; an attempt that keeps erroring is an `error` result.
pub fn run_once(
    ctx: &Ctx<'_>,
    t: &Template,
    lc: &LoadedCase,
    arm: Option<Arm>,
) -> (RunResult, Option<f64>) {
    let mut last = String::new();
    for n in 1..=MAX_ATTEMPTS {
        match attempt(ctx, t, lc, arm) {
            Ok((verdict, cost)) => {
                let outcome = match verdict {
                    Verdict::Pass => RunOutcome::Pass,
                    Verdict::Fail => RunOutcome::Fail,
                    Verdict::NeedsJudge => {
                        last = "needs a judge model".into();
                        break;
                    }
                };
                return (
                    RunResult {
                        outcome,
                        arm,
                        error: None,
                    },
                    cost,
                );
            }
            Err(e) => last = e,
        }
        if n < MAX_ATTEMPTS {
            std::thread::sleep(backoff(n));
        }
    }
    let error = Some(redact_friction_note(&last));
    (
        RunResult {
            outcome: RunOutcome::Error,
            arm,
            error,
        },
        None,
    )
}
