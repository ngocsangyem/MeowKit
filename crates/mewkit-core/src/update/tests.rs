use std::collections::HashMap;
use std::io::Write;

use super::*;
use crate::fsx::sha256_hex;

const DL: &str = "https://github.com/ngocsangyem/MeowKit/releases/download/";

/// Serves fixed bodies by URL.
struct Fake(HashMap<String, Vec<u8>>);

impl Http for Fake {
    fn get(&self, url: &str, limit: u64) -> Result<Vec<u8>, KitError> {
        let body = self
            .0
            .get(url)
            .cloned()
            .ok_or_else(|| KitError::Http(format!("GET {url}: 404")))?;
        if body.len() as u64 > limit {
            return Err(KitError::Http(format!("GET {url}: over {limit} bytes")));
        }
        Ok(body)
    }
}

fn tar_gz(name: &str, bytes: &[u8]) -> Vec<u8> {
    let gz = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
    let mut tar = tar::Builder::new(gz);
    let mut h = tar::Header::new_gnu();
    h.set_size(bytes.len() as u64);
    h.set_mode(0o755);
    h.set_cksum();
    tar.append_data(&mut h, format!("mewkit-next-x/{name}"), bytes)
        .unwrap();
    tar.into_inner().unwrap().finish().unwrap()
}

struct Release {
    tag: String,
    prerelease: bool,
}

fn listing(releases: &[Release]) -> Vec<u8> {
    let rows: Vec<_> = releases
        .iter()
        .map(|r| {
            serde_json::json!({
                "tag_name": r.tag,
                "prerelease": r.prerelease,
                "assets": [{"name": MANIFEST_NAME,
                    "browser_download_url": format!("{DL}{}/{MANIFEST_NAME}", r.tag)}],
            })
        })
        .collect();
    serde_json::to_vec(&rows).unwrap()
}

fn manifest(version: &str, url: &str, sha: &str, size: u64) -> String {
    let target = current_target().unwrap();
    serde_json::json!({
        "version": version,
        "channel": "stable",
        "published_at": "2026-11-11T00:00:00Z",
        "min_supported": "0.1.0",
        "targets": {target: {"url": url, "sha256": sha, "size": size}},
    })
    .to_string()
}

/// A server with one stable release `version` whose archive holds `binary`,
/// plus a kit release that must be ignored.
fn server(version: &str, archive: &[u8], manifest_body: Option<String>) -> Fake {
    let tag = format!("{TAG_PREFIX}{version}");
    let url = format!("{DL}{tag}/mewkit-next-x.tar.gz");
    let body = manifest_body
        .unwrap_or_else(|| manifest(version, &url, &sha256_hex(archive), archive.len() as u64));
    let mut map = HashMap::new();
    map.insert(
        RELEASES_URL.to_owned(),
        listing(&[
            Release {
                tag: tag.clone(),
                prerelease: false,
            },
            Release {
                tag: "v9.9.9".into(),
                prerelease: false,
            },
        ]),
    );
    map.insert(format!("{DL}{tag}/{MANIFEST_NAME}"), body.into_bytes());
    map.insert(url, archive.to_vec());
    Fake(map)
}

fn exe_in(dir: &std::path::Path) -> std::path::PathBuf {
    let exe = dir.join(binary_name());
    std::fs::File::create(&exe)
        .unwrap()
        .write_all(b"old binary")
        .unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&exe, std::fs::Permissions::from_mode(0o755)).unwrap();
    }
    exe
}

#[test]
fn a_valid_update_replaces_the_binary_and_keeps_the_old_one() {
    let archive = tar_gz(binary_name(), b"new binary");
    let http = server("1.1.0", &archive, None);
    let offer = check(&http, "1.0.0", Channel::Stable).unwrap();
    assert_eq!(offer.latest, "1.1.0");
    assert!(offer.is_newer() && !offer.withdrawn);
    let dir = tempfile::tempdir().unwrap();
    let exe = exe_in(dir.path());
    let old = apply(&http, &offer, &exe).unwrap();
    assert_eq!(std::fs::read(&exe).unwrap(), b"new binary");
    assert_eq!(std::fs::read(&old).unwrap(), b"old binary");
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = std::fs::metadata(&exe).unwrap().permissions().mode();
        assert_eq!(mode & 0o111, 0o111, "new binary is executable");
    }
    // A second update replaces the kept copy, not piles them up.
    apply(&http, &offer, &exe).unwrap();
    assert_eq!(std::fs::read(&old).unwrap(), b"new binary");
}

#[test]
fn the_same_version_is_up_to_date() {
    let archive = tar_gz(binary_name(), b"new binary");
    let offer = check(&server("1.0.0", &archive, None), "1.0.0", Channel::Stable).unwrap();
    assert!(!offer.is_newer());
}

/// Each refusal leaves the installed binary exactly as it was.
fn refused(http: &Fake, running: &str) -> String {
    let dir = tempfile::tempdir().unwrap();
    let exe = exe_in(dir.path());
    let err = check(http, running, Channel::Stable)
        .and_then(|offer| apply(http, &offer, &exe))
        .expect_err("refused");
    assert_eq!(std::fs::read(&exe).unwrap(), b"old binary");
    assert_eq!(
        std::fs::read_dir(dir.path()).unwrap().count(),
        1,
        "nothing else written"
    );
    err.to_string()
}

#[test]
fn a_digest_mismatch_is_refused() {
    let archive = tar_gz(binary_name(), b"new binary");
    let url = format!("{DL}{TAG_PREFIX}1.1.0/mewkit-next-x.tar.gz");
    let body = manifest("1.1.0", &url, &"0".repeat(64), archive.len() as u64);
    let err = refused(&server("1.1.0", &archive, Some(body)), "1.0.0");
    assert!(err.contains("SHA-256"), "{err}");
}

#[test]
fn a_size_mismatch_is_refused() {
    let archive = tar_gz(binary_name(), b"new binary");
    let url = format!("{DL}{TAG_PREFIX}1.1.0/mewkit-next-x.tar.gz");
    let body = manifest(
        "1.1.0",
        &url,
        &sha256_hex(&archive),
        archive.len() as u64 + 7,
    );
    let err = refused(&server("1.1.0", &archive, Some(body)), "1.0.0");
    assert!(err.contains("bytes, expected"), "{err}");
}

#[test]
fn a_truncated_archive_is_refused_even_when_the_manifest_matches_it() {
    let full = tar_gz(binary_name(), &[7u8; 4096]);
    let cut = &full[..full.len() / 2];
    let err = refused(&server("1.1.0", cut, None), "1.0.0");
    assert!(err.contains("binary archive"), "{err}");
}

#[test]
fn an_archive_without_the_binary_is_refused() {
    let archive = tar_gz("something-else", b"x");
    let err = refused(&server("1.1.0", &archive, None), "1.0.0");
    assert!(err.contains("no mewkit-next"), "{err}");
}

#[test]
fn an_older_manifest_is_never_applied() {
    let archive = tar_gz(binary_name(), b"new binary");
    let http = server("1.0.0", &archive, None);
    let offer = check(&http, "1.2.0", Channel::Stable).unwrap();
    assert!(offer.is_ahead() && !offer.is_newer() && offer.archive.is_none());
    let err = refused(&http, "1.2.0");
    assert!(err.contains("not newer than the running 1.2.0"), "{err}");
    // Even an offer forged to carry an archive is refused by `apply`.
    let forged = Offer {
        archive: Some(Target {
            url: format!("{DL}{TAG_PREFIX}1.0.0/mewkit-next-x.tar.gz"),
            sha256: sha256_hex(&archive),
            size: archive.len() as u64,
        }),
        ..offer
    };
    let dir = tempfile::tempdir().unwrap();
    let exe = exe_in(dir.path());
    assert!(apply(&http, &forged, &exe).is_err());
    assert_eq!(std::fs::read(&exe).unwrap(), b"old binary");
}

#[test]
fn prerelease_identifiers_compare_numerically() {
    use manifest::version;
    assert!(version("1.1.0-beta.10") > version("1.1.0-beta.2"));
    assert!(version("1.1.0") > version("1.1.0-rc.1"));
    assert!(version("1.1.0-rc.1") > version("1.1.0-beta.9"));
    assert!(version("vv1.0.0").is_none());
}

#[test]
fn a_beta_manifest_is_refused_on_stable() {
    let archive = tar_gz(binary_name(), b"new binary");
    let url = format!("{DL}{TAG_PREFIX}1.1.0/mewkit-next-x.tar.gz");
    let body = manifest("1.1.0", &url, &sha256_hex(&archive), archive.len() as u64)
        .replace("\"stable\"", "\"beta\"");
    let err = refused(&server("1.1.0", &archive, Some(body)), "1.0.0");
    assert!(err.contains("not stable"), "{err}");
}

#[test]
fn min_supported_above_version_is_malformed() {
    let archive = tar_gz(binary_name(), b"new binary");
    let url = format!("{DL}{TAG_PREFIX}1.1.0/mewkit-next-x.tar.gz");
    let body = manifest("1.1.0", &url, &sha256_hex(&archive), archive.len() as u64)
        .replace("\"0.1.0\"", "\"2.0.0\"");
    let err = refused(&server("1.1.0", &archive, Some(body)), "1.0.0");
    assert!(err.contains("is above version"), "{err}");
}

#[cfg(unix)]
#[test]
fn replace_keeps_the_original_mode() {
    use std::os::unix::fs::PermissionsExt;
    let archive = tar_gz(binary_name(), b"new binary");
    let http = server("1.1.0", &archive, None);
    let offer = check(&http, "1.0.0", Channel::Stable).unwrap();
    let dir = tempfile::tempdir().unwrap();
    let exe = exe_in(dir.path());
    std::fs::set_permissions(&exe, std::fs::Permissions::from_mode(0o700)).unwrap();
    apply(&http, &offer, &exe).unwrap();
    let mode = std::fs::metadata(&exe).unwrap().permissions().mode() & 0o777;
    assert_eq!(mode, 0o700);
}

#[cfg(unix)]
#[test]
fn a_read_only_directory_changes_nothing() {
    use std::os::unix::fs::PermissionsExt;
    let archive = tar_gz(binary_name(), b"new binary");
    let http = server("1.1.0", &archive, None);
    let offer = check(&http, "1.0.0", Channel::Stable).unwrap();
    let dir = tempfile::tempdir().unwrap();
    let exe = exe_in(dir.path());
    std::fs::set_permissions(dir.path(), std::fs::Permissions::from_mode(0o555)).unwrap();
    let err = apply(&http, &offer, &exe)
        .expect_err("not writable")
        .to_string();
    std::fs::set_permissions(dir.path(), std::fs::Permissions::from_mode(0o755)).unwrap();
    assert!(err.contains("nothing was changed"), "{err}");
    assert_eq!(std::fs::read(&exe).unwrap(), b"old binary");
    assert_eq!(std::fs::read_dir(dir.path()).unwrap().count(), 1);
}

#[test]
fn a_manifest_that_disagrees_with_its_tag_is_refused() {
    let archive = tar_gz(binary_name(), b"new binary");
    let url = format!("{DL}{TAG_PREFIX}1.5.0/mewkit-next-x.tar.gz");
    let body = manifest("1.5.0", &url, &sha256_hex(&archive), archive.len() as u64);
    let err = refused(&server("1.1.0", &archive, Some(body)), "1.0.0");
    assert!(err.contains("but its release is 1.1.0"), "{err}");
}

#[test]
fn an_archive_url_outside_this_repository_is_refused() {
    let archive = tar_gz(binary_name(), b"new binary");
    let body = manifest(
        "1.1.0",
        "https://example.com/mewkit-next-x.tar.gz",
        &sha256_hex(&archive),
        archive.len() as u64,
    );
    let err = refused(&server("1.1.0", &archive, Some(body)), "1.0.0");
    assert!(err.contains("not a release of this repository"), "{err}");
}

#[test]
fn stable_skips_prereleases_and_kit_tags_while_beta_takes_them() {
    let rows = listing(&[
        Release {
            tag: "mewkit-v1.0.0".into(),
            prerelease: false,
        },
        Release {
            tag: "mewkit-v1.1.0-beta.2".into(),
            prerelease: true,
        },
        Release {
            tag: "mewkit-v1.2.0-rc.1".into(),
            prerelease: false,
        },
        Release {
            tag: "v3.0.0".into(),
            prerelease: false,
        },
    ]);
    let releases: Vec<crate::kit::select::Release> = serde_json::from_slice(&rows).unwrap();
    assert_eq!(newest(&releases, Channel::Stable).unwrap().0, "1.0.0");
    assert_eq!(newest(&releases, Channel::Beta).unwrap().0, "1.2.0-rc.1");
}

#[test]
fn a_running_version_below_min_supported_is_withdrawn() {
    let archive = tar_gz(binary_name(), b"new binary");
    let url = format!("{DL}{TAG_PREFIX}1.1.0/mewkit-next-x.tar.gz");
    let body = manifest("1.1.0", &url, &sha256_hex(&archive), archive.len() as u64)
        .replace("\"0.1.0\"", "\"1.1.0\"");
    let offer = check(
        &server("1.1.0", &archive, Some(body)),
        "1.0.0",
        Channel::Stable,
    )
    .unwrap();
    assert!(offer.withdrawn);
}
