//! What `mewkit budget` reads and computes: the cost log, the live session
//! accumulator, and the per-profile context estimate.
//!
//! The USD figure is NOT computed here. The PostToolUse budget hook accumulates
//! it into `budget-state.json` as the session runs; this crate reports the
//! number the hook wrote, so the CLI and the hook can never disagree about what
//! a session cost.
pub mod context_report;
pub mod cost_log;
pub mod number_format;
pub mod profile_paths;
pub mod rows;

pub use context_report::{
    ContextBudgetReport, ContextTier, TIER_ORDER, TierAggregate, classify_tier,
    compute_context_budget,
};
pub use cost_log::{
    CostLogError, cost_log_candidate, find_cost_log, live_budget_state_file,
    project_root_from_cost_log, read_cost_log, read_live_budget_state, resolve_current_session_id,
};
pub use number_format::{to_fixed, to_locale_string};
pub use profile_paths::resolve_profile;
pub use rows::{
    BudgetRow, LiveBudgetSummary, aggregate_by_month, coerce_number, filter_budget_entries,
    summarize_live_budget_state, to_budget_row, total_tokens_text,
};

#[cfg(test)]
#[path = "budget_tests.rs"]
mod budget_tests;
