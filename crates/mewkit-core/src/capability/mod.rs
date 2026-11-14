//! The model-agnostic capability manifest, how it resolves an intent, and the
//! per-provider adapter tables everything about a provider is derived from.
//!
//! Provider facts live in one place (`projection`, `lifecycle`, `invocation`)
//! so `capabilities` and `providers --lifecycle` cannot disagree about what a
//! host supports.
pub mod adapter;
pub mod authored;
pub mod bootstrap;
pub mod entry;
pub mod invocation;
pub mod lifecycle;
pub mod manifest;
pub mod projection;
pub mod resolve;

#[cfg(test)]
#[path = "capability_tests.rs"]
mod capability_tests;
