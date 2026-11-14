//! What commands print and how they exit in the less common cases: nothing
//! to do, a kit that is not available, and a target failing part-way.
mod support;

use support::temp_home::TempHome;
use support::{code, text, write};

#[test]
fn nothing_to_do_prints_an_empty_json_list() {
    let env = TempHome::new();
    for args in [["uninstall", "--json"], ["upgrade", "--json"]] {
        let out = env.mewkit(&args);
        assert_eq!(code(&out), 0, "{}", text(&out));
        assert_eq!(String::from_utf8_lossy(&out.stdout).trim(), "[]");
    }
}

#[test]
fn uninstall_without_the_kit_says_so_first_and_does_not_exit_zero() {
    let env = TempHome::new();
    // A development install is never cached, so the kit is not available later.
    let out = env.with_kit(&["init", "--target", "codex"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    let out = env.mewkit(&["uninstall", "--yes"]);
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert_eq!(code(&out), 6, "{}", text(&out));
    let note = stdout
        .find("is not available")
        .expect("explains the missing kit");
    let kept = stdout.find("  kept ").expect("lists what was kept");
    assert!(
        note < kept,
        "the note comes before the kept files:\n{stdout}"
    );
    assert!(stdout.contains("--kit-archive"), "{stdout}");
    assert!(
        stdout
            .lines()
            .filter(|l| l.contains("not corroborated"))
            .count()
            == 1,
        "many kept files collapse to one line:\n{stdout}"
    );
}

#[test]
fn a_target_failing_part_way_reports_the_ones_already_applied() {
    let env = TempHome::new();
    write(&env.project(), ".cursor/hooks.json", "{ not json");
    let out = env.with_kit(&["init", "--target", "codex,cursor"]);
    assert_eq!(code(&out), 1, "{}", text(&out));
    let stdout = String::from_utf8_lossy(&out.stdout);
    let stderr = String::from_utf8_lossy(&out.stderr);
    assert!(stdout.contains("codex (project): wrote"), "{stdout}");
    assert!(stderr.contains("cursor:"), "{stderr}");
    assert!(stderr.contains("listed above were applied"), "{stderr}");
}
