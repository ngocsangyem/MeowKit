//! The kit fetcher against an in-memory release server and real zip bytes.
use std::cell::RefCell;
use std::collections::HashMap;
use std::io::Write;
use std::path::Path;

use mewkit_core::fsx::sha256_hex;
use mewkit_core::kit::http::Http;
use mewkit_core::kit::{
    ARCHIVE_NAME, CHECKSUMS_NAME, DOWNLOAD_PREFIX, KitError, KitRequest, RELEASES_URL, Source,
    resolve,
};
use mewkit_core::ownership::Origin;
use serde_json::json;
use zip::write::SimpleFileOptions;

const CONTRACT: &str =
    r#"{"kitContract":1,"requires":{"mewkitMin":"0.1.0"},"kitVersion":"2.16.0"}"#;

#[derive(Default)]
struct FakeHttp {
    bodies: HashMap<String, Vec<u8>>,
    calls: RefCell<Vec<String>>,
}

impl Http for FakeHttp {
    fn get(&self, url: &str, _limit: u64) -> Result<Vec<u8>, KitError> {
        self.calls.borrow_mut().push(url.to_owned());
        self.bodies
            .get(url)
            .cloned()
            .ok_or_else(|| KitError::Http(format!("GET {url}: 404")))
    }
}

enum Member<'a> {
    File(&'a str, &'a str, u32),
    Symlink(&'a str, &'a str),
}

fn zip_of(members: &[Member]) -> Vec<u8> {
    let mut w = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
    for m in members {
        match m {
            Member::File(name, body, mode) => {
                let opts = SimpleFileOptions::default()
                    .compression_method(zip::CompressionMethod::Stored)
                    .unix_permissions(*mode);
                w.start_file(*name, opts).unwrap();
                w.write_all(body.as_bytes()).unwrap();
            }
            Member::Symlink(name, target) => {
                w.add_symlink(*name, *target, SimpleFileOptions::default())
                    .unwrap();
            }
        }
    }
    w.finish().unwrap().into_inner()
}

fn good_zip() -> Vec<u8> {
    zip_of(&[
        Member::File(".claude/kit-contract.json", CONTRACT, 0o644),
        Member::File(".claude/hooks/gate.cjs", "gate", 0o755),
        Member::File("release-manifest.json", "{}", 0o644),
    ])
}

/// A server with one kit release `v2.16.0` (plus a binary release to ignore).
fn server(zip: &[u8], checksums: Option<String>) -> FakeHttp {
    let base = format!("{DOWNLOAD_PREFIX}v2.16.0");
    let mut assets = vec![
        json!({"name": ARCHIVE_NAME, "browser_download_url": format!("{base}/{ARCHIVE_NAME}")}),
    ];
    let mut http = FakeHttp::default();
    if let Some(body) = checksums {
        assets.push(json!({"name": CHECKSUMS_NAME, "browser_download_url": format!("{base}/{CHECKSUMS_NAME}")}));
        http.bodies
            .insert(format!("{base}/{CHECKSUMS_NAME}"), body.into_bytes());
    }
    let listing = json!([
        {"tag_name": "mewkit-v9.0.0", "assets": [{"name": ARCHIVE_NAME, "browser_download_url": "https://dl/bin"}]},
        {"tag_name": "v2.16.0", "assets": assets},
    ]);
    http.bodies
        .insert(RELEASES_URL.into(), listing.to_string().into_bytes());
    http.bodies
        .insert(format!("{base}/{ARCHIVE_NAME}"), zip.to_vec());
    http
}

fn sums(zip: &[u8]) -> Option<String> {
    Some(format!("{}  {ARCHIVE_NAME}\n", sha256_hex(zip)))
}

fn req(cache: &Path, source: Source, allow_unverified: bool) -> KitRequest<'_> {
    KitRequest {
        source,
        allow_unverified,
        cache_dir: cache,
        binary_version: "0.1.0",
    }
}

fn latest(cache: &Path) -> KitRequest<'_> {
    req(cache, Source::Latest { beta: false }, false)
}

/// Cache entries that are published (staging directories excluded).
fn cached(cache: &Path) -> Vec<String> {
    let mut v: Vec<String> = std::fs::read_dir(cache)
        .into_iter()
        .flatten()
        .flatten()
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .collect();
    v.sort();
    v
}

#[test]
fn a_verified_release_is_extracted_cached_and_reusable_offline() {
    let cache = tempfile::tempdir().unwrap();
    let zip = good_zip();
    let http = server(&zip, sums(&zip));
    let kit = resolve(&latest(cache.path()), &http).unwrap();
    assert_eq!(kit.version, "2.16.0");
    assert_eq!(kit.origin, Origin::Release);
    assert_eq!(kit.digest.as_deref(), Some(sha256_hex(&zip).as_str()));
    assert_eq!(
        std::fs::read_to_string(kit.dir.join(".claude/hooks/gate.cjs")).unwrap(),
        "gate"
    );
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = std::fs::metadata(kit.dir.join(".claude/hooks/gate.cjs"))
            .unwrap()
            .permissions()
            .mode();
        assert_eq!(mode & 0o777, 0o755);
    }
    assert!(kit.notices.is_empty(), "{:?}", kit.notices);

    let offline = FakeHttp::default();
    let again = resolve(
        &req(cache.path(), Source::Offline { version: None }, false),
        &offline,
    )
    .unwrap();
    assert_eq!(again.dir, kit.dir);
    assert_eq!(again.origin, Origin::Release);
    assert!(offline.calls.borrow().is_empty());
}

#[test]
fn a_digest_mismatch_is_terminal_and_extracts_nothing() {
    let cache = tempfile::tempdir().unwrap();
    let zip = good_zip();
    let http = server(&zip, sums(b"some other archive"));
    let err = resolve(&latest(cache.path()), &http).unwrap_err();
    assert!(matches!(err, KitError::Checksum(_)), "{err}");
    // Even --allow-unverified-kit cannot get past a mismatch.
    let err = resolve(
        &req(cache.path(), Source::Latest { beta: false }, true),
        &http,
    )
    .unwrap_err();
    assert!(matches!(err, KitError::Checksum(_)), "{err}");
    assert!(cached(cache.path()).is_empty());
}

#[test]
fn a_release_without_checksums_needs_allow_unverified_and_is_recorded() {
    let cache = tempfile::tempdir().unwrap();
    let zip = good_zip();
    let http = server(&zip, None);
    let err = resolve(&latest(cache.path()), &http).unwrap_err();
    assert!(err.to_string().contains("--allow-unverified-kit"), "{err}");
    assert!(cached(cache.path()).is_empty());

    let kit = resolve(
        &req(cache.path(), Source::Latest { beta: false }, true),
        &http,
    )
    .unwrap();
    assert_eq!(kit.origin, Origin::Unverified);
    assert!(kit.notices.iter().any(|n| n.contains("without a checksum")));
    // The unverified cache entry is not usable offline without the flag either.
    let offline = req(cache.path(), Source::Offline { version: None }, false);
    assert!(matches!(
        resolve(&offline, &FakeHttp::default()),
        Err(KitError::Unverified(_))
    ));
}

#[test]
fn unsafe_members_are_refused_before_the_cache_sees_them() {
    for zip in [
        zip_of(&[
            Member::File(".claude/kit-contract.json", CONTRACT, 0o644),
            Member::File("../escape", "x", 0o644),
        ]),
        zip_of(&[Member::File("/etc/escape", "x", 0o644)]),
        zip_of(&[Member::File(".claude\\..\\escape", "x", 0o644)]),
        zip_of(&[Member::Symlink(".claude/link", "/etc/passwd")]),
    ] {
        let cache = tempfile::tempdir().unwrap();
        let http = server(&zip, sums(&zip));
        let err = resolve(&latest(cache.path()), &http).unwrap_err();
        assert!(matches!(err, KitError::Unsafe(_)), "{err}");
        assert!(cached(cache.path()).is_empty());
        assert!(!cache.path().parent().unwrap().join("escape").exists());
    }
}

#[test]
fn a_kit_outside_the_contract_range_is_refused() {
    for (contract, needle) in [
        (
            r#"{"kitContract":2,"requires":{"mewkitMin":"0.1.0"},"kitVersion":"3.0.0"}"#,
            "kit contract 2",
        ),
        (
            r#"{"kitContract":1,"requires":{"mewkitMin":"0.9.0"},"kitVersion":"3.0.0"}"#,
            "needs mewkit ≥ 0.9.0",
        ),
    ] {
        let cache = tempfile::tempdir().unwrap();
        let zip = zip_of(&[Member::File(".claude/kit-contract.json", contract, 0o644)]);
        let http = server(&zip, sums(&zip));
        let err = resolve(&latest(cache.path()), &http).unwrap_err();
        assert!(
            matches!(err, KitError::Contract(_)) && err.to_string().contains(needle),
            "{err}"
        );
        assert!(cached(cache.path()).is_empty());
    }
    // A kit with no contract at all is refused unless unverified kits are allowed.
    let cache = tempfile::tempdir().unwrap();
    let zip = zip_of(&[Member::File(".claude/x", "x", 0o644)]);
    let http = server(&zip, sums(&zip));
    assert!(matches!(
        resolve(&latest(cache.path()), &http),
        Err(KitError::Contract(_))
    ));
    let kit = resolve(
        &req(cache.path(), Source::Latest { beta: false }, true),
        &http,
    )
    .unwrap();
    assert!(kit.contract.is_none());
}

#[test]
fn a_local_archive_needs_its_digest_and_a_local_dir_is_flagged() {
    let cache = tempfile::tempdir().unwrap();
    let file = cache.path().join("kit.zip");
    let zip = good_zip();
    std::fs::write(&file, &zip).unwrap();
    let wrong = Source::Archive {
        file: file.clone(),
        sha256: sha256_hex(b"nope"),
    };
    assert!(matches!(
        resolve(&req(cache.path(), wrong, true), &FakeHttp::default()),
        Err(KitError::Checksum(_))
    ));
    let right = Source::Archive {
        file,
        sha256: sha256_hex(&zip).to_uppercase(),
    };
    let kit = resolve(&req(cache.path(), right, false), &FakeHttp::default()).unwrap();
    assert_eq!(
        (kit.origin, kit.version.as_str()),
        (Origin::Archive, "2.16.0")
    );

    let dir = resolve(
        &req(cache.path(), Source::Dir(kit.dir.clone()), false),
        &FakeHttp::default(),
    )
    .unwrap();
    assert_eq!(dir.origin, Origin::LocalDir);
    assert!(dir.notices.iter().any(|n| n.contains("not verified")));
}

#[test]
fn offline_with_an_empty_cache_says_to_go_online() {
    let cache = tempfile::tempdir().unwrap();
    let err = resolve(
        &req(
            cache.path(),
            Source::Offline {
                version: Some("2.16.0".into()),
            },
            false,
        ),
        &FakeHttp::default(),
    )
    .unwrap_err();
    assert!(
        matches!(err, KitError::Offline(_)) && err.to_string().contains("online"),
        "{err}"
    );
}

#[test]
fn asset_urls_outside_this_repository_are_refused() {
    let cache = tempfile::tempdir().unwrap();
    let zip = good_zip();
    let mut http = server(&zip, sums(&zip));
    let listing = json!([{"tag_name": "v2.16.0", "assets": [
        {"name": ARCHIVE_NAME, "browser_download_url": "http://evil.example/meowkit-release.zip"},
        {"name": CHECKSUMS_NAME, "browser_download_url": "http://evil.example/checksums.txt"},
    ]}]);
    http.bodies
        .insert(RELEASES_URL.into(), listing.to_string().into_bytes());
    let err = resolve(&latest(cache.path()), &http).unwrap_err();
    assert!(err.to_string().contains("not a release download"), "{err}");
    assert!(!http.calls.borrow().iter().any(|u| u.contains("evil")));
}
