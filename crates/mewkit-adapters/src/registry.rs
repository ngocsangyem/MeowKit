//! Every emitter, listed explicitly. No init-time registration.
use crate::contract::{Emitter, Runtime};
use crate::retired_eval_pack::WithRetiredEvalPack;

/// Runtimes whose emitter has not been written yet. Each emitter added to
/// [`registry`] must be removed from here; the test below keeps the two
/// lists covering every [`Runtime`] exactly once.
pub const NOT_YET_EMITTED: &[Runtime] = &[];

/// Every emitter removes what the retired eval pack left the same way, so
/// each is wrapped once here rather than taught about it one by one.
pub fn registry() -> &'static [&'static dyn Emitter] {
    &[
        &WithRetiredEvalPack(crate::claude_code::ClaudeCode),
        &WithRetiredEvalPack(crate::codex::Codex),
        &WithRetiredEvalPack(crate::cursor::Cursor),
        &WithRetiredEvalPack(crate::grok::Grok),
        &WithRetiredEvalPack(crate::pi::Pi),
        &WithRetiredEvalPack(crate::omp::Omp),
        &WithRetiredEvalPack(crate::antigravity::Antigravity),
    ]
}

/// The runtimes that can be installed today, in registry order.
pub fn emitted() -> Vec<Runtime> {
    registry().iter().map(|e| e.target()).collect()
}

/// The emitter for `runtime`, if it has one yet.
pub fn emitter(runtime: Runtime) -> Option<&'static dyn Emitter> {
    registry().iter().copied().find(|e| e.target() == runtime)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_runtime_is_registered_or_pending_exactly_once() {
        let mut seen: Vec<Runtime> = registry().iter().map(|e| e.target()).collect();
        seen.extend_from_slice(NOT_YET_EMITTED);
        seen.sort();
        assert_eq!(
            seen,
            Runtime::ALL,
            "each Runtime needs exactly one emitter or a pending entry"
        );
    }

    #[test]
    fn target_names_round_trip() {
        for r in Runtime::ALL {
            assert_eq!(Runtime::from_name(r.name()), Some(r));
        }
        assert_eq!(Runtime::from_name("vscode"), None);
    }
}
