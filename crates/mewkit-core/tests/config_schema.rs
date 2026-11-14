//! The published config schema must equal what the config surface renders.
//!
//! An integration target (not a `--lib` name filter) so CI cannot pass
//! vacuously if a test is renamed: a missing target fails the build.

#[path = "support/bless.rs"]
mod bless;

use mewkit_core::config::{observer_names, render_config_json_schema};
use mewkit_core::maintainer::GeneratedFile;

#[test]
fn committed_schema_matches_the_rendering() {
    let root = bless::repo_root();
    let names = observer_names(&root);
    assert!(!names.is_empty(), "the kit's handler registry is missing");
    let file = GeneratedFile::new(
        "crates/mewkit-core/schemas/config-v1.json",
        render_config_json_schema(&names),
    );
    bless::check_or_bless(&root, &[file], &[], "config_schema");
}
