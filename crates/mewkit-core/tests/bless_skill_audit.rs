//! The skill-audit docs page restates the mechanical rubric scores of every
//! shipped skill; it must equal what the skills score today.

#[path = "support/bless.rs"]
mod bless;

use mewkit_core::maintainer::skill_audit_file;

#[test]
fn skill_audit_page_matches_the_skills() {
    let root = bless::repo_root();
    bless::check_or_bless(&root, &[skill_audit_file(&root)], &[], "bless_skill_audit");
}
