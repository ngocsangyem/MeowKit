//! The counts README and the index headers declare (`34 skills`,
//! `**Total**|**34**`) must equal the inventory, and every artifact must have a
//! row in its index. Blessing rewrites only the number tokens; a missing index
//! row is a hand-written fix and fails regardless.

#[path = "support/bless.rs"]
mod bless;

use mewkit_core::maintainer::counts_files;
use mewkit_core::validate::missing_rows;

#[test]
fn declared_counts_match_the_inventory() {
    let root = bless::repo_root();
    let problems: Vec<String> = missing_rows(&root)
        .into_iter()
        .map(|(source, kind, ids)| {
            format!(
                "{source}: {} {kind}(s) missing a row: {}",
                ids.len(),
                ids.join(", ")
            )
        })
        .collect();
    bless::check_or_bless(
        &root,
        &counts_files(&root),
        &problems,
        "bless_inventory_counts",
    );
}
