//! `budget context` — what one or every install profile costs to LOAD.
//!
//! The CI guardrail behind "core stays small and auditable": `--fail-over N`
//! turns an oversized profile into a non-zero exit, so a profile cannot grow
//! past its budget without someone deciding to let it.
use std::path::Path;

use mewkit_core::budget::{
    ContextBudgetReport, TIER_ORDER, compute_context_budget, to_locale_string,
};
use mewkit_core::js_value::js_number_text;
use mewkit_core::validate::{has_pack_manifest, load_pack_manifest};

use crate::failure::{FAILED, Failure, OK};

use super::BudgetArgs;

/// `padCell`: pad to a width, and leave a wider cell alone — a clipped count
/// would be a wrong number.
fn pad_cell(text: &str, width: usize) -> String {
    let len = text.encode_utf16().count();
    if len >= width {
        return text.to_string();
    }
    format!("{text}{}", " ".repeat(width - len))
}

pub fn run(cwd: &Path, args: &BudgetArgs) -> Result<u8, Failure> {
    // The npm CLI validates `--fail-over` in its dispatcher, before the command
    // runs, so a bad threshold is an INVOCATION error even in a project that
    // has no manifest to report on.
    let fail_over = match args.fail_over.as_deref() {
        None => None,
        Some(raw) => match mewkit_core::js_number::js_number(raw).and_then(|n| n.as_f64()) {
            Some(value) => Some(value),
            None => {
                eprintln!("Invalid --fail-over value: {raw} (expected a number)");
                return Ok(crate::failure::USAGE);
            }
        },
    };

    let claude_dir = cwd.join(".claude");
    if !has_pack_manifest(&claude_dir) {
        eprintln!(
            "Context budget requires .claude/pack-manifest.json — run `mewkit upgrade` first."
        );
        return Ok(FAILED);
    }
    let manifest = match load_pack_manifest(&claude_dir) {
        Ok(manifest) => manifest,
        Err(error) => return Ok(fatal(&error.to_string())),
    };
    let available = manifest.available_profiles();
    let selected = args.profile.as_deref().filter(|name| !name.is_empty());
    if let Some(name) = selected
        && !available.contains(&name)
    {
        eprintln!(
            "Unknown profile \"{name}\". Available: {}",
            available.join(", ")
        );
        return Ok(FAILED);
    }
    let profiles: Vec<&str> = match selected {
        Some(name) => vec![name],
        None => available,
    };
    let mut reports = Vec::new();
    for profile in profiles {
        match compute_context_budget(&claude_dir, &manifest, profile) {
            Ok(report) => reports.push(report),
            Err(error) => return Ok(fatal(&error.to_string())),
        }
    }

    if args.json {
        let documents: Vec<serde_json::Value> =
            reports.iter().map(ContextBudgetReport::to_json).collect();
        println!(
            "{}",
            serde_json::to_string_pretty(&documents).unwrap_or_else(|_| "[]".to_string())
        );
    } else {
        print_reports(&reports);
    }

    if let Some(threshold) = fail_over {
        let over: Vec<String> = reports
            .iter()
            .filter(|report| report.tokens as f64 > threshold)
            .map(|report| format!("{}={}", report.profile, report.tokens))
            .collect();
        if !over.is_empty() {
            println!();
            println!(
                "Over --fail-over {}: {}",
                js_number_text(threshold),
                over.join(", ")
            );
            return Ok(FAILED);
        }
    }
    Ok(OK)
}

/// An unhandled error in the npm CLI reaches its top-level catch, which prints
/// one `Fatal:` line and exits 1.
fn fatal(message: &str) -> u8 {
    eprintln!("Fatal: {message}");
    FAILED
}

fn print_reports(reports: &[ContextBudgetReport]) {
    println!("Context budget");
    println!(
        "Tiers: always-on (rules) · conditional (loaded only on detection) · on-demand (agents + commands + SKILL.md)."
    );
    println!();
    for report in reports {
        println!("  {}", report.profile);
        println!(
            "    {} {} {} ~TOKENS",
            pad_cell("TIER", 12),
            pad_cell("FILES", 7),
            pad_cell("LINES", 9)
        );
        for tier in TIER_ORDER {
            let aggregate = report.tier(tier);
            println!(
                "    {} {} {} {}",
                pad_cell(tier.as_str(), 12),
                pad_cell(&aggregate.files.to_string(), 7),
                pad_cell(&aggregate.lines.to_string(), 9),
                to_locale_string(aggregate.tokens as f64)
            );
        }
        println!(
            "    {} {} {} {}",
            pad_cell("total", 12),
            pad_cell(&report.files.to_string(), 7),
            pad_cell(&report.lines.to_string(), 9),
            to_locale_string(report.tokens as f64)
        );
        println!();
    }
}
