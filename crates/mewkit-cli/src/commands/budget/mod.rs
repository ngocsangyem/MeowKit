//! `budget` — token spend from the cost log, and `budget context` — what a
//! profile costs to load.
//!
//! Two readers over one verb: the cost log is a durable record several writers
//! append to, and the live `budget-state.json` is the accumulator the budget
//! hook keeps for the session in progress. The live one WINS when the run is
//! the current session and the day filter allows it, because a session's own
//! spend is not in the log until it ends.
mod context;
mod filters;
mod render;

use std::path::Path;

use clap::Args;
use mewkit_core::budget::{
    cost_log_candidate, filter_budget_entries, find_cost_log, live_budget_state_file,
    project_root_from_cost_log, read_cost_log, read_live_budget_state, resolve_current_session_id,
    summarize_live_budget_state, to_budget_row, total_tokens_text,
};
use mewkit_core::time_utc::{now_millis, utc_date};

use filters::{normalize_flag_value, resolve_day_filter};

use crate::failure::{FAILED, Failure, OK, USAGE};

/// The rows the table shows when no filter narrows the log further.
const RECENT_ROWS: usize = 10;

const SUBCOMMANDS: [&str; 1] = ["context"];

#[derive(Args, Debug)]
pub struct BudgetArgs {
    /// `context` estimates a profile's load size; omitted reads the cost log.
    pub subcommand: Option<String>,
    /// Aggregate by month instead of the last ten entries.
    #[arg(long)]
    pub monthly: bool,
    /// Filter to the current session, or to a specific session id.
    #[arg(long)]
    pub session: Option<String>,
    /// Filter to today, or to a specific YYYY-MM-DD.
    #[arg(long)]
    pub day: Option<String>,
    /// `context`: estimate one profile instead of all of them.
    #[arg(long)]
    pub profile: Option<String>,
    /// `context`: exit non-zero when a profile exceeds N tokens.
    #[arg(long = "fail-over")]
    pub fail_over: Option<String>,
    /// `context`: print the reports as JSON.
    #[arg(long)]
    pub json: bool,
}

pub fn run(args: &BudgetArgs) -> Result<u8, Failure> {
    // Classified before anything runs, the way the npm CLI's dispatcher does:
    // a mistyped sub-verb is an invocation error, never a silent fall-through
    // to the cost-log report it did not ask for.
    if let Some(sub) = args
        .subcommand
        .as_deref()
        .filter(|sub| !SUBCOMMANDS.contains(sub))
    {
        eprintln!("Unknown `budget` subcommand: {sub}");
        eprintln!("Valid subcommands: {}", SUBCOMMANDS.join(", "));
        eprintln!("Run `mewkit budget --help` for usage.");
        return Ok(USAGE);
    }
    let cwd = std::env::current_dir()?;
    if args.subcommand.as_deref() == Some("context") {
        return context::run(&cwd, args);
    }
    report_cost_log(&cwd, args)
}

fn report_cost_log(cwd: &Path, args: &BudgetArgs) -> Result<u8, Failure> {
    println!("Token Budget & Cost Log");
    println!();

    let log_path = find_cost_log(cwd);
    let project_root = log_path
        .as_deref()
        .map_or_else(|| cwd.to_path_buf(), project_root_from_cost_log);
    let hook_session = std::env::var("HOOK_SESSION_ID").ok();
    let current_session_id = resolve_current_session_id(&project_root, hook_session.as_deref());
    let session_flag = normalize_flag_value(args.session.as_deref());
    let session_id = match &session_flag {
        None => None,
        Some(flag) if !flag.is_empty() => Some(flag.clone()),
        Some(_) => current_session_id.clone(),
    };
    let day_filter = match resolve_day_filter(args.day.as_deref()) {
        Ok(day) => day,
        Err(message) => {
            eprintln!("{message}");
            return Ok(FAILED);
        }
    };

    let is_current_session = session_id.is_some() && session_id == current_session_id;
    let live_state = is_current_session
        .then(|| read_live_budget_state(&project_root))
        .flatten();
    let today = utc_date(now_millis());
    let live_state_matches_day = day_filter.as_deref().is_none_or(|day| day == today);

    if session_flag.is_some() && session_id.is_none() {
        eprintln!("Could not determine the current session id.");
        println!("Expected HOOK_SESSION_ID or a last-session-id marker in .meowkit/state/.");
        return Ok(FAILED);
    }

    if let Some(state) = live_state.filter(|_| live_state_matches_day) {
        if let Some(path) = &log_path {
            println!("Source: {}", path.display());
        }
        println!(
            "Live state: {}",
            live_budget_state_file(&project_root).display()
        );
        println!();
        if let Some(day) = &day_filter {
            println!("Day: {day}");
            println!();
        }
        render::print_live_session_summary(
            session_id.as_deref().unwrap_or_default(),
            &summarize_live_budget_state(&state),
        );
        return Ok(OK);
    }

    let Some(log_path) = log_path else {
        return Ok(no_cost_log(cwd));
    };
    println!("Source: {}", log_path.display());
    println!();

    let entries = match read_cost_log(&log_path) {
        Ok(entries) => entries,
        Err(error) => {
            eprintln!("Failed to read cost log: {error}");
            return Ok(FAILED);
        }
    };
    if entries.is_empty() {
        println!("No cost entries recorded yet.");
        return Ok(OK);
    }

    let filtered = filter_budget_entries(&entries, session_id.as_deref(), day_filter.as_deref());
    if let Some(session) = &session_id {
        println!("Session: {session}");
    }
    if let Some(day) = &day_filter {
        println!("Day: {day}");
    }
    if session_id.is_some() || day_filter.is_some() {
        println!();
    }
    if filtered.is_empty() {
        println!("No cost entries matched the selected filters.");
        return Ok(OK);
    }

    let rows: Vec<_> = filtered.into_iter().map(to_budget_row).collect();
    if args.monthly {
        render::print_monthly(&rows);
    } else {
        if rows.len() > RECENT_ROWS {
            println!("Showing last {RECENT_ROWS} of {} entries", rows.len());
            println!();
        }
        render::print_table(&rows[rows.len().saturating_sub(RECENT_ROWS)..]);
    }
    println!();
    println!("Total estimated tokens: {}", total_tokens_text(&rows));
    Ok(OK)
}

/// The refusal names the path the SEARCH looked for, from the same function the
/// search uses, so the user is not sent to a file nothing ever reads.
fn no_cost_log(cwd: &Path) -> u8 {
    eprintln!(
        "No cost log found. Looked for {} and in each parent directory.",
        cost_log_candidate(cwd).display()
    );
    println!(
        "Run a MeowKit agent command first; the cost log is written as sessions record usage."
    );
    FAILED
}
