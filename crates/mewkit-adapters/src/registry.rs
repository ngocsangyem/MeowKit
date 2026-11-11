//! Every emitter, listed explicitly. No init-time registration.
use crate::contract::{Emitter, Runtime};

/// Runtimes whose emitter has not been written yet. Each emitter added to
/// [`registry`] must be removed from here; the test below keeps the two
/// lists covering every [`Runtime`] exactly once.
pub const NOT_YET_EMITTED: &[Runtime] = &[];

pub fn registry() -> &'static [&'static dyn Emitter] {
    &[
        &crate::claude_code::ClaudeCode,
        &crate::codex::Codex,
        &crate::cursor::Cursor,
    ]
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
