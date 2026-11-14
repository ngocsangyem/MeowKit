//! `.claude/harness-substrate.md` is the committed responsibility-by-coverage
//! view; it must equal what the registry and frontmatter render today.

#[path = "support/bless.rs"]
mod bless;

use mewkit_core::maintainer::substrate_file;

#[test]
fn substrate_view_matches_the_registry() {
    let root = bless::repo_root();
    bless::check_or_bless(&root, &[substrate_file(&root)], &[], "bless_substrate_view");
}
