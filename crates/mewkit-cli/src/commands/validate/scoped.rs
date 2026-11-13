//! Which single check a scoping flag asks for.
//!
//! The chain below mirrors the npm CLI's `else if` chain exactly, including
//! what it does with TWO scoping flags at once: the first one wins rather than
//! the invocation being refused.
use std::path::Path;

use mewkit_core::validate::{
    CheckResult, NotPorted, Status, check_agent_conformance, check_capabilities_section,
    check_docs_refs_contract, check_frontmatter_contract, check_gate_authority, check_ownership,
    check_packs, check_routing_table_breadth, check_substrate, check_workflow_drift,
};

use crate::failure::Failure;

use super::ValidateArgs;

/// A single-check run, when one of the scoping flags was passed. `None` means
/// no flag scoped the run, so the default set applies.
pub(super) fn scoped_run(
    args: &ValidateArgs,
    meowkit_dir: &Path,
    project_root: &Path,
) -> Result<Option<Vec<CheckResult>>, NotPorted> {
    // The order mirrors the npm CLI's `else if` chain: two scoping flags at
    // once resolve to the FIRST one, rather than being refused.
    if args.workflow {
        // Strict in a scoped run: an absent spec is a FAIL for the CI step.
        return Ok(Some(check_workflow_drift(project_root, Status::Fail)));
    }
    if args.gates {
        // Strict in a scoped run, as the CI step needs: an absent scan target
        // is a FAIL, not a WARN.
        return Ok(Some(check_gate_authority(
            project_root,
            &[".claude"],
            Status::Fail,
        )));
    }
    if args.ownership {
        return Ok(Some(check_ownership(meowkit_dir)));
    }
    if args.substrate {
        // Strict in a scoped run: an absent committed view is a FAIL for CI.
        return Ok(Some(check_substrate(meowkit_dir, Status::Fail)));
    }
    if args.packs {
        // Strict in a scoped run: an absent manifest is a FAIL for CI.
        return Ok(Some(check_packs(meowkit_dir, Status::Fail)));
    }
    if args.rules {
        return Ok(Some(check_routing_table_breadth(meowkit_dir)));
    }
    if args.capabilities {
        return Ok(Some(check_capabilities_section(meowkit_dir)));
    }
    if args.agents {
        return Ok(Some(check_agent_conformance(project_root)));
    }
    if args.frontmatter {
        return Ok(Some(check_frontmatter_contract(project_root)));
    }
    if args.docs_refs {
        return Ok(Some(check_docs_refs_contract(meowkit_dir)));
    }
    Ok(None)
}

/// A refusal exits 2 (usage), never 1: exit 1 is this command's "the project
/// has a problem", and a CI step must not read "not ported" as a finding.
pub(super) fn not_ported_failure(not_ported: &NotPorted) -> Failure {
    Failure::usage(not_ported.to_string())
}
