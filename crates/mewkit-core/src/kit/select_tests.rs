use super::*;

fn rel(tag: &str, assets: &[&str]) -> Release {
    Release {
        tag_name: tag.into(),
        draft: false,
        prerelease: tag.contains('-'),
        assets: assets
            .iter()
            .map(|n| Asset {
                name: (*n).into(),
                browser_download_url: format!("https://dl/{tag}/{n}"),
            })
            .collect(),
    }
}

const BOTH: &[&str] = &[ARCHIVE_NAME, CHECKSUMS_NAME];

#[test]
fn binary_releases_are_never_kit_candidates() {
    let rs = [rel("mewkit-v9.0.0", BOTH), rel("v2.16.0", BOTH)];
    assert_eq!(choose(&rs, None, false).unwrap().version, "2.16.0");
    assert!(choose(&rs, Some("mewkit-v9.0.0"), false).is_err());
}

#[test]
fn newest_stable_wins_and_a_release_beats_its_prerelease() {
    let rs = [
        rel("v2.15.0", BOTH),
        rel("v2.16.0-beta.1", BOTH),
        rel("v2.10.0", BOTH),
    ];
    assert_eq!(choose(&rs, None, false).unwrap().version, "2.15.0");
    assert_eq!(choose(&rs, None, true).unwrap().version, "2.16.0-beta.1");
    let rs = [rel("v2.16.0-beta.1", BOTH), rel("v2.16.0", BOTH)];
    assert_eq!(choose(&rs, None, true).unwrap().version, "2.16.0");
}

#[test]
fn releases_without_the_archive_are_skipped_and_checksums_are_optional() {
    let rs = [
        rel("v3.0.0", &[CHECKSUMS_NAME]),
        rel("v2.15.0", &[ARCHIVE_NAME]),
    ];
    let c = choose(&rs, None, false).unwrap();
    assert_eq!(c.version, "2.15.0");
    assert_eq!(c.checksums_url, None);
}

#[test]
fn an_explicit_tag_matches_with_or_without_v() {
    let rs = [rel("v2.15.0", BOTH), rel("v2.16.0", BOTH)];
    assert_eq!(
        choose(&rs, Some("2.15.0"), false).unwrap().version,
        "2.15.0"
    );
    assert_eq!(
        choose(&rs, Some("v2.15.0"), false).unwrap().version,
        "2.15.0"
    );
    assert!(choose(&rs, Some("v1.0.0"), false).is_err());
}

#[test]
fn malformed_tags_do_not_parse() {
    for t in ["2.0.0", "v2.0", "v2.0.0.1", "vx.1.2", "mewkit-v1.0.0"] {
        assert!(Version::parse(t).is_none(), "{t}");
    }
}

#[test]
fn a_draft_is_never_chosen_even_by_tag() {
    let mut draft = rel("v2.17.0", BOTH);
    draft.draft = true;
    assert!(choose(&[draft], Some("v2.17.0"), true).is_err());
}
