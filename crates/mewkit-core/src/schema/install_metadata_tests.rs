//! Ports of the `readInstallMetadata precedence` cases in
//! `core/__tests__/install-metadata.test.ts`, minus the filesystem scan (the
//! builder is the installer's job, not the schema's).

use serde_json::json;

use super::*;

fn metadata() -> serde_json::Value {
    json!({
        "schemaVersion": "1.0",
        "tool": "meowkit",
        "version": "2.9.13",
        "installedAt": "2026-07-12T00:00:00.000Z",
        "files": [{
            "path": "rules/a.md",
            "owner": "meowkit",
            "layer": "core",
            "checksum": "aa",
            "baseChecksum": "aa",
            "installedVersion": "2.9.13"
        }]
    })
}

#[test]
fn accepts_a_canonical_metadata_record() {
    let meta = InstallMetadata::parse(&metadata()).expect("valid metadata");
    assert_eq!(meta.version, "2.9.13");
    assert_eq!(meta.files.len(), 1);
    assert_eq!(meta.files[0].owner, FileOwner::Meowkit);
    assert_eq!(meta.files[0].layer, FileLayer::Core);
}

#[test]
fn defaults_the_tool_name_and_omits_absent_optional_fields() {
    let mut record = metadata();
    record.as_object_mut().expect("object").remove("tool");
    let meta = InstallMetadata::parse(&record).expect("tool has a default");
    assert_eq!(meta.tool, "meowkit");
    let back = serde_json::to_value(&meta).expect("serializable");
    // `.optional()` fields are omitted, not written as null — an absent
    // provenance must read as unknown, and `"provenance": null` would claim the
    // install recorded one.
    assert!(back.get("provenance").is_none());
    assert!(back.get("packs").is_none());
}

#[test]
fn refuses_a_corrupt_canonical_record_instead_of_falling_through() {
    let err = InstallMetadata::parse(&json!({ "schemaVersion": "1.0", "version": 123 }))
        .expect_err("a version that is not a string is corrupt");
    assert!(
        err.to_string()
            .starts_with("Corrupt install metadata.json: "),
        "{err}"
    );
}

#[test]
fn refuses_an_owner_or_layer_outside_the_closed_set() {
    let mut bad = metadata();
    bad["files"][0]["owner"] = json!("someone-else");
    assert!(InstallMetadata::parse(&bad).is_err());

    let mut bad = metadata();
    bad["files"][0]["layer"] = json!("plugin");
    assert!(InstallMetadata::parse(&bad).is_err());
}

#[test]
fn provenance_round_trips_its_closed_vocabularies() {
    let mut record = metadata();
    record["provenance"] = json!({
        "kitVersion": "2.9.13",
        "cliVersion": "0.1.0",
        "target": "claude-code",
        "delivery": "native",
        "origin": "release-zip"
    });
    let meta = InstallMetadata::parse(&record).expect("valid provenance");
    let provenance = meta.provenance.as_ref().expect("recorded");
    assert_eq!(provenance.target, InstallTarget::ClaudeCode);
    assert_eq!(provenance.origin, InstallOrigin::ReleaseZip);
    let back = serde_json::to_value(&meta).expect("serializable");
    assert_eq!(back["provenance"]["target"], json!("claude-code"));
    assert_eq!(back["provenance"]["origin"], json!("release-zip"));
}

#[test]
fn refuses_an_origin_outside_the_closed_set() {
    let mut bad = metadata();
    bad["provenance"] = json!({
        "kitVersion": "1", "cliVersion": "1",
        "target": "claude-code", "delivery": "native", "origin": "curl-pipe-bash"
    });
    assert!(InstallMetadata::parse(&bad).is_err());
}

#[test]
fn index_by_path_keys_on_the_claude_relative_path() {
    let meta = InstallMetadata::parse(&metadata()).expect("valid");
    let index = meta.index_by_path();
    assert_eq!(index["rules/a.md"].checksum, "aa");
}
