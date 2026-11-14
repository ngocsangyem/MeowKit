//! The docs reference manifest and the blocks generated onto the reference pages
//! restate runtime facts read from `.claude/`. A manifest can be current while a
//! page is stale, and a reader trusts the page, so both are checked together.

#[path = "support/bless.rs"]
mod bless;

use mewkit_core::maintainer::docs_files;

#[test]
fn docs_manifest_and_reference_pages_match_the_runtime() {
    let root = bless::repo_root();
    let (files, missing) = docs_files(&root).expect("render the docs reference files");
    let problems: Vec<String> = missing
        .iter()
        .map(|rel| format!("no reference page for {rel}"))
        .collect();
    bless::check_or_bless(&root, &files, &problems, "bless_docs_manifest");
}
