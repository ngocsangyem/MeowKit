//! One row of `validate` output, and the two enums that classify it.
//!
//! The row type is the TypeScript `CheckResult` with the same four fields: a
//! check's name, its honest status, a detail line the renderer prints only when
//! the status is not PASS, and the section it is grouped under. Nothing here
//! decides an exit code — [`super::render`] does, from a whole run's rows.
use std::path::Path;

/// `PASS` / `WARN` / `N/A` / `FAIL`, in the TypeScript spelling.
///
/// `Na` is a real verdict, not a missing one: a check whose subject does not
/// exist in this project (a maintainer-only contract, an unsupported provider
/// surface) must not render as a green PASS, and must not fail the build.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Status {
    Pass,
    Warn,
    Na,
    Fail,
}

impl Status {
    /// The 4-character label the renderer prints inside the brackets. `N/A`
    /// carries a trailing space so every row's name starts in the same column —
    /// the npm CLI pads it the same way (`pc.dim("N/A ")`).
    pub fn label(self) -> &'static str {
        match self {
            Status::Pass => "PASS",
            Status::Warn => "WARN",
            Status::Na => "N/A ",
            Status::Fail => "FAIL",
        }
    }
}

/// True when a condition holds, FAIL when it does not — the TypeScript `ok()`.
pub fn ok(condition: bool) -> Status {
    if condition {
        Status::Pass
    } else {
        Status::Fail
    }
}

/// The groups rows are printed under, in print order.
///
/// The order of these variants IS the output order (see
/// [`Section::ORDER`]). `Inventory` is produced by `inventory --check` rather
/// than by any check here; it stays in the list because the npm CLI's
/// exhaustiveness map lists it, and a row that cannot be printed is worse than
/// an unused heading.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Section {
    Structure,
    Hooks,
    Portability,
    Docs,
    Workflow,
    Gates,
    Ownership,
    Substrate,
    Packs,
    Plugin,
    Inventory,
    Rules,
    Capabilities,
    Agents,
    Memory,
    Target,
}

impl Section {
    /// Print order, mirroring the npm CLI's `SECTION_ORDER` key order.
    pub const ORDER: [Section; 16] = [
        Section::Structure,
        Section::Hooks,
        Section::Portability,
        Section::Docs,
        Section::Workflow,
        Section::Gates,
        Section::Ownership,
        Section::Substrate,
        Section::Packs,
        Section::Plugin,
        Section::Inventory,
        Section::Rules,
        Section::Capabilities,
        Section::Agents,
        Section::Memory,
        Section::Target,
    ];

    pub fn heading(self) -> &'static str {
        match self {
            Section::Structure => "Structure",
            Section::Hooks => "Hooks",
            Section::Portability => "Portability",
            Section::Docs => "Docs",
            Section::Workflow => "Workflow",
            Section::Gates => "Gates",
            Section::Ownership => "Ownership",
            Section::Substrate => "Substrate",
            Section::Packs => "Packs",
            Section::Plugin => "Plugin",
            Section::Inventory => "Inventory",
            Section::Rules => "Rules",
            Section::Capabilities => "Capabilities",
            Section::Agents => "Agents",
            Section::Memory => "Memory",
            Section::Target => "Target",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CheckResult {
    pub name: String,
    pub status: Status,
    pub detail: String,
    pub section: Section,
}

impl CheckResult {
    pub fn new(
        name: impl Into<String>,
        status: Status,
        detail: impl Into<String>,
        section: Section,
    ) -> Self {
        Self {
            name: name.into(),
            status,
            detail: detail.into(),
            section,
        }
    }
}

/// `path.join(base, rel)` rendered the way the npm CLI prints it, so a detail
/// line naming a path reads identically on both CLIs.
pub(super) fn display_join(base: &Path, relative: &str) -> String {
    let mut path = base.to_path_buf();
    for part in relative.split('/') {
        path.push(part);
    }
    path.display().to_string()
}

#[cfg(test)]
#[path = "result_tests.rs"]
mod result_tests;
