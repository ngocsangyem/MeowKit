//! Apply the generated blocks across every reference page.
//!
//! Kept beside the manifest because the two are one contract: the manifest
//! records what the runtime declares and these pages restate it. Checking one
//! without the other lets a page drift while its manifest entry stays green.
use std::path::Path;

use super::docs_manifest::{DocsReferenceEntry, page_slug};
use super::generated::GeneratedFile;
use super::hooks_inventory::build_hooks_inventory;
use super::line_endings::fold_crlf;
use super::reference_render::{
    render_artifact_index, render_hooks_index, render_reference_facts, splice_index,
    splice_reference_facts,
};

/// Where the reference pages live, relative to the repository root.
pub const REFERENCE_DIR_REL: &str = "packages/docs/content/docs/reference";

/// The per-artifact pages, each with its facts block applied. An artifact with
/// no page is reported in `missing` — the coverage gate's failure, surfaced
/// here too because a manifest can be current while a page is absent.
pub fn artifact_pages(
    root: &Path,
    entries: &[DocsReferenceEntry],
    missing: &mut Vec<String>,
) -> Vec<GeneratedFile> {
    let mut out = Vec::new();
    for entry in entries {
        let rel = format!(
            "{}s/{}.mdx",
            entry.kind,
            page_slug(&entry.source_path, &entry.kind)
        );
        let path = format!("{REFERENCE_DIR_REL}/{rel}");
        let Ok(bytes) = std::fs::read(root.join(&path)) else {
            missing.push(rel);
            continue;
        };
        // Folded so a CRLF checkout splices (and compares) like an LF one.
        let body = fold_crlf(&String::from_utf8_lossy(&bytes)).into_owned();
        let next = splice_reference_facts(&body, &render_reference_facts(entry));
        out.push(GeneratedFile::new(path, next));
    }
    out
}

/// The generated sections on the index pages: a complete list per kind and the
/// hook registry. These pages have no artifact behind them — they describe the
/// set — so they are spliced separately, under the same marker contract.
pub fn index_pages(
    root: &Path,
    entries: &[DocsReferenceEntry],
    missing: &mut Vec<String>,
) -> Result<Vec<GeneratedFile>, String> {
    let hooks = build_hooks_inventory(&root.join(".claude"))?;
    let targets = [
        ("skills/index.mdx", render_artifact_index(entries, "skill")),
        ("agents/index.mdx", render_artifact_index(entries, "agent")),
        ("hooks.mdx", render_hooks_index(&hooks)),
    ];
    let mut out = Vec::new();
    for (rel, block) in targets {
        let path = format!("{REFERENCE_DIR_REL}/{rel}");
        let Ok(bytes) = std::fs::read(root.join(&path)) else {
            missing.push(rel.to_string());
            continue;
        };
        let body = fold_crlf(&String::from_utf8_lossy(&bytes)).into_owned();
        out.push(GeneratedFile::new(path, splice_index(&body, &block)));
    }
    Ok(out)
}
