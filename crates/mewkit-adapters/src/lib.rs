//! Per-runtime adapters for the `mewkit` installer.
//!
//! Each runtime the kit installs into gets one [`Emitter`] here, built on
//! `mewkit-core` and listed in [`registry`].
#![forbid(unsafe_code)]

pub mod agents_block;
pub mod agents_tree;
pub mod antigravity;
pub mod claude_code;
pub mod codex;
pub mod contract;
pub mod cursor;
pub mod eval_pack;
pub mod grok;
pub mod hook_coverage;
mod kit_files;
pub mod omp;
pub mod pi;
pub mod placement_resolver;
pub mod projected_kit;
pub mod projection;
pub mod registry;
mod report_gate;
mod scope;
mod strip;
pub mod surface_doc;
pub mod surface_table;

pub use contract::{EmitError, EmitRequest, Emitter, Runtime, Scope, ScopeKind};
pub use registry::{emitter, registry};
