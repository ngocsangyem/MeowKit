//! When a table in an always-loaded rule file counts as skill dispatch.
use std::fs;

use super::super::result::Status;
use super::check_routing_table_breadth;

/// A routing table with `rows` dispatch rows under the given header.
fn table(header: &str, rows: usize) -> String {
    let mut body = format!("# Rules\n\n| {header} | Skill |\n| --- | --- |\n");
    for index in 0..rows {
        body.push_str(&format!("| do thing {index} | `mk:cook` |\n"));
    }
    body
}

fn with_rule(name: &str, body: &str) -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("a temp dir");
    let rules = dir.path().join(".claude").join("rules");
    fs::create_dir_all(&rules).expect("create the rules dir");
    fs::write(rules.join(name), body).expect("write the rule");
    dir
}

#[test]
fn an_absent_rules_directory_produces_no_rows_at_all() {
    let dir = tempfile::tempdir().expect("a temp dir");
    assert!(check_routing_table_breadth(&dir.path().join(".claude")).is_empty());
}

#[test]
fn a_clean_rules_directory_reports_one_pass() {
    let dir = with_rule("core-behaviors.md", "# Behaviours\n\nProse only.\n");
    let rows = check_routing_table_breadth(&dir.path().join(".claude"));
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].status, Status::Pass);
    assert_eq!(rows[0].name, "Routing-table breadth");
}

#[test]
fn eight_dispatch_rows_under_a_routing_header_warn() {
    let dir = with_rule("skill-routing.md", &table("Intent", 8));
    let rows = check_routing_table_breadth(&dir.path().join(".claude"));
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].status, Status::Warn);
    assert_eq!(
        rows[0].name,
        "Routing-table breadth: rules/skill-routing.md"
    );
}

#[test]
fn seven_rows_are_below_the_threshold() {
    let dir = with_rule("skill-routing.md", &table("Intent", 7));
    assert_eq!(
        check_routing_table_breadth(&dir.path().join(".claude"))[0].status,
        Status::Pass
    );
}

#[test]
fn a_non_routing_header_is_not_dispatch_however_long() {
    let dir = with_rule("phase-table.md", &table("Phase", 12));
    assert_eq!(
        check_routing_table_breadth(&dir.path().join(".claude"))[0].status,
        Status::Pass
    );
}

#[test]
fn two_short_tables_do_not_add_up_to_one_broad_one() {
    // A table ends at the first non-pipe line, so neither table lends its rows
    // to the other — the property that keeps a file of small tables clean.
    let body = format!("{}\n{}", table("Intent", 5), table("Intent", 5));
    let dir = with_rule("skill-routing.md", &body);
    assert_eq!(
        check_routing_table_breadth(&dir.path().join(".claude"))[0].status,
        Status::Pass
    );
}

#[test]
fn the_contract_table_is_allowlisted() {
    let dir = with_rule("phase-contracts.md", &table("Intent", 20));
    assert_eq!(
        check_routing_table_breadth(&dir.path().join(".claude"))[0].status,
        Status::Pass
    );
}

#[test]
fn a_critical_rule_file_is_exempt_per_the_inventory() {
    let dir = with_rule("skill-routing.md", &table("Intent", 10));
    let meowkit = dir.path().join(".meowkit");
    fs::create_dir_all(&meowkit).expect("create the state dir");
    fs::write(
        meowkit.join("harness-inventory.json"),
        r#"{"artifacts":{"rules/skill-routing.md":{"criticality":"critical"}}}"#,
    )
    .expect("write the inventory");
    assert_eq!(
        check_routing_table_breadth(&dir.path().join(".claude"))[0].status,
        Status::Pass
    );
}
