//! Overlays: the user's version of kit files survives upgrades, in-place
//! edits after it are kept too, a kept overlay is not "an edit was kept"
//! (exit 6), and an overlay this machine did not make changes nothing until
//! it is approved here.
mod support;

use support::skill_store::{SKILL, changed_kit, installed, row, status, with_kit_dir};
use support::{code, read, text, write};

const MINE: &str = "---\nname: mk:fix\ndescription: my fix\n---\nmine, first take\n";
const MINE_AGAIN: &str = "---\nname: mk:fix\ndescription: my fix\n---\nmine, edited in place\n";

/// A kit whose `fix` skill changed upstream: SKILL.md and one new file.
fn upstream_changed() -> tempfile::TempDir {
    changed_kit(|root| {
        let skill = root.join(SKILL);
        let text = std::fs::read_to_string(skill.join("SKILL.md")).unwrap();
        std::fs::write(skill.join("SKILL.md"), format!("{text}\nupstream change\n")).unwrap();
        std::fs::write(
            skill.join("references-upstream-new.md"),
            "new upstream file\n",
        )
        .unwrap();
    })
}

fn overlay_fix(env: &support::temp_home::TempHome) {
    write(&env.project(), &format!("{SKILL}/SKILL.md"), MINE);
    let out = env.mewkit(&["skill", "overlay", "fix"]);
    assert_eq!(code(&out), 0, "overlay: {}", text(&out));
    assert!(text(&out).contains("overlaid .claude/skills/fix: SKILL.md"));
}

#[test]
fn an_overlay_survives_an_upstream_change_and_a_later_in_place_edit() {
    let env = installed();
    let p = env.project();
    overlay_fix(&env);
    assert_eq!(row(&status(&env), SKILL)["status"], "overlaid");
    assert!(
        p.join(".meowkit/skill-overlays/files/.claude/skills/fix/SKILL.md")
            .is_file()
    );

    let kit = upstream_changed();
    let out = with_kit_dir(&env, kit.path(), &["upgrade"]);
    assert_eq!(
        code(&out),
        0,
        "a kept overlay is not exit 6: {}",
        text(&out)
    );
    let shown = text(&out);
    assert!(
        shown.contains("kept .claude/skills/fix/SKILL.md: overlaid"),
        "{shown}"
    );
    assert!(shown.contains("(drift)"), "{shown}");
    assert_eq!(read(&p, &format!("{SKILL}/SKILL.md")), MINE);
    assert!(
        p.join(SKILL).join("references-upstream-new.md").is_file(),
        "the kit's other files of the skill still upgrade"
    );
    let fix = row(&status(&env), SKILL).clone();
    assert!(
        fix["drift"]
            .to_string()
            .contains("upstream changed SKILL.md"),
        "{fix:#}"
    );

    write(&p, &format!("{SKILL}/SKILL.md"), MINE_AGAIN);
    let fix = row(&status(&env), SKILL).clone();
    assert_eq!(fix["status"], "overlaid");
    assert!(fix["drift"].to_string().contains("out of date"), "{fix:#}");
    let out = with_kit_dir(&env, kit.path(), &["upgrade", "--force", "--yes"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert_eq!(
        read(&p, &format!("{SKILL}/SKILL.md")),
        MINE_AGAIN,
        "the in-place edit is kept, and the stored copy never replaces it"
    );
}

#[test]
fn a_kept_overlay_does_not_exit_6_but_an_edit_that_cannot_be_merged_does() {
    let env = installed();
    overlay_fix(&env);
    let review = ".claude/skills/review/SKILL.md";
    write(&env.project(), review, "my review\n");
    let out = env.with_kit(&["upgrade"]);
    assert_eq!(code(&out), 6, "{}", text(&out));
    let shown = text(&out);
    assert!(
        shown.contains(&format!("kept {review}: edited since install")),
        "{shown}"
    );
    assert!(
        shown.contains("kept .claude/skills/fix/SKILL.md: overlaid"),
        "{shown}"
    );
}

#[test]
fn an_overlay_from_elsewhere_is_inert_until_approved_here() {
    let author = installed();
    overlay_fix(&author);
    let clone = installed();
    let p = clone.project();
    support::copy_tree(
        &author.project().join(".meowkit/skill-overlays"),
        &p.join(".meowkit/skill-overlays"),
    );
    let kit_text = read(&p, &format!("{SKILL}/SKILL.md"));

    let fix = row(&status(&clone), SKILL).clone();
    assert_eq!(fix["status"], "kit", "{fix:#}");
    assert!(
        fix["drift"].to_string().contains("waiting for approval"),
        "{fix:#}"
    );
    let out = clone.with_kit(&["upgrade"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert_eq!(read(&p, &format!("{SKILL}/SKILL.md")), kit_text, "inert");

    // No terminal and no --yes: the diff is shown, nothing is placed.
    let out = clone.mewkit(&["skill", "overlay", "fix", "--approve"]);
    assert_ne!(code(&out), 0, "{}", text(&out));
    assert!(text(&out).contains("+mine, first take"), "{}", text(&out));
    assert_eq!(read(&p, &format!("{SKILL}/SKILL.md")), kit_text);

    let out = clone.mewkit(&["skill", "overlay", "fix", "--approve", "--yes"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert_eq!(read(&p, &format!("{SKILL}/SKILL.md")), MINE);
    assert_eq!(row(&status(&clone), SKILL)["status"], "overlaid");
}

#[test]
fn a_stored_copy_that_does_not_match_its_record_is_refused() {
    let author = installed();
    overlay_fix(&author);
    let clone = installed();
    let p = clone.project();
    support::copy_tree(
        &author.project().join(".meowkit/skill-overlays"),
        &p.join(".meowkit/skill-overlays"),
    );
    write(
        &p,
        ".meowkit/skill-overlays/files/.claude/skills/fix/SKILL.md",
        "swapped after it was recorded\n",
    );
    let before = read(&p, &format!("{SKILL}/SKILL.md"));
    let out = clone.mewkit(&["skill", "overlay", "fix", "--approve", "--yes"]);
    assert_ne!(code(&out), 0, "{}", text(&out));
    assert!(
        text(&out).contains("does not match its record"),
        "{}",
        text(&out)
    );
    assert_eq!(read(&p, &format!("{SKILL}/SKILL.md")), before);
}
