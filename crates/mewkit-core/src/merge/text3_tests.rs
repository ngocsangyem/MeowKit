use super::{Refusal, merge3};

const BASE: &str = "---\nname: fix\ndescription: Fix bugs.\n---\n\n# Fix\n\n\
    Step one reads the report.\nStep two finds the cause.\nStep three writes the patch.\n\
    Step four runs the tests.\nStep five ships it.\n";

#[test]
fn clean_separated_edits_merge() {
    let ours = BASE.replace(
        "Step one reads the report.",
        "Step one reads the whole report.",
    );
    let theirs = BASE.replace("Step five ships it.", "Step five opens a pull request.");
    let merged = merge3(BASE, &ours, &theirs).expect("separated edits merge");
    assert!(merged.contains("Step one reads the whole report."));
    assert!(merged.contains("Step five opens a pull request."));
    assert!(merged.starts_with("---\nname: fix\n"));
}

#[test]
fn one_side_unchanged_gives_the_other() {
    let ours = BASE.replace(
        "Step two finds the cause.",
        "Step two finds the root cause.",
    );
    assert_eq!(merge3(BASE, &ours, BASE).as_deref(), Ok(ours.as_str()));
    assert_eq!(merge3(BASE, BASE, &ours).as_deref(), Ok(ours.as_str()));
}

#[test]
fn overlapping_edits_refuse() {
    let ours = BASE.replace("Step two finds the cause.", "Step two asks.");
    let theirs = BASE.replace("Step two finds the cause.", "Step two looks.");
    assert_eq!(merge3(BASE, &ours, &theirs), Err(Refusal::Overlap));
}

#[test]
fn adjacent_edits_refuse() {
    let ours = BASE.replace("Step two finds the cause.", "Step two asks.");
    let theirs = BASE.replace("Step three writes the patch.", "Step three patches.");
    assert_eq!(merge3(BASE, &ours, &theirs), Err(Refusal::Overlap));
}

#[test]
fn a_separating_region_without_a_unique_line_refuses() {
    let base = "# T\n\nalpha\n\nrepeat\n\nomega\n\nrepeat\n";
    let ours = base.replace("alpha", "ALPHA-ish");
    let theirs = base.replace("omega", "the end");
    // Between the two edits lie only a blank and `repeat`, which occurs twice.
    assert_eq!(merge3(base, &ours, &theirs), Err(Refusal::NoAnchor));
}

#[test]
fn a_frontmatter_hunk_refuses() {
    let ours = BASE.replace("description: Fix bugs.", "description: Fix every bug.");
    let theirs = BASE.replace("Step five ships it.", "Step five opens a pull request.");
    assert_eq!(merge3(BASE, &ours, &theirs), Err(Refusal::Frontmatter));
    assert_eq!(merge3(BASE, &theirs, &ours), Err(Refusal::Frontmatter));
}

#[test]
fn a_gate_line_hunk_refuses() {
    let ours = BASE.replace("Step one reads the report.", "STOP if there is no report.");
    let theirs = BASE.replace("Step five ships it.", "Step five opens a pull request.");
    assert_eq!(merge3(BASE, &ours, &theirs), Err(Refusal::GateLine));
    let removes_gate = "# T\n\nkeep\n\nThis gate blocks a ship.\n\nend\n";
    let ours = removes_gate.replace("This gate blocks a ship.\n", "");
    assert_eq!(
        merge3(removes_gate, &ours, removes_gate),
        Err(Refusal::GateLine)
    );
}

#[test]
fn delegate_is_not_a_gate_word() {
    assert!(!super::is_gate_line(
        "delegate to the tester and navigate\n"
    ));
    assert!(super::is_gate_line("Gate 1 needs approval\n"));
    assert!(super::is_gate_line("This is non-negotiable.\n"));
}
