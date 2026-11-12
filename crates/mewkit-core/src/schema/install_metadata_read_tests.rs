//! Precedence cases from the `readInstallMetadata precedence` suite in
//! `core/__tests__/install-metadata.test.ts`, minus the filesystem (this layer
//! classifies an already-read payload).

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
            "baseChecksum": "aa"
        }]
    })
}

#[test]
fn classify_returns_none_for_an_absent_payload() {
    let (source, meta) = classify(None).expect("absent is not corrupt");
    assert_eq!(source, MetadataSource::None);
    assert!(meta.is_none());
}

#[test]
fn classify_returns_new_for_a_schema_version_bearing_payload() {
    let record = metadata();
    let (source, meta) = classify(Some(&record)).expect("valid");
    assert_eq!(source, MetadataSource::New);
    assert_eq!(meta.expect("record").version, "2.9.13");
}

#[test]
fn classify_returns_legacy_metadata_for_a_version_only_payload() {
    let record = json!({ "version": "2.8.0" });
    let (source, meta) = classify(Some(&record)).expect("valid");
    assert_eq!(source, MetadataSource::LegacyMetadata);
    let meta = meta.expect("synthesized record");
    assert_eq!(meta.version, "2.8.0");
    assert!(meta.files.is_empty());
}

#[test]
fn classify_propagates_corruption_rather_than_reporting_no_install() {
    let record = json!({ "schemaVersion": "1.0", "version": 123 });
    assert!(classify(Some(&record)).is_err());
}
