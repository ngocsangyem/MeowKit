//! Per-runtime adapters for the `mewkit-next` installer.
//!
//! Each runtime the kit installs into gets one [`Emitter`] here, built on
//! `mewkit-core` and listed in [`registry`].
#![forbid(unsafe_code)]

pub mod claude_code;
pub mod codex;
pub mod contract;
mod kit_files;
pub mod registry;
mod report_gate;
mod strip;

pub use contract::{EmitError, EmitRequest, Emitter, Runtime, Scope, ScopeKind};
pub use registry::{emitter, registry};
