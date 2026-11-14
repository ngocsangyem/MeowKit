//! Every generated file this repository commits, with the bytes it must hold.
use std::path::Path;

use super::docs_manifest::{build_docs_reference_manifest, serialize_docs_reference_manifest};
use super::reference_pages::{REFERENCE_DIR_REL, artifact_pages, index_pages};
use crate::validate::{aggregate_substrate, render_substrate_view};

/// Where the committed manifest lives, relative to the repository root.
pub const DOCS_MANIFEST_REL: &str = "packages/docs/docs-reference-manifest.json";
/// The committed substrate view, relative to the repository root.
pub const SUBSTRATE_VIEW_REL: &str = ".claude/harness-substrate.md";

/// One committed file and the exact content the generators produce for it.
#[derive(Clone, Debug)]
pub struct GeneratedFile {
    /// Repository-relative, `/`-separated.
    pub path: String,
    pub content: String,
}

impl GeneratedFile {
    pub fn new(path: impl Into<String>, content: impl Into<String>) -> Self {
        Self {
            path: path.into(),
            content: content.into(),
        }
    }
}

/// The responsibility-by-coverage view. The trailing newline is part of the
/// committed file; the renderer's own output has none.
pub fn substrate_file(root: &Path) -> GeneratedFile {
    let view = render_substrate_view(&aggregate_substrate(&root.join(".claude")));
    GeneratedFile::new(SUBSTRATE_VIEW_REL, format!("{view}\n"))
}

/// Every file whose count tokens (`34 skills`, `**Total**|**34**`) must equal
/// the inventory. Only files that would change are returned, so an up-to-date
/// tree yields nothing and a drifted one names exactly what moved.
pub fn counts_files(root: &Path) -> Vec<GeneratedFile> {
    crate::validate::rewrite_count_tokens(root)
        .into_iter()
        .map(|(path, content)| GeneratedFile::new(path, content))
        .collect()
}

/// The docs reference manifest and the generated blocks on the reference pages
/// and index pages. `missing` lists artifacts or index pages with no page: not
/// something a rewrite can fix, so it is reported rather than blessed.
pub fn docs_files(root: &Path) -> Result<(Vec<GeneratedFile>, Vec<String>), String> {
    let claude_dir = root.join(".claude");
    if !claude_dir.is_dir() {
        return Err("no .claude/ at the repository root".to_string());
    }
    let reference_dir = root.join(REFERENCE_DIR_REL);
    let reference = reference_dir.is_dir().then_some(reference_dir.as_path());
    let manifest = build_docs_reference_manifest(&claude_dir, reference);

    let mut files = vec![GeneratedFile::new(
        DOCS_MANIFEST_REL,
        serialize_docs_reference_manifest(&manifest),
    )];
    let mut missing = Vec::new();
    if reference.is_some() {
        files.extend(artifact_pages(root, &manifest.entries, &mut missing));
        files.extend(index_pages(root, &manifest.entries, &mut missing)?);
    }
    Ok((files, missing))
}
