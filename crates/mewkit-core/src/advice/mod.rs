//! Bounded supervision checkpoints — the core half of `mewkit advice`.
//!
//! A skill decides WHEN a checkpoint fires; this decides whether it MAY. Cap
//! accounting, stage legality, idempotency and the durable record all live here,
//! where a skill body cannot talk its way past them.
//!
//! **Nothing here approves anything.** `begin` may refuse a call and `commit`
//! may refuse a disposition, but no path advances a gate, no artifact carries an
//! approval field, and a disposition is recorded verbatim alongside the parent's
//! own outcome. `READY_FOR_EXISTING_GATE` means the normal reviewer or gate is
//! the correct NEXT step — never that one is cleared. The dossier schema refuses
//! `approval`, `approved`, `gate1`, `gate2`, `verdict` and `status` outright, so
//! "the dossier says approved" is unwritable rather than merely discouraged.
//!
//! The layers: [`protocol`] decides budgets, [`mode`] the route, [`wire`] the
//! spellings both use, [`store`] the durable continuity record, [`receipt_doc`]
//! the human record, [`evidence`] the workflow index a returned correction
//! supersedes, [`packet_issues`] the shape refusals, and [`paths`] the boundary
//! the two caller-supplied paths must stay inside.

pub mod evidence;
pub mod mode;
pub mod packet_issues;
pub mod paths;
pub mod protocol;
pub mod receipt_doc;
pub mod store;
pub mod wire;
mod zod_issues;
