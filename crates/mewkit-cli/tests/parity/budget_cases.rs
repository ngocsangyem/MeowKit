//! `budget` against both CLIs: every flag, and every way the verb can refuse.
//!
//! Two readers share one verb here — the durable cost log and the live session
//! accumulator the budget hook writes — and the numbers are what a user acts
//! on, so the comparison is of BYTES: a column that pads differently or a USD
//! amount that rounds the other way is a real defect, not cosmetics.
//!
//! One module per thing being compared: selecting entries from the log, the
//! live accumulator that replaces them, what is said when there is nothing to
//! report, and the per-profile context estimate.
mod context_cases;
mod cost_log_cases;
mod live_session_cases;
mod refusal_cases;

/// The npm CLI renders help from its command catalogue and this one from clap.
pub(crate) const OWN_HELP: &str = "help text is rendered by each CLI's own parser";
/// Two JSON parsers word a syntax error differently; the refusal AROUND it, its
/// exit code and the fact that nothing is reported are what the cases pin.
pub(crate) const OWN_JSON_ERROR: &str = "each engine's JSON parser words its own syntax error";
