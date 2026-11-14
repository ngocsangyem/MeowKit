//! `skill env` — create, repair or list per-skill interpreter environments.
//!
//! The only command in the kit that creates an interpreter environment, and it
//! does so only when a user names a skill. Nothing calls it implicitly: a skill
//! that finds its environment missing prints this command and stops.
//!
//! ## Why the sub-verb is a plain positional
//!
//! The npm CLI classifies a wrong sub-verb from its catalogue before dispatching
//! and hooks read that exact text, so [`run`] reproduces the refusal verbatim
//! instead of letting clap word it. A failure prints the npm CLI's own line and
//! exits non-zero rather than returning a [`Failure`], whose `mewkit:`
//! prefix would break that parity.
use std::path::Path;

use clap::Args;
use mewkit_core::skill_env::{
    RUNTIME_KEY, ensure_env, env_skills, env_usable, envs_rel, existing_envs, install_pip_packages,
    is_skill_dir_name, read_skill_requirements, read_skill_runtime, skill_env_dir,
};
use mewkit_core::toolchain::find_python;

use crate::failure::{FAILED, Failure, OK, USAGE};

#[derive(Args, Debug)]
pub struct SkillArgs {
    /// `env`.
    pub subcommand: Option<String>,
    /// The skill whose environment to create or repair.
    pub skill: Option<String>,
    /// List every skill that declares a runtime and the state of its environment.
    #[arg(long)]
    pub list: bool,
}

const USAGE_TEXT: &str = "mewkit skill env \u{2014} per-skill interpreter environments

Usage:
  mewkit skill env <skill>    create or repair the environment for one skill
  mewkit skill env --list     show every skill that declares a runtime
";

pub fn run(args: &SkillArgs) -> Result<u8, Failure> {
    let Some(sub) = args.subcommand.as_deref() else {
        return Ok(invocation_error("`mewkit skill` needs a subcommand."));
    };
    if sub != "env" {
        return Ok(invocation_error(&format!(
            "Unknown `skill` subcommand: {sub}"
        )));
    }
    let project = std::env::current_dir()?;
    if args.list {
        return Ok(list_envs(&project));
    }
    match args.skill.as_deref() {
        Some(skill) if !skill.starts_with('-') => Ok(provision_env(&project, skill)),
        _ => {
            print!("{USAGE_TEXT}");
            Ok(FAILED)
        }
    }
}

/// The catalogue's refusal, word for word, on stderr with exit 2.
fn invocation_error(headline: &str) -> u8 {
    eprintln!("{headline}");
    eprintln!("Valid subcommands: env");
    eprintln!("Run `mewkit skill --help` for usage.");
    USAGE
}

fn pad_end(text: &str, width: usize) -> String {
    let len = text.encode_utf16().count();
    format!("{text}{}", " ".repeat(width.saturating_sub(len)))
}

fn rel(project: &Path, path: &Path) -> String {
    path.strip_prefix(project)
        .unwrap_or(path)
        .display()
        .to_string()
}

fn or_none(names: &[String]) -> String {
    if names.is_empty() {
        "(none)".to_string()
    } else {
        names.join(", ")
    }
}

/// An unexpected failure, worded as the npm CLI's top-level handler does.
fn fatal(message: &str) -> u8 {
    eprintln!("Fatal: {message}");
    FAILED
}

/// `--list`: every skill that needs an environment, and whether its one is usable.
fn list_envs(project: &Path) -> u8 {
    let skills = env_skills(project);
    println!("\nPer-skill environments  {}\n", envs_rel().display());
    if skills.is_empty() {
        println!("  No skill declares {RUNTIME_KEY} or pins packages.\n");
        return OK;
    }
    for skill in &skills {
        let Ok(env_dir) = skill_env_dir(project, skill) else {
            return fatal(&format!("Not a skill directory name: {skill}"));
        };
        let runtime = read_skill_runtime(project, skill);
        let state = if env_usable(&env_dir) {
            "ready"
        } else if env_dir.exists() {
            "broken"
        } else {
            "absent"
        };
        let req = match read_skill_requirements(project, skill) {
            Ok(req) => req,
            Err(e) => return fatal(&e.to_string()),
        };
        let pins = if req.source.is_some() {
            format!("{} pinned", req.packages.len())
        } else {
            "stdlib only".to_string()
        };
        let entries = runtime.map_or("binary only".to_string(), |r| r.entries.join(", "));
        println!(
            "  {} {} {entries} \u{b7} {pins}",
            pad_end(skill, 18),
            pad_end(state, 16)
        );
    }
    // An environment with no declaring skill is listed rather than deleted: it
    // may belong to a skill the user removed, and a tree the user filled is not
    // this command's to delete.
    let orphans: Vec<String> = existing_envs(project)
        .into_iter()
        .filter(|name| !skills.contains(name))
        .collect();
    if !orphans.is_empty() {
        println!("\n  No longer declared: {}", orphans.join(", "));
    }
    println!();
    OK
}

/// Create or repair the environment for one skill, installing only its own pins.
fn provision_env(project: &Path, skill: &str) -> u8 {
    let known = env_skills(project);

    // Validated before it reaches any path join: the name arrives from a command
    // line and ends up naming a directory that pip writes into.
    if !is_skill_dir_name(skill) {
        eprintln!("\nNot a skill directory name: {skill}");
        eprintln!("Skills that need one: {}\n", or_none(&known));
        return FAILED;
    }
    if !project.join(".claude").join("skills").join(skill).exists() {
        eprintln!("\nNo such skill: {skill}");
        eprintln!("Skills that need an environment: {}\n", or_none(&known));
        return FAILED;
    }
    let runtime = read_skill_runtime(project, skill);
    if !known.iter().any(|k| k == skill) {
        eprintln!(
            "\nSkill {skill} declares no {RUNTIME_KEY} and pins no packages, so it needs no environment."
        );
        eprintln!("Skills that need one: {}\n", or_none(&known));
        return FAILED;
    }
    if find_python().is_none() {
        eprintln!("\nNo Python interpreter found in PATH.");
        let wants = runtime.map_or("python".to_string(), |r| r.entries.join(", "));
        eprintln!("{skill} requires {wants}. Install it, then re-run this command.\n");
        return FAILED;
    }

    let Ok(env_dir) = skill_env_dir(project, skill) else {
        return fatal(&format!("Not a skill directory name: {skill}"));
    };
    let req = match read_skill_requirements(project, skill) {
        Ok(req) => req,
        Err(e) => return fatal(&e.to_string()),
    };
    if !req.rejected.is_empty() {
        // Reported and not installed: a line failing package-name validation
        // could be a flag or a URL, either of which turns a pinned install into
        // an arbitrary one.
        let source = req
            .source
            .as_deref()
            .map(|s| rel(project, s))
            .unwrap_or_default();
        eprintln!(
            "\nRejected {} requirement line(s) in {source}:",
            req.rejected.len()
        );
        for line in &req.rejected {
            eprintln!("  {line}");
        }
        eprintln!("\nFix the pin, then re-run. Nothing was installed.\n");
        return FAILED;
    }

    println!("\nEnvironment for {skill}");
    let outcome = match ensure_env(project, &env_dir, &mut |line| println!("{line}")) {
        Ok(outcome) => outcome,
        Err(message) => {
            eprintln!("\n{message}\n");
            return FAILED;
        }
    };
    let state = if outcome.created {
        "created"
    } else if outcome.repaired {
        "repaired"
    } else {
        "already present"
    };
    println!("  \u{2713} {state} {}", rel(project, &env_dir));

    let Some(source) = &req.source else {
        // Standard-library only: an empty environment is the right answer.
        println!(
            "  \u{2713} no requirements file \u{2014} standard library only, nothing to install\n"
        );
        return OK;
    };
    println!("  pins: {} ({})", rel(project, source), req.packages.len());
    if req.packages.is_empty() {
        println!("  \u{2713} requirements file pins nothing\n");
        return OK;
    }
    let results =
        match install_pip_packages(project, &env_dir, &req.packages, &mut |l| println!("{l}")) {
            Ok(results) => results,
            Err(message) => return fatal(&message),
        };
    let failed = results.iter().filter(|r| !r.success).count();
    if failed > 0 {
        eprintln!(
            "\n{failed} of {} package(s) failed to install.\n",
            results.len()
        );
        return FAILED;
    }
    println!(
        "\n  \u{2713} {} package(s) installed into {}\n",
        results.len(),
        rel(project, &env_dir)
    );
    OK
}
