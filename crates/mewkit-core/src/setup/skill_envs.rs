//! The `skill-envs` step: an interpreter environment for each skill the user
//! NAMED, and nothing else.
//!
//! Opt-in by default. With no `--skills` the step reports that it did nothing,
//! so setup is safe to run on a project that never wants an interpreter. Each
//! named skill gets exactly its own pins: no merged set, no default list.
use std::path::Path;

use super::{Changes, StepOptions, StepResult, StepStatus};
use crate::skill_env::{
    ensure_env, env_skills, format_package_list, install_pip_packages, read_skill_requirements,
    skill_env_dir, verify_packages,
};
use crate::toolchain;

fn fail(message: String) -> Result<StepResult, String> {
    Ok(StepResult::new(StepStatus::Fail, message))
}

pub(super) fn run(
    dir: &Path,
    options: &StepOptions<'_>,
    say: &mut dyn FnMut(&str),
) -> Result<StepResult, String> {
    let requested = options.skills;
    if requested.is_empty() {
        return Ok(StepResult::new(
            StepStatus::Skip,
            "No skills selected \u{2014} pass --skills=<a,b> or run `mewkit skill env <skill>`",
        ));
    }

    let declared = env_skills(dir);
    let unknown: Vec<&str> = requested
        .iter()
        .map(String::as_str)
        .filter(|s| !declared.iter().any(|d| d == s))
        .collect();
    if !unknown.is_empty() {
        let eligible = if declared.is_empty() {
            "(none)".to_string()
        } else {
            declared.join(", ")
        };
        return fail(format!(
            "Not a skill that needs an environment: {}. Eligible: {eligible}",
            unknown.join(", ")
        ));
    }

    if toolchain::find_python().is_none() {
        // An absent interpreter is a reason to skip, not to fail a setup that
        // configured everything else.
        return Ok(StepResult::new(
            StepStatus::Skip,
            format!(
                "No Python interpreter in PATH \u{2014} skipped {}; install Python, then re-run",
                requested.join(", ")
            ),
        ));
    }

    let mut created: Vec<String> = Vec::new();
    let mut installed: Vec<String> = Vec::new();
    let mut w = Changes::new(dir, options.dry_run);
    for skill in requested {
        let env_dir = skill_env_dir(dir, skill)?;
        let req = read_skill_requirements(dir, skill).map_err(|e| e.to_string())?;
        if !req.rejected.is_empty() {
            return fail(format!(
                "{skill}: rejected requirement line(s): {} \u{2014} nothing installed",
                req.rejected.join(", ")
            ));
        }

        // A dry run reports the environment and the pins and creates neither.
        if w.dry_run {
            if !env_dir.exists() {
                w.record("create", &env_dir, Some("interpreter environment"));
                created.push(skill.clone());
            }
            if !req.packages.is_empty() {
                let n = req.packages.len();
                w.record(
                    "install",
                    &env_dir,
                    Some(&format!("{n} package(s) for {skill}")),
                );
                installed.push(format!("{skill} ({n})"));
            }
            continue;
        }

        match ensure_env(dir, &env_dir, say) {
            Ok(outcome) if outcome.created || outcome.repaired => {
                w.record("create", &env_dir, Some("interpreter environment"));
                created.push(skill.clone());
            }
            Ok(_) => {}
            Err(message) => {
                return Ok(
                    StepResult::new(StepStatus::Fail, format!("{skill}: {message}"))
                        .with_changes(w.changes),
                );
            }
        }

        if req.packages.is_empty() {
            continue;
        }
        let present = verify_packages(&env_dir, &req.packages);
        let missing: Vec<_> = req
            .packages
            .iter()
            .zip(&present)
            .filter(|(_, p)| !p.installed)
            .map(|(pkg, _)| pkg.clone())
            .collect();
        if missing.is_empty() {
            continue;
        }
        let source = req.source.as_deref().map(|s| w.rel(s)).unwrap_or_default();
        say(&format!("\n  {skill} \u{2014} pins from {source}:"));
        say(&format_package_list(&missing));
        let results = install_pip_packages(dir, &env_dir, &missing, say)?;
        let failed = results.iter().filter(|r| !r.success).count();
        if failed > 0 {
            return Ok(StepResult::new(
                StepStatus::Warn,
                format!("{skill}: {failed} of {} package(s) failed", results.len()),
            )
            .with_changes(w.changes));
        }
        w.record(
            "install",
            &env_dir,
            Some(&format!("{} package(s) for {skill}", results.len())),
        );
        installed.push(format!("{skill} ({})", results.len()));
    }

    if created.is_empty() && installed.is_empty() {
        return Ok(StepResult::new(
            StepStatus::Skip,
            format!("Already configured: {}", requested.join(", ")),
        )
        .with_changes(w.changes));
    }
    let mut parts = Vec::new();
    if !created.is_empty() {
        parts.push(format!("created {}", created.join(", ")));
    }
    if !installed.is_empty() {
        parts.push(format!("installed {}", installed.join(", ")));
    }
    Ok(StepResult::new(StepStatus::Pass, parts.join("; ")).with_changes(w.changes))
}
