use super::*;

fn listed(version: &str) -> Listed {
    Listed {
        version: version.to_owned(),
        prerelease: version.contains('-'),
        verified: true,
    }
}

#[test]
fn each_channel_is_headed_by_its_newest_release() {
    let c = Channels::from_listing(vec![
        listed("2.17.0-beta.2"),
        listed("2.16.1"),
        listed("2.16.0"),
    ]);
    assert_eq!(c.stable, Some(listed("2.16.1")));
    assert_eq!(c.beta, Some(listed("2.17.0-beta.2")));
    assert_eq!(c.target(false), Some(&listed("2.16.1")));
    assert_eq!(c.target(true), Some(&listed("2.17.0-beta.2")));
}

#[test]
fn beta_falls_back_to_stable_and_an_empty_listing_has_no_target() {
    let c = Channels::from_listing(vec![listed("2.16.0")]);
    assert_eq!(c.beta, None);
    assert_eq!(c.target(true), Some(&listed("2.16.0")));

    let none = Channels::from_listing(Vec::new());
    assert_eq!(none.target(false), None);
    assert_eq!(none.target(true), None);
}

#[test]
fn a_beta_only_listing_has_no_stable_target() {
    let c = Channels::from_listing(vec![listed("3.0.0-rc.1")]);
    assert_eq!(c.target(false), None);
    assert_eq!(c.target(true), Some(&listed("3.0.0-rc.1")));
}

#[test]
fn an_empty_cache_offers_nothing_offline() {
    let dir = std::env::temp_dir().join(format!("mewkit-channels-{}", std::process::id()));
    let c = offline(&dir);
    assert!(c.releases.is_empty());
}
