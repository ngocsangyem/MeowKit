//! `setup` — guided post-scaffold configuration: the `skill-envs`, `mcp`, `env`,
//! `gitignore` and `project-context` steps, or the system-dependency installer.
//!
//! ## What is shared with the npm CLI on purpose
//!
//! Steps and their wording come from [`mewkit_core::setup`]. `--json` prints one
//! mutation envelope on stdout and sends all narration to stderr, so a pipe
//! receives the envelope and nothing else.
//!
//! ## The one flag the npm CLI does not have
//!
//! The system-dependency install asks "Install missing system dependencies?".
//! The npm CLI has no flag that answers it (and crashes on a piped stdin), so a
//! non-terminal run could never proceed. `--yes` answers it here; without a
//! terminal and without `--yes` the run stops and names the flag.
mod envelope;
mod system_deps_flow;

use clap::{ArgAction, Args};
use mewkit_core::setup::{
    PlannedChange, STEP_NAMES, StepOptions, StepResult, StepStatus, run_step,
};

use crate::failure::{FAILED, Failure, OK};
use envelope::Envelope;

#[derive(Args, Debug)]
pub struct SetupArgs {
    /// Run a single setup step.
    #[arg(long, action = ArgAction::Append)]
    pub only: Vec<String>,
    /// Install system-level dependencies.
    #[arg(long = "system-deps")]
    pub system_deps: bool,
    /// Comma-separated skills whose interpreter environment setup should create.
    #[arg(long, action = ArgAction::Append)]
    pub skills: Vec<String>,
    /// Print what would happen without writing.
    #[arg(long = "dry-run")]
    pub dry_run: bool,
    /// Emit machine-readable JSON.
    #[arg(long)]
    pub json: bool,
    /// Answer the system-dependency prompt affirmatively.
    #[arg(long)]
    pub yes: bool,
}

/// Where narration goes: stdout, or stderr while a JSON envelope owns stdout.
#[derive(Clone, Copy)]
pub(crate) struct Out {
    to_stderr: bool,
}

impl Out {
    pub(crate) fn line(self, text: &str) {
        if self.to_stderr {
            eprintln!("{text}");
        } else {
            println!("{text}");
        }
    }
}

fn icon(status: StepStatus) -> &'static str {
    match status {
        StepStatus::Pass => "\u{2713}",
        StepStatus::Skip => "\u{25cb}",
        StepStatus::Warn => "!",
        StepStatus::Fail => "\u{2717}",
    }
}

fn status_word(status: StepStatus) -> &'static str {
    match status {
        StepStatus::Pass => "pass",
        StepStatus::Skip => "skip",
        StepStatus::Warn => "warn",
        StepStatus::Fail => "fail",
    }
}

fn joined(values: &[String]) -> String {
    values.join(",")
}

pub fn run(args: &SetupArgs) -> Result<u8, Failure> {
    let out = Out {
        to_stderr: args.json,
    };
    let mut report = Envelope::new(args.dry_run);

    if args.system_deps {
        out.line("\nMeowKit Setup \u{2014} System Dependencies\n");
        if args.dry_run {
            // The installers are package managers writing outside the project; a
            // preview of them is a list this command cannot honestly produce, so
            // it says what it did not do rather than print a plan it cannot keep.
            let note = "Dry-run: system dependencies are installed by your package manager \u{2014} nothing was run. Drop --dry-run to install.";
            out.line(note);
            report.notes.push(note.to_string());
        } else if !system_deps_flow::run(out, args.yes)? {
            // A cancelled prompt ends the process without an envelope.
            return Ok(OK);
        }
        report.finish(args.json, OK);
        return Ok(OK);
    }

    // Always the working directory: no walk-up, so `~/.claude` or a parent
    // project is never matched by accident.
    let dir = std::env::current_dir()?;
    // Opt-in: with no --skills the environment step creates nothing.
    let skills: Vec<String> = joined(&args.skills)
        .split(',')
        .map(|s| {
            s.trim_matches(mewkit_core::js_regex::is_js_whitespace)
                .to_string()
        })
        .filter(|s| !s.is_empty())
        .collect();
    let only = joined(&args.only);
    let steps: Vec<&str> = if only.is_empty() {
        STEP_NAMES.to_vec()
    } else {
        vec![only.as_str()]
    };

    out.line(if args.dry_run {
        "\nMeowKit Setup \u{2014} dry run, nothing will be written\n"
    } else {
        "\nMeowKit Setup\n"
    });

    let options = StepOptions {
        skills: &skills,
        dry_run: args.dry_run,
    };
    let mut results: Vec<StepResult> = Vec::new();
    for name in steps {
        let say = &mut |line: &str| out.line(line);
        let Some(outcome) = run_step(name, &dir, &options, say) else {
            let error = format!("Unknown step: {name}. Available: {}", STEP_NAMES.join(", "));
            eprintln!("{error}");
            report.error = Some(error);
            report.fix = Some(format!("Pass one of: {}", STEP_NAMES.join(", ")));
            report.finish(args.json, FAILED);
            return Ok(FAILED);
        };
        let result = match outcome {
            Ok(result) => result,
            Err(message) => {
                eprintln!("Fatal: {message}");
                return Ok(FAILED);
            }
        };
        report.planned.extend(result.changes.iter().cloned());
        if !args.dry_run {
            report.applied.extend(result.changes.iter().cloned());
        }
        report.notes.push(format!(
            "{name}: {} \u{2014} {}",
            status_word(result.status),
            result.message
        ));
        out.line(&format!(
            "  {} {name}: {}",
            icon(result.status),
            result.message
        ));
        for change in &result.changes {
            out.line(&change_line(change, args.dry_run));
        }
        results.push(result);
    }

    let count = |status: StepStatus| results.iter().filter(|r| r.status == status).count();
    let mut parts = vec![
        format!("{} configured", count(StepStatus::Pass)),
        format!("{} skipped", count(StepStatus::Skip)),
    ];
    if count(StepStatus::Warn) > 0 {
        parts.push(format!("{} warnings", count(StepStatus::Warn)));
    }
    if count(StepStatus::Fail) > 0 {
        parts.push(format!("{} failed", count(StepStatus::Fail)));
    }
    out.line(&format!("\n  Summary: {}", parts.join(", ")));

    let code = if count(StepStatus::Fail) > 0 {
        FAILED
    } else {
        OK
    };
    report.finish(args.json, code);
    Ok(code)
}

fn change_line(change: &PlannedChange, dry_run: bool) -> String {
    let detail = change
        .detail
        .as_ref()
        .map_or(String::new(), |d| format!(" ({d})"));
    format!(
        "      {} {} {}{detail}",
        if dry_run { "would" } else { "did" },
        change.action,
        change.path
    )
}
