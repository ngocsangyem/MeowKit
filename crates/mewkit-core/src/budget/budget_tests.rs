//! Unit cover for the parts a parity fixture cannot reach cheaply: the number
//! spellings (a tie, a group boundary) and the row fallbacks across the two
//! generations of cost-log entry.
use serde_json::json;

use super::context_report::{ContextTier, classify_tier};
use super::number_format::{to_fixed, to_locale_string};
use super::rows::{
    BudgetRow, aggregate_by_month, coerce_number, filter_budget_entries,
    summarize_live_budget_state, to_budget_row,
};
use crate::js_value::js_number_text;

#[test]
fn locale_grouping_matches_the_default_number_format() {
    assert_eq!(to_locale_string(0.0), "0");
    assert_eq!(to_locale_string(999.0), "999");
    assert_eq!(to_locale_string(1000.0), "1,000");
    assert_eq!(to_locale_string(1_234_567.0), "1,234,567");
    assert_eq!(to_locale_string(-1234.0), "-1,234");
    // At most three fraction digits, and trailing zeros are not printed.
    assert_eq!(to_locale_string(1234.5), "1,234.5");
    assert_eq!(to_locale_string(1234.5678), "1,234.568");
    assert_eq!(to_locale_string(0.0001), "0");
}

#[test]
fn to_fixed_rounds_a_tie_away_from_zero() {
    // The half-to-even formatter says 0.12 here; `toFixed` says 0.13.
    assert_eq!(to_fixed(0.125, 2), "0.13");
    assert_eq!(to_fixed(0.0, 2), "0.00");
    assert_eq!(to_fixed(1.005, 2), "1.00"); // the stored double is just under
    assert_eq!(to_fixed(2.675, 2), "2.67"); // likewise
    assert_eq!(to_fixed(9.999, 2), "10.00"); // the carry grows the whole part
    assert_eq!(to_fixed(-0.001, 2), "-0.00");
    assert_eq!(to_fixed(12.3, 2), "12.30");
}

#[test]
fn string_conversion_switches_to_an_exponent_where_javascript_does() {
    assert_eq!(js_number_text(0.0), "0");
    assert_eq!(js_number_text(-0.0), "0");
    assert_eq!(js_number_text(42.0), "42");
    assert_eq!(js_number_text(0.5), "0.5");
    assert_eq!(js_number_text(1e21), "1e+21");
    assert_eq!(js_number_text(1e-7), "1e-7");
}

#[test]
fn a_field_is_coerced_the_way_number_coerces_it() {
    assert_eq!(coerce_number(Some(&json!(12))), 12.0);
    assert_eq!(coerce_number(Some(&json!("12"))), 12.0);
    assert_eq!(coerce_number(Some(&json!(" 12 "))), 12.0);
    assert_eq!(coerce_number(Some(&json!(""))), 0.0);
    assert_eq!(coerce_number(Some(&json!("nope"))), 0.0);
    assert_eq!(coerce_number(Some(&json!(true))), 0.0);
    assert_eq!(coerce_number(None), 0.0);
}

#[test]
fn a_legacy_entry_keeps_its_own_labels() {
    let row = to_budget_row(&json!({
        "date": "2026-11-12T09:00:00Z",
        "command": "cook",
        "tier": "STANDARD",
        "estimated_tokens": 4200,
        "task": "port the budget verb",
    }));
    assert_eq!(
        row,
        BudgetRow {
            date: "2026-11-12T09:00:00Z".to_string(),
            command: "cook".to_string(),
            tier: "STANDARD".to_string(),
            tokens: 4200.0,
            task: "port the budget verb".to_string(),
        }
    );
}

#[test]
fn a_session_entry_sums_its_four_token_fields_and_names_itself() {
    let row = to_budget_row(&json!({
        "date": "2026-11-12T10:00:00Z",
        "session_id": "abc123",
        "model": "opus",
        "tokens_in": 10,
        "tokens_out": "20",
        "cache_write_tokens": 3,
        "cache_read_tokens": 7,
    }));
    assert_eq!(row.command, "session");
    assert_eq!(row.tier, "opus");
    assert_eq!(row.tokens, 40.0);
    assert_eq!(row.task, "session abc123");
}

#[test]
fn an_entry_with_nothing_to_name_it_falls_all_the_way_through() {
    let row = to_budget_row(&json!({ "date": "2026-11-12T10:00:00Z" }));
    assert_eq!(row.command, "session");
    assert_eq!(row.tier, "unknown");
    assert_eq!(row.task, "session snapshot");
    assert_eq!(row.tokens, 0.0);
}

/// A legacy count wins only when it is positive; a zero falls through to the
/// session fields, so an entry carrying both is not reported as costing zero.
#[test]
fn a_zero_legacy_count_defers_to_the_session_fields() {
    let row = to_budget_row(&json!({
        "date": "2026-11-12T10:00:00Z",
        "estimated_tokens": 0,
        "tokens_in": 5,
    }));
    assert_eq!(row.tokens, 5.0);
}

#[test]
fn filters_select_by_session_and_by_day() {
    let entries = vec![
        json!({ "date": "2026-11-11T10:00:00Z", "session_id": "a" }),
        json!({ "date": "2026-11-12T10:00:00Z", "session_id": "b" }),
        json!({ "date": "2026-11-12T11:00:00Z" }),
    ];
    assert_eq!(filter_budget_entries(&entries, Some("b"), None).len(), 1);
    assert_eq!(
        filter_budget_entries(&entries, None, Some("2026-11-12")).len(),
        2
    );
    assert_eq!(
        filter_budget_entries(&entries, Some("b"), Some("2026-11-11")).len(),
        0
    );
    assert_eq!(filter_budget_entries(&entries, None, None).len(), 3);
}

#[test]
fn months_aggregate_in_first_seen_order() {
    let rows = vec![
        BudgetRow {
            date: "2026-11-12".into(),
            command: "a".into(),
            tier: "t".into(),
            tokens: 10.0,
            task: "x".into(),
        },
        BudgetRow {
            date: "2026-10-01".into(),
            command: "b".into(),
            tier: "t".into(),
            tokens: 5.0,
            task: "y".into(),
        },
        BudgetRow {
            date: "2026-11-30".into(),
            command: "c".into(),
            tier: "t".into(),
            tokens: 7.0,
            task: "z".into(),
        },
    ];
    assert_eq!(
        aggregate_by_month(&rows),
        vec![
            ("2026-11".to_string(), 17.0, 2),
            ("2026-10".to_string(), 5.0, 1),
        ]
    );
}

#[test]
fn the_live_summary_adds_input_and_output() {
    let summary = summarize_live_budget_state(&json!({
        "estimated_input_tokens": 1200,
        "estimated_output_tokens": "800",
        "estimated_cost_usd": 0.42,
        "turn_count": 9,
    }));
    assert_eq!(summary.total_tokens, 2000.0);
    assert_eq!(summary.human_reads, 9.0);
    assert_eq!(summary.estimated_cost, 0.42);
}

#[test]
fn only_loadable_entrypoints_carry_a_tier() {
    assert_eq!(classify_tier("rules/core.md"), Some(ContextTier::AlwaysOn));
    assert_eq!(
        classify_tier("rules-conditional/agile.md"),
        Some(ContextTier::Conditional)
    );
    assert_eq!(
        classify_tier("agents/planner.md"),
        Some(ContextTier::OnDemand)
    );
    assert_eq!(classify_tier("agents/_INDEX.md"), None);
    assert_eq!(
        classify_tier("commands/mk/plan.md"),
        Some(ContextTier::OnDemand)
    );
    assert_eq!(
        classify_tier("skills/cook/SKILL.md"),
        Some(ContextTier::OnDemand)
    );
    assert_eq!(classify_tier("skills/cook/references/rules.md"), None);
    assert_eq!(classify_tier("rules/.md"), None);
    assert_eq!(classify_tier("hooks/dispatch.cjs"), None);
}
