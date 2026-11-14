use super::*;

fn entry(owner: &str, checksum: &str, base: &str) -> FileEntry {
    FileEntry {
        path: "rules/a.md".into(),
        owner: owner.into(),
        layer: "core".into(),
        checksum: checksum.into(),
        base_checksum: base.into(),
        installed_version: None,
        installed_at: None,
    }
}

#[test]
fn a_pristine_match_proves_nothing_against_a_baseline_rebuilt_from_disk() {
    let pristine = entry("meowkit", "h", "h");
    assert_eq!(classify_provenance(&pristine, true), Provenance::Verified);
    assert_eq!(classify_provenance(&pristine, false), Provenance::Unknown);
}

#[test]
fn a_file_with_no_recorded_baseline_is_unknown_even_when_it_is_the_users() {
    assert_eq!(
        classify_provenance(&entry("user", "h", ""), true),
        Provenance::Unknown
    );
    assert_eq!(
        classify_provenance(&entry("user", "h", "h"), false),
        Provenance::Verified
    );
    assert_eq!(
        classify_provenance(&entry("meowkit", "x", "h"), true),
        Provenance::KnownModified
    );
}

#[test]
fn layers_follow_the_top_directory() {
    assert_eq!(classify_layer("skills/x/SKILL.md"), "skill");
    assert_eq!(classify_layer("hooks/a.cjs"), "core");
    assert_eq!(classify_layer("memory/n.md"), "user");
    assert_eq!(classify_layer("CLAUDE.md"), "user");
    assert_eq!(classify_layer("settings.json"), "core");
    assert_eq!(classify_layer("elsewhere/f"), "user");
}

#[test]
fn a_cache_path_that_climbs_out_is_never_found() {
    let root = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(root.path().join(".meowkit/cache")).unwrap();
    std::fs::write(root.path().join(".meowkit/outside.md"), "x").unwrap();
    assert!(cached_kit_file(root.path(), "../outside.md").is_none());
}
