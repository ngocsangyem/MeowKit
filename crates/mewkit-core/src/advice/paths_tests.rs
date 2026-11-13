use super::*;

#[test]
fn a_relative_candidate_resolves_against_the_project() {
    let root = Path::new("/repo/project");
    assert_eq!(
        resolve_from(root, "tasks/./reports/../evidence.json"),
        Path::new("/repo/project/tasks/evidence.json")
    );
}

#[test]
fn an_absolute_candidate_wins_over_the_base() {
    let root = Path::new("/repo/project");
    assert_eq!(
        resolve_from(root, "/elsewhere/evidence.json"),
        Path::new("/elsewhere/evidence.json")
    );
}

#[test]
fn dot_dot_cannot_climb_above_an_absolute_root() {
    assert_eq!(resolve_from(Path::new("/"), "../../etc"), Path::new("/etc"));
}

#[test]
fn the_boundary_refuses_a_path_that_escapes_upward() {
    let root = Path::new("/repo/project");
    assert!(is_inside(root, &resolve_from(root, "tasks/x.json")));
    assert!(is_inside(root, root));
    assert!(!is_inside(root, &resolve_from(root, "../other/x.json")));
    // A sibling whose name merely STARTS with the root is outside it: the test
    // is component-wise, not a string prefix.
    assert!(!is_inside(root, Path::new("/repo/project-two/x.json")));
}

#[test]
fn a_printed_relative_path_uses_forward_slashes() {
    assert_eq!(
        relative_to(
            Path::new("/repo/project"),
            Path::new("/repo/project/tasks/reports/x.md")
        ),
        "tasks/reports/x.md"
    );
}
