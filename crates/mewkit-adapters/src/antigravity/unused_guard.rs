//! What Antigravity leaves out of the shared `.agents/meowkit/hooks/` folder.
//!
//! That folder holds `guard.cjs`, the script the Pi extension and the OMP hook
//! module run, with its runtime config and libraries. Antigravity runs its own
//! guards from `.agents/meowkit-antigravity/hooks`, so when it is the only
//! runtime writing the `.agents/` tree, the guard has no reader. Only the
//! hook files that other installed text names by path are kept (skill scripts
//! load `lib/project-root.cjs` from there).
//!
//! Beside Pi or OMP the shared tree is written whole, so their guard keeps
//! working.
use crate::contract::{Op, Plan};

/// The shared hook folder, relative to the project root.
pub const HOOKS: &str = ".agents/meowkit/hooks/";

/// The passage in the shared tree that names Pi's and OMP's guard, and what
/// it says when Antigravity reads it alone.
const GUARD_MENTION: (&str, &str) = (
    "`.agents/meowkit/hooks/guard.cjs`",
    "`.agents/meowkit-antigravity/hooks/privacy-block.cjs`",
);

/// Point the guard mention at Antigravity's own privacy hook, then drop every
/// shared hook file no other planned file names.
pub fn drop_from(plan: &mut Plan) {
    for op in &mut plan.ops {
        if let Op::WriteFile { path, bytes, .. } = op
            && !path.as_str().starts_with(HOOKS)
            && let Ok(text) = std::str::from_utf8(bytes)
            && text.contains(GUARD_MENTION.0)
        {
            *bytes = text.replace(GUARD_MENTION.0, GUARD_MENTION.1).into_bytes();
        }
    }
    let texts: Vec<String> = plan
        .ops
        .iter()
        .filter_map(|op| match op {
            Op::WriteFile { path, bytes, .. } if !path.as_str().starts_with(HOOKS) => {
                std::str::from_utf8(bytes).ok().map(str::to_owned)
            }
            _ => None,
        })
        .collect();
    plan.ops.retain(|op| match op {
        Op::WriteFile { path, .. } => match path.as_str().strip_prefix(".agents/") {
            // `meowkit/hooks/lib/x.cjs` matches both the absolute form and a
            // script's relative `../../../meowkit/hooks/lib/x.cjs`.
            Some(tail) if path.as_str().starts_with(HOOKS) => {
                texts.iter().any(|t| t.contains(tail))
            }
            _ => true,
        },
        _ => true,
    });
}
