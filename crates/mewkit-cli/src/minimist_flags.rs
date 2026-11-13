//! The npm CLI's global flag table, as minimist sees it.
//!
//! minimist types a flag by this table whatever the verb, so `orient --target x`
//! swallows `x` as the value of a flag `orient` never reads. `argv_compat` needs
//! the same table to drop the same tokens. The parity suite pins both lists to
//! `CLI_CATALOGUE` in the TS build, so they cannot drift while the TS exists.

/// Declared `type: "boolean"` in the catalogue.
pub const GLOBAL_BOOLEANS: &[&str] = &[
    "activate",
    "adopt",
    "agents",
    "all",
    "allow-cloud-mcp",
    "allow-kit-source",
    "beta",
    "capabilities",
    "check",
    "commit",
    "docs-refs",
    "dry-run",
    "explain",
    "force",
    "frontmatter",
    "gates",
    "hard-gates",
    "help",
    "json",
    "lifecycle",
    "list",
    "memory",
    "monthly",
    "no-cleanup",
    "ownership",
    "packs",
    "portable",
    "providers",
    "record",
    "reply",
    "report",
    "rules",
    "state",
    "strict",
    "structural",
    "substrate",
    "system-deps",
    "version",
    "workflow",
    "write",
    "yes",
];

/// Declared with a string type in the catalogue.
pub const GLOBAL_STRINGS: &[&str] = &[
    "as",
    "blocker",
    "by",
    "capability-decision",
    "checkpoint",
    "confirm",
    "correction",
    "correction-kind",
    "day",
    "delivery",
    "directive",
    "disposition",
    "evidence",
    "evidence-pointer",
    "evidence-ref",
    "fail-over",
    "friction",
    "id",
    "intent",
    "mcp-profiles",
    "mode",
    "next",
    "only",
    "outcome",
    "packet-kind",
    "plan",
    "priority",
    "profile",
    "provider",
    "question",
    "reason",
    "release-stage",
    "remote",
    "responsibility",
    "run",
    "session",
    "skill",
    "skill-packs",
    "skills",
    "slug",
    "stage",
    "status",
    "step",
    "target",
    "task-id",
    "type",
    "verification",
];

/// The catalogue's single-letter aliases.
pub const ALIASES: &[(char, &str)] = &[('h', "help"), ('v', "version"), ('y', "yes")];

pub fn is_global_boolean(name: &str) -> bool {
    GLOBAL_BOOLEANS.contains(&name)
}

pub fn is_global_flag(name: &str) -> bool {
    is_global_boolean(name) || GLOBAL_STRINGS.contains(&name)
}
