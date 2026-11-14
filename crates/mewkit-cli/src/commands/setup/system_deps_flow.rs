//! `setup --system-deps`: show what is present, offer what is missing, install
//! on a yes.
use mewkit_core::system_deps::{
    SYSTEM_DEPS, install_single_dep, is_dep_present, offerable_deps, skill_declared_deps,
};

use super::Out;
use crate::failure::Failure;
use crate::prompt::{self, Ask, Flag, PromptError};

/// `Ok(false)` when the person cancelled the prompt, which ends the run.
pub(super) fn run(out: Out, yes: bool) -> Result<bool, Failure> {
    let project = std::env::current_dir()?;

    // Which keys the project's skills declare: the allowlist gate for deps
    // that live in a skill's environment.
    let declared = skill_declared_deps(&project, &mut |warning| eprintln!("{warning}"));

    out.line("\nChecking system dependencies...");
    for dep in &SYSTEM_DEPS {
        let present = is_dep_present(dep);
        // `Math.round`: halves go up.
        let size_mb = (dep.size_bytes + 500_000) / 1_000_000;
        out.line(&format!(
            "  {} {} (~{size_mb}MB){}",
            if present { "\u{2713}" } else { "\u{2717}" },
            dep.name,
            if present {
                " \u{2014} already installed"
            } else {
                " \u{2014} not found"
            }
        ));
    }

    let offerable = offerable_deps(&declared);
    if offerable.is_empty() {
        return Ok(true);
    }

    let confirmed = if yes {
        true
    } else {
        let ask = Ask::new("Install missing system dependencies?", Flag::new("--yes"));
        match prompt::default_prompt().confirm(&ask, false) {
            Ok(answer) => answer,
            Err(PromptError::Cancelled { .. }) => {
                out.line("\u{2514}  Setup cancelled.");
                return Ok(false);
            }
            Err(other) => return Err(other.into()),
        }
    };

    if confirmed {
        for dep in offerable {
            install_single_dep(dep, &project, &mut |line| out.line(line));
        }
    } else {
        out.line("\n  \u{26a0} Skipped. Install later with: npx mewkit setup --system-deps");
        out.line("    Run npx mewkit doctor to check what's missing.");
    }
    Ok(true)
}
