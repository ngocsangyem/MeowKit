//! `verdict-gate <slug | path>` — the Gate 2 paperwork check over the verdict
//! JSON. Exit 0 when the verdict does not stop a ship (PASS, PASS_WITH_RISK or
//! a tolerated markdown-only verdict), 1 when it does, 2 without a target.
//!
//! A pass is evidence for the human at Gate 2, not the approval; this command
//! writes nothing. The check itself is [`mewkit_core::verdict_gate`].
use clap::Args;
use mewkit_core::verdict_gate::{GateStatus, evaluate};

use crate::failure::{FAILED, Failure, OK, USAGE};

#[derive(Args, Debug)]
pub struct VerdictGateArgs {
    /// A review slug, or a path to the verdict `.json` (or its `.md` sibling).
    //
    // Optional to clap so a missing target is the command's own usage line and
    // exit 2, worded as the npm CLI words it.
    #[arg(value_name = "slug | path")]
    pub target: Option<String>,
}

pub fn run(args: &VerdictGateArgs) -> Result<u8, Failure> {
    let Some(target) = args.target.as_deref().filter(|t| !t.is_empty()) else {
        eprintln!("Usage: mewkit verdict-gate <slug | path-to-verdict.json>");
        return Ok(USAGE);
    };

    let result = evaluate(target);
    if result.ok {
        if result.status == GateStatus::LegacyMd {
            println!("⚠ verdict-gate: {}", result.errors[0]);
        } else {
            println!(
                "✓ verdict-gate: {} — ship may proceed.",
                result.decision.as_deref().unwrap_or_default()
            );
        }
        return Ok(OK);
    }

    eprintln!("✗ verdict-gate blocked ({}):", result.status.label());
    for error in &result.errors {
        eprintln!("  {error}");
    }
    Ok(FAILED)
}
