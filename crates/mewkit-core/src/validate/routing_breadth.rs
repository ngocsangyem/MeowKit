//! Does an always-loaded rule file carry a broad intent→skill routing table?
//!
//! Such a table is skill-dispatch guidance: it belongs in a skill reference
//! loaded on demand, not in the `.claude/rules/` context every turn pays for.
//! Always a WARN, never a FAIL — the cost is tokens, not correctness. Port of
//! `checkRoutingTableBreadth` in `commands/validate.ts`.
//!
//! The heuristic (all four must hold): the table's header row names a routing
//! column, it has at least eight data rows referencing `mk:` skills, the file's
//! inventory criticality is not `critical`, and it is not on the allowlist.
use std::fs;
use std::path::Path;
use std::sync::LazyLock;

use regex::Regex;

use super::result::{CheckResult, Section, Status};

/// Tables that look like routing tables by row count but are workflow/contract
/// tables. Keyed by rules-relative basename.
const ALLOWLIST: [&str; 1] = ["phase-contracts.md"];

/// A header cell (trimmed, lowercased) that marks a table as intent→skill
/// routing.
const ROUTING_HEADER_CELLS: [&str; 4] = ["intent", "use", "user wants", "user intent"];

/// Data rows referencing `mk:` skills, at or above which a table counts as
/// broad.
const BROAD_ROW_COUNT: usize = 8;

static PIPE_ROW: LazyLock<Regex> =
    LazyLock::new(|| crate::js_regex::compile(r"^\s*\|").expect("a static pipe-row pattern"));
static SEPARATOR_ROW: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile(r"^\s*\|?[\s:|-]+\|?\s*$").expect("a static separator pattern")
});
static MK_SKILL: LazyLock<Regex> =
    LazyLock::new(|| crate::js_regex::compile(r"\bmk:[a-z][a-z-]*").expect("a static skill ref"));
static LEADING_PIPE: LazyLock<Regex> =
    LazyLock::new(|| crate::js_regex::compile(r"^\s*\|").expect("a static leading pipe"));
static TRAILING_PIPE: LazyLock<Regex> =
    LazyLock::new(|| crate::js_regex::compile(r"\|\s*$").expect("a static trailing pipe"));

fn parse_pipe_cells(line: &str) -> Vec<String> {
    let inner = LEADING_PIPE.replace(line, "");
    TRAILING_PIPE
        .replace(&inner, "")
        .split('|')
        .map(|cell| cell.trim().to_string())
        .collect()
}

/// The inventory a reader should use: the canonical generated path when
/// present, else the pre-move one inside `.claude/`, else the canonical path.
/// Port of `state/resolve-inventory-path.ts`.
pub fn resolve_inventory_path(project_root: &Path) -> std::path::PathBuf {
    let canonical = project_root.join(".meowkit").join("harness-inventory.json");
    if canonical.exists() {
        return canonical;
    }
    let legacy = project_root.join(".claude").join("harness-inventory.json");
    if legacy.exists() {
        return legacy;
    }
    canonical
}

/// The `criticality` recorded for one `.claude/`-relative artifact, read from
/// the inventory. An unreadable or absent inventory yields `None` for every
/// path, which is the honest answer: nothing is known, so nothing is exempt.
fn inventory_criticality(meowkit_dir: &Path, artifact: &str) -> Option<String> {
    let root = meowkit_dir.parent().unwrap_or(meowkit_dir);
    let text = fs::read_to_string(resolve_inventory_path(root)).ok()?;
    let parsed: serde_json::Value = serde_json::from_str(&text).ok()?;
    parsed
        .get("artifacts")?
        .get(artifact)?
        .get("criticality")?
        .as_str()
        .map(str::to_string)
}

/// One table being counted: whether its header named a routing column, and how
/// many data rows referenced an `mk:` skill.
#[derive(Default)]
struct TableScan {
    header_is_routing: bool,
    mk_rows: usize,
}

impl TableScan {
    fn is_broad(&self) -> bool {
        self.header_is_routing && self.mk_rows >= BROAD_ROW_COUNT
    }
}

/// True when one rule file's prose carries a broad routing table.
///
/// A blank or non-pipe line ENDS a table, so two adjacent tables are counted
/// separately — one narrow table must not lend its rows to the next.
fn has_broad_routing_table(body: &str) -> bool {
    let mut table: Option<TableScan> = None;
    for line in body.split('\n') {
        if !PIPE_ROW.is_match(line) {
            if table.take().is_some_and(|finished| finished.is_broad()) {
                return true;
            }
            continue;
        }
        let Some(open) = table.as_mut() else {
            // The first pipe row of a table is its header row.
            table = Some(TableScan {
                header_is_routing: parse_pipe_cells(line)
                    .iter()
                    .any(|cell| ROUTING_HEADER_CELLS.contains(&cell.to_lowercase().as_str())),
                mk_rows: 0,
            });
            continue;
        };
        if SEPARATOR_ROW.is_match(line) {
            continue;
        }
        if MK_SKILL.is_match(line) {
            open.mk_rows += 1;
        }
    }
    table.is_some_and(|last| last.is_broad())
}

pub fn check_routing_table_breadth(meowkit_dir: &Path) -> Vec<CheckResult> {
    let rules_dir = meowkit_dir.join("rules");
    let mut results = Vec::new();
    if !rules_dir.exists() {
        return results;
    }

    // In Node's order (see `dir_order`): one WARN row per flagged file, so the
    // order of these rows is output too.
    let mut files: Vec<String> = super::dir_order::sorted_names(&rules_dir)
        .into_iter()
        .filter(|name| name.ends_with(".md"))
        .collect();
    files.retain(|file| !ALLOWLIST.contains(&file.as_str()));

    for file in files {
        if inventory_criticality(meowkit_dir, &format!("rules/{file}")).as_deref()
            == Some("critical")
        {
            continue;
        }
        let body = String::from_utf8_lossy(&fs::read(rules_dir.join(&file)).unwrap_or_default())
            .into_owned();
        if !has_broad_routing_table(&body) {
            continue;
        }
        results.push(CheckResult::new(
            format!("Routing-table breadth: rules/{file}"),
            Status::Warn,
            format!(
                "An intent→skill routing table (≥8 mk: rows) lives in always-loaded rules/{file}. \
                 Move skill-dispatch tables into a skill reference loaded on demand \
                 (see agent-detector references/skill-domain-routing.md)."
            ),
            Section::Rules,
        ));
    }

    if results.is_empty() {
        results.push(CheckResult::new(
            "Routing-table breadth",
            Status::Pass,
            "No broad intent→skill routing tables found in always-loaded rules/.",
            Section::Rules,
        ));
    }
    results
}

#[cfg(test)]
#[path = "routing_breadth_tests.rs"]
mod routing_breadth_tests;
