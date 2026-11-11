//! The release job's manifest is one `self-update` accepts, and the pins the
//! installers are re-rendered from come from it unchanged.
mod support;

use mewkit_core::fsx::sha256_hex;
use mewkit_core::update::manifest::{DOWNLOAD_PREFIX, Manifest};
use support::release::{TARGETS, archive, asset_name, node};
use support::{code, text};

/// Six archives for `version` in a fresh directory.
fn release_dir(version: &str) -> tempfile::TempDir {
    let dir = tempfile::tempdir().unwrap();
    for t in TARGETS {
        let bytes = archive(version, t, t.as_bytes());
        std::fs::write(dir.path().join(asset_name(version, t)), bytes).unwrap();
    }
    dir
}

fn build(dir: &std::path::Path, version: &str, extra: &[&str]) -> std::process::Output {
    let d = dir.to_string_lossy();
    let mut args = vec!["--version", version, "--dir", &d];
    args.extend(extra);
    node("build-binary-manifest.mjs", &args)
}

#[test]
fn the_built_manifest_parses_and_matches_the_archives() {
    let version = "9.9.9-beta.2";
    let dir = release_dir(version);
    let out = build(dir.path(), version, &["--min-supported", "9.9.0"]);
    assert_eq!(code(&out), 0, "{}", text(&out));

    let bytes = std::fs::read(dir.path().join("binary-manifest.json")).unwrap();
    let m = Manifest::parse(&bytes).expect("self-update accepts it");
    assert_eq!((m.version.as_str(), m.channel.as_str()), (version, "beta"));
    assert_eq!(m.min_supported, "9.9.0");
    assert_eq!(m.targets.len(), 6);
    let sums = std::fs::read_to_string(dir.path().join("checksums.txt")).unwrap();
    for t in TARGETS {
        let name = asset_name(version, t);
        let file = std::fs::read(dir.path().join(&name)).unwrap();
        let entry = &m.targets[t];
        assert_eq!(entry.sha256, sha256_hex(&file));
        assert_eq!(entry.size, file.len() as u64);
        assert_eq!(
            entry.url,
            format!("{DOWNLOAD_PREFIX}mewkit-v{version}/{name}")
        );
        assert!(
            sums.contains(&format!("{}  {name}\n", entry.sha256)),
            "{sums}"
        );
    }
}

#[test]
fn a_missing_target_or_a_floor_above_the_version_publishes_nothing() {
    let dir = release_dir("1.2.0");
    let out = build(dir.path(), "1.2.0", &["--min-supported", "1.3.0"]);
    assert_eq!(code(&out), 1, "{}", text(&out));
    std::fs::remove_file(dir.path().join(asset_name("1.2.0", TARGETS[5]))).unwrap();
    let out = build(dir.path(), "1.2.0", &[]);
    assert_eq!(code(&out), 1, "{}", text(&out));
    assert!(text(&out).contains("missing archive"), "{}", text(&out));
    assert!(!dir.path().join("binary-manifest.json").exists());
}

#[test]
fn a_release_manifest_becomes_its_channel_pin_and_keeps_the_other() {
    let dir = release_dir("2.0.0");
    assert_eq!(code(&build(dir.path(), "2.0.0", &[])), 0);
    let pins = dir.path().join("pins.json");
    let beta = serde_json::json!({ "version": "2.1.0-beta.1", "targets": TARGETS.iter().map(|t| {
        ((*t).to_owned(), serde_json::json!({
            "url": format!("https://example.invalid/{t}.tar.gz"), "sha256": "a".repeat(64), "size": 1
        }))
    }).collect::<serde_json::Map<_, _>>() });
    std::fs::write(
        &pins,
        serde_json::json!({ "stable": null, "beta": beta }).to_string(),
    )
    .unwrap();
    let manifest = dir.path().join("binary-manifest.json");
    let out = node(
        "render-installers.mjs",
        &[
            "--manifest",
            &manifest.to_string_lossy(),
            "--pins",
            &pins.to_string_lossy(),
            "--out-dir",
            &dir.path().to_string_lossy(),
        ],
    );
    assert_eq!(code(&out), 0, "{}", text(&out));
    let written: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&pins).unwrap()).unwrap();
    assert_eq!(written["stable"]["version"], "2.0.0");
    assert_eq!(written["beta"], beta, "the other channel is kept");
    let sh = std::fs::read_to_string(dir.path().join("install.sh")).unwrap();
    assert!(
        sh.contains("stable:aarch64-apple-darwin) echo \"2.0.0 "),
        "{sh}"
    );
    assert!(
        !sh.contains("windows"),
        "Windows pins only go to install.ps1"
    );
    let ps1 = std::fs::read_to_string(dir.path().join("install.ps1")).unwrap();
    assert!(ps1.contains("'stable:x86_64-pc-windows-msvc' = @{ Version = '2.0.0'"));
}

#[test]
fn a_pin_that_could_inject_shell_is_refused() {
    let dir = tempfile::tempdir().unwrap();
    let pins = dir.path().join("pins.json");
    let evil = serde_json::json!({ "version": "1.0.0", "targets": TARGETS.iter().map(|t| {
        ((*t).to_owned(), serde_json::json!({
            "url": "https://x.invalid/a\"; rm -rf ~; echo \"", "sha256": "a".repeat(64), "size": 1
        }))
    }).collect::<serde_json::Map<_, _>>() });
    std::fs::write(
        &pins,
        serde_json::json!({ "stable": evil, "beta": null }).to_string(),
    )
    .unwrap();
    let out = node(
        "render-installers.mjs",
        &[
            "--pins",
            &pins.to_string_lossy(),
            "--out-dir",
            &dir.path().to_string_lossy(),
        ],
    );
    assert_eq!(code(&out), 1, "{}", text(&out));
    assert!(
        text(&out).contains("unsafe or malformed url"),
        "{}",
        text(&out)
    );
    assert!(!dir.path().join("install.sh").exists());
}

#[test]
fn a_pin_version_with_a_leading_v_is_refused() {
    let dir = tempfile::tempdir().unwrap();
    let pins = dir.path().join("pins.json");
    let pin = serde_json::json!({ "version": "v1.0.0", "targets": TARGETS.iter().map(|t| {
        ((*t).to_owned(), serde_json::json!({
            "url": "https://example.invalid/a.tar.gz", "sha256": "a".repeat(64), "size": 1
        }))
    }).collect::<serde_json::Map<_, _>>() });
    std::fs::write(
        &pins,
        serde_json::json!({ "stable": pin, "beta": null }).to_string(),
    )
    .unwrap();
    let out = node(
        "render-installers.mjs",
        &[
            "--pins",
            &pins.to_string_lossy(),
            "--out-dir",
            &dir.path().to_string_lossy(),
        ],
    );
    assert_eq!(code(&out), 1, "{}", text(&out));
    assert!(text(&out).contains("no leading v"), "{}", text(&out));
}
