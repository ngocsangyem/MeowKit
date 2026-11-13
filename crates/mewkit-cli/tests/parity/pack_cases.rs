//! `pack` against both CLIs.
//!
//! Each fixture carries BOTH CLIs' install records for the same files: the npm
//! CLI's `.meowkit/metadata.json` and this binary's ownership index. So a
//! removal plan is computed from the same on-disk facts on both sides.
//!
//! Only what both can do without a network or a terminal is compared. `pack
//! add` of a pack that is not installed downloads a release in the npm CLI and
//! needs a kit here; `pack remove` that deletes writes each CLI's own state
//! file, which differ by design. Those paths are covered in
//! `tests/init_flags.rs`, against this checkout's kit.
use crate::parity;

const INSTALLED: &str = "pack-installed";

fn pack(
    name: &'static str,
    fixture: &'static str,
    args: &[&str],
) -> Option<(parity::Run, parity::Run)> {
    let mut argv = vec!["pack"];
    argv.extend_from_slice(args);
    parity::case(name).fixture(fixture).args(&argv).run()
}

#[test]
#[ignore = "needs node and the TS build"]
fn list_shows_installed_and_available_packs() {
    let Some((ts, _)) = pack("pack-list", INSTALLED, &["list"]) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(ts.stdout.contains("[installed] testing ("), "{}", ts.stdout);
}

#[test]
#[ignore = "needs node and the TS build"]
fn list_as_json() {
    let Some((ts, _)) = pack("pack-list-json", INSTALLED, &["list", "--json"]) else {
        return;
    };
    assert!(ts.stdout.contains("\"members\""), "{}", ts.stdout);
}

#[test]
#[ignore = "needs node and the TS build"]
fn an_install_with_no_record_counts_as_full() {
    let Some((ts, _)) = pack("pack-list-full", "pack-bare", &["list"]) else {
        return;
    };
    assert!(!ts.stdout.contains("[available]"), "{}", ts.stdout);
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_kit_without_a_pack_manifest_is_refused_with_the_fix() {
    let Some((ts, _)) = pack("pack-no-manifest", "pack-no-manifest", &["list"]) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("Run `mewkit upgrade` first, then retry.")
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_missing_or_mistyped_subcommand_is_an_invocation_error() {
    let Some((ts, _)) = parity::case("pack-missing-subcommand")
        .fixture(INSTALLED)
        .args(&["pack"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 2, "{}", ts.describe());
    assert!(ts.stderr.contains("needs a subcommand"));
    let Some((ts, _)) = pack("pack-unknown-subcommand", INSTALLED, &["bogus"]) else {
        return;
    };
    assert_eq!(ts.code, 2, "{}", ts.describe());
    assert!(ts.stderr.contains("Valid subcommands: list, add, remove"));
}

#[test]
#[ignore = "needs node and the TS build"]
fn add_refuses_an_unknown_pack_and_notes_an_installed_one() {
    let Some((ts, _)) = pack("pack-add-unknown", INSTALLED, &["add", "nope"]) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("Unknown pack \"nope\". Available: lifecycle-core, testing, docs")
    );
    let Some((ts, _)) = pack("pack-add-installed", INSTALLED, &["add", "testing"]) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout
            .contains("Already installed: testing — nothing to do.")
    );
    pack(
        "pack-add-installed-json",
        INSTALLED,
        &["add", "testing", "--json", "--dry-run"],
    );
    pack("pack-add-nothing", INSTALLED, &["add"]);
}

#[test]
#[ignore = "needs node and the TS build"]
fn remove_refuses_core_safety_surface_and_unknown_packs() {
    let Some((ts, _)) = pack(
        "pack-remove-protected",
        INSTALLED,
        &["remove", "lifecycle-core", "--yes"],
    ) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(ts.stderr.contains("core safety surface is not removable"));
    pack("pack-remove-base", INSTALLED, &["remove", "base", "--yes"]);
    let Some((ts, _)) = pack(
        "pack-remove-unknown",
        INSTALLED,
        &["remove", "nope", "--yes"],
    ) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_removal_dry_run_lists_the_pristine_pack_files_and_writes_nothing() {
    let Some((ts, _)) = pack(
        "pack-remove-dry-run",
        INSTALLED,
        &["remove", "testing", "--dry-run"],
    ) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout
            .contains("would delete .claude/skills/qa/SKILL.md"),
        "{}",
        ts.stdout
    );
    let Some((ts, _)) = pack(
        "pack-remove-dry-run-json",
        INSTALLED,
        &["remove", "testing", "--dry-run", "--json"],
    ) else {
        return;
    };
    assert!(ts.stdout.contains("\"dryRun\": true"), "{}", ts.stdout);
}

#[test]
#[ignore = "needs node and the TS build"]
fn an_edited_file_is_preserved_not_deleted() {
    let Some((ts, _)) = pack(
        "pack-remove-edited",
        "pack-installed-edited",
        &["remove", "testing", "--dry-run"],
    ) else {
        return;
    };
    assert!(
        ts.stdout
            .contains("1 shared/base/modified file(s) preserved."),
        "{}",
        ts.stdout
    );
    assert!(!ts.stdout.contains("notes.md"), "{}", ts.stdout);
}

#[test]
#[ignore = "needs node and the TS build"]
fn nothing_pristine_to_remove_is_a_note_not_an_error() {
    let Some((ts, _)) = pack(
        "pack-remove-nothing",
        "pack-bare",
        &["remove", "docs", "--yes"],
    ) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout.contains("Nothing to remove for docs"),
        "{}",
        ts.stdout
    );
}

/// Shared npm bug, ported as it is: the removal and listing maths resolve the
/// manifest against the INSTALLED tree, so a pack that excludes an artifact the
/// profile left out (`lifecycle-core` excludes `mk:autobuild`, which a `core`
/// install does not carry) makes `pack list` throw. The npm CLI dies with an
/// uncaught stack trace; both exit 1 and print nothing on stdout.
#[test]
#[ignore = "needs node and the TS build"]
fn a_manifest_naming_an_artifact_the_install_lacks_fails_in_both() {
    let Some((ts, rust)) = parity::case("pack-list-stale-exclude")
        .fixture("pack-stale-exclude")
        .args(&["pack", "list"])
        .ignore_stderr("node prints an uncaught stack trace; the message is asserted below")
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(ts.stdout.is_empty() && rust.stdout.is_empty());
    assert!(
        ts.stderr.contains("unknown artifact id \"mk:gone\""),
        "{}",
        ts.stderr
    );
    assert!(
        rust.stderr.contains("unknown artifact id \"mk:gone\""),
        "{}",
        rust.stderr
    );
}
