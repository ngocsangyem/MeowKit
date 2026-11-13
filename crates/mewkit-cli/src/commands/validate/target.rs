//! `--target <provider> [dir]`: validating a GENERATED provider tree.
//!
//! Such a tree has no `.claude/`, so this path bypasses that lookup entirely:
//! the two usage refusals, the layout sniff, the "not this target" verdict, and
//! then the profile's own read-only rows from [`mewkit_core::validate`].
use std::path::Path;

use mewkit_core::validate::{TARGET_PROFILES, check_target, detects_target, is_target_profile};

use crate::failure::{FAILED, Failure, USAGE};

use super::ValidateArgs;
use super::report;

/// The provider key is printed as given, which is also each profile's own
/// `name` — so the header reads identically on both CLIs.
pub(super) fn validate_target(
    args: &ValidateArgs,
    target: &str,
    cwd: &Path,
) -> Result<u8, Failure> {
    if args.portable {
        eprintln!("`--target` and `--portable` are mutually exclusive.");
        return Ok(USAGE);
    }
    if !is_target_profile(target) {
        eprintln!(
            "Unknown --target \"{target}\". Known targets: {}.",
            TARGET_PROFILES.join(", ")
        );
        return Ok(USAGE);
    }
    // `path.resolve` on the npm side: absolutized against the working
    // directory and collapsed lexically, so a `./dir` argument prints as the
    // same absolute path on both CLIs.
    let dir = match &args.target_dir {
        Some(given) => mewkit_core::repo_context::lexical_resolve(cwd, given),
        None => cwd.to_path_buf(),
    };
    println!("Validating {target} target: {}", dir.display());
    println!();
    if !detects_target(target, &dir) {
        println!(
            "Not a {target} target (no generated {target} layout found at {}).",
            dir.display()
        );
        return Ok(FAILED);
    }
    report(check_target(target, &dir), args.strict)
}
