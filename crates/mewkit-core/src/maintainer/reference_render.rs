//! The generated blocks spliced into the docs reference pages.
//!
//! Two kinds: an "at a glance" facts block on every skill and agent page, and a
//! complete list plus the hook registry on the index pages. Both carry only what
//! the source declares — a block that fills gaps with defaults states things
//! nobody asserted, which is worse than the hand-written clone it replaces.
//!
//! Markers are MDX expression comments, not HTML comments: the latter fail the
//! MDX build outright. Everything outside the markers is returned untouched.
use regex::Regex;

use super::docs_manifest::{DocsReferenceEntry, page_slug};
use super::hooks_inventory::HooksInventory;
use super::table_cell::{code_cell, table_cell};

pub const FACTS_START: &str = "{/* GENERATED:reference-facts START */}";
pub const FACTS_END: &str = "{/* GENERATED:reference-facts END */}";
pub const INDEX_START: &str = "{/* GENERATED:reference-index START */}";
pub const INDEX_END: &str = "{/* GENERATED:reference-index END */}";

const SOURCE_BASE: &str = "https://github.com/ngocsangyem/MeowKit/blob/main/.claude/";

fn list(values: &[String]) -> Option<String> {
    (!values.is_empty()).then(|| {
        values
            .iter()
            .map(|v| code_cell(v))
            .collect::<Vec<_>>()
            .join(", ")
    })
}

/// The block for one artifact. Rows whose value is undeclared are omitted, not
/// printed empty: a table of dashes teaches a reader the data is missing when
/// what is true is that the artifact never claimed it.
pub fn render_reference_facts(entry: &DocsReferenceEntry) -> String {
    let non_empty =
        |value: &str, render: fn(&str) -> String| (!value.is_empty()).then(|| render(value));
    let rows: Vec<(&str, Option<String>)> = vec![
        (
            "Source",
            Some(format!(
                "[{}]({SOURCE_BASE}{})",
                code_cell(&format!(".claude/{}", entry.source_path)),
                entry.source_path
            )),
        ),
        ("Owner", non_empty(&entry.owner, code_cell)),
        ("Runtime", non_empty(&entry.runtime, code_cell)),
        ("Risk", non_empty(&entry.risk, table_cell)),
        (
            "Phase",
            entry.phase.as_deref().and_then(|p| non_empty(p, code_cell)),
        ),
        ("Depends on", list(&entry.dependencies)),
        ("Writes", list(&entry.output)),
        (
            "Last verified",
            entry
                .last_verified
                .as_deref()
                .and_then(|v| non_empty(v, table_cell)),
        ),
    ];
    let mut lines = vec![
        FACTS_START.to_string(),
        String::new(),
        "| | |".to_string(),
        "|---|---|".to_string(),
    ];
    for (label, value) in rows {
        if let Some(value) = value {
            lines.push(format!("| **{label}** | {value} |"));
        }
    }
    lines.push(String::new());
    lines.push(FACTS_END.to_string());
    lines.join("\n")
}

/// Put the block into a page, replacing any previous one. A page with no marker
/// gets it directly below the frontmatter — the one position that is
/// mechanically reliable across pages of differing structure.
pub fn splice_reference_facts(body: &str, block: &str) -> String {
    if let (Some(start), Some(end)) = (body.find(FACTS_START), body.find(FACTS_END))
        && end > start
    {
        return format!(
            "{}{block}{}",
            &body[..start],
            &body[end + FACTS_END.len()..]
        );
    }
    let frontmatter = Regex::new(r"^---\n[\s\S]*?\n---\n").expect("a static pattern");
    match frontmatter.find(body) {
        Some(fm) => format!("{}\n{block}\n{}", fm.as_str(), &body[fm.end()..]),
        None => format!("{block}\n\n{body}"),
    }
}

fn wrap(lines: Vec<String>) -> String {
    let mut all = vec![INDEX_START.to_string(), String::new()];
    all.extend(lines);
    all.push(String::new());
    all.push(INDEX_END.to_string());
    all.join("\n")
}

/// The complete alphabetical list for a kind. Complete is the point: the
/// curated sections above group by phase, which reads better but cannot be
/// generated or proven complete, since few artifacts declare one.
pub fn render_artifact_index(entries: &[DocsReferenceEntry], kind: &str) -> String {
    let mut lines = vec![
        format!("## Every {kind}"),
        String::new(),
        format!(
            "_Generated from `.claude/`. Every {kind} on disk appears here; the sections above group the ones you reach for most._"
        ),
        String::new(),
        format!(
            "| {} | What it does |",
            if kind == "skill" { "Skill" } else { "Agent" }
        ),
        "|---|---|".to_string(),
    ];
    for entry in entries.iter().filter(|e| e.kind == kind) {
        lines.push(format!(
            "| [{}](/reference/{kind}s/{}) | {} |",
            code_cell(&entry.id),
            page_slug(&entry.source_path, kind),
            table_cell(&entry.description)
        ));
    }
    wrap(lines)
}

/// The registered lifecycle hooks, three columns by decision: script paths,
/// timeouts and matcher chains are omitted so the list does not double as a map
/// of what to disable.
pub fn render_hooks_index(inventory: &HooksInventory) -> String {
    let mut lines = vec![
        "## Registered hooks".to_string(),
        String::new(),
        "_Generated from `.claude/settings.json`, so a registered hook cannot be missing here._"
            .to_string(),
        String::new(),
        "**Blocking** means the hook can stop the action. Advisory means it observes and reports."
            .to_string(),
        "Script paths, timeouts, and matcher chains are intentionally not listed; read".to_string(),
        "`.claude/settings.json` for the wiring.".to_string(),
        String::new(),
        "| Event | Purpose | Can it block? |".to_string(),
        "|---|---|---|".to_string(),
    ];
    for hook in &inventory.entries {
        lines.push(format!(
            "| {} | {} | {} |",
            code_cell(&hook.event),
            table_cell(&hook.purpose),
            if hook.blocking {
                "**Blocking**"
            } else {
                "Advisory"
            }
        ));
    }
    if !inventory.empty_events.is_empty() {
        let events: Vec<String> = inventory
            .empty_events
            .iter()
            .map(|e| format!("`{e}`"))
            .collect();
        lines.push(String::new());
        lines.push(format!(
            "Registered with no hooks today: {}.",
            events.join(", ")
        ));
    }
    wrap(lines)
}

/// Replace the generated section, or append it when the page has no marker yet.
pub fn splice_index(body: &str, block: &str) -> String {
    if let (Some(start), Some(end)) = (body.find(INDEX_START), body.find(INDEX_END))
        && end > start
    {
        return format!(
            "{}{block}{}",
            &body[..start],
            &body[end + INDEX_END.len()..]
        );
    }
    format!("{}\n\n{block}\n", body.trim_end())
}
