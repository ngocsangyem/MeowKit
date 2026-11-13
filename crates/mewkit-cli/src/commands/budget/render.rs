//! The three shapes the cost log is printed in: a table, a monthly aggregate
//! and a live session summary.
//!
//! The column widths are fixed rather than measured, so two runs of the same
//! log line up in a terminal and in a diff. A cell wider than its column is
//! TRUNCATED on the left-aligned side and left intact on the right-aligned
//! one — a clipped token count would be a wrong number, while a clipped task
//! label is still the same label.
use mewkit_core::budget::{
    BudgetRow, LiveBudgetSummary, aggregate_by_month, to_fixed, to_locale_string,
};
use mewkit_core::js_value::js_number_text;

/// `String.prototype.padEnd`, with the npm CLI's truncation on overflow.
fn pad_end(text: &str, len: usize) -> String {
    // UTF-16 units, because that is what `String.length` counts and what the
    // widths were chosen against.
    let units: Vec<u16> = text.encode_utf16().collect();
    if units.len() >= len {
        return String::from_utf16_lossy(&units[..len]);
    }
    format!("{text}{}", " ".repeat(len - units.len()))
}

/// `String.prototype.padStart`: never truncates, so a number stays readable.
fn pad_start(text: &str, len: usize) -> String {
    let width = text.encode_utf16().count();
    if width >= len {
        return text.to_string();
    }
    format!("{}{text}", " ".repeat(len - width))
}

pub fn print_table(rows: &[BudgetRow]) {
    println!(
        "  {}{}{}{}  {}",
        pad_end("Date", 18),
        pad_end("Command", 16),
        pad_end("Tier", 10),
        pad_start("Tokens", 12),
        pad_end("Task", 30)
    );
    println!("  {}", "-".repeat(86));
    for row in rows {
        println!(
            "  {}{}{}{}  {}",
            pad_end(&row.date, 18),
            pad_end(&row.command, 16),
            pad_end(&row.tier, 10),
            pad_start(&to_locale_string(row.tokens), 12),
            pad_end(&row.task, 30)
        );
    }
}

pub fn print_monthly(rows: &[BudgetRow]) {
    println!(
        "  {}{}{}",
        pad_end("Month", 12),
        pad_start("Entries", 10),
        pad_start("Tokens", 14)
    );
    println!("  {}", "-".repeat(36));
    for (month, tokens, count) in aggregate_by_month(rows) {
        println!(
            "  {}{}{}",
            pad_end(&month, 12),
            pad_start(&count.to_string(), 10),
            pad_start(&js_number_text(tokens), 14)
        );
    }
}

pub fn print_live_session_summary(session_id: &str, summary: &LiveBudgetSummary) {
    println!("Session: {session_id}");
    println!("Mode: live session accumulator");
    println!();
    println!("Input tokens: {}", to_locale_string(summary.input_tokens));
    println!("Output tokens: {}", to_locale_string(summary.output_tokens));
    println!(
        "Total tokens used: {}",
        to_locale_string(summary.total_tokens)
    );
    println!("Human reads: {}", to_locale_string(summary.human_reads));
    println!("Estimated cost: ${}", to_fixed(summary.estimated_cost, 2));
}
