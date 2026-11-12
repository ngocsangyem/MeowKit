//! Ports of `core/__tests__/hook-runtime.test.ts`. The filesystem cases run
//! against real temp trees: the trust gate is about realpaths, and a mocked
//! filesystem would prove nothing about the escape it exists to stop.

use std::fs;
use std::path::PathBuf;

use serde_json::json;
use tempfile::TempDir;

use super::*;

const NOW: &str = "2026-07-19T20:00:00.000Z";

struct Project {
    _dir: TempDir,
    root: PathBuf,
    claude_dir: PathBuf,
    bin: PathBuf,
}

fn make_project() -> Project {
    let dir = TempDir::new().expect("temp dir");
    // Canonicalized so the fixture's own symlinked temp root (macOS
    // `/var` → `/private/var`) is not mistaken for the escape under test.
    let root = dir.path().canonicalize().expect("canonical root");
    let claude_dir = root.join(".claude");
    fs::create_dir_all(&claude_dir).expect("claude dir");
    let bin_dir = root.join("node_modules").join(".bin");
    fs::create_dir_all(&bin_dir).expect("bin dir");
    let bin = bin_dir.join("mewkit");
    fs::write(&bin, "#!/usr/bin/env node\n").expect("bin file");
    Project {
        _dir: dir,
        root,
        claude_dir,
        bin,
    }
}

#[test]
fn accepts_an_existing_absolute_file_inside_the_project() {
    let p = make_project();
    assert!(executable_is_trusted(&p.bin.to_string_lossy(), &p.root));
}

#[test]
fn rejects_a_relative_path_a_missing_file_and_a_path_outside_the_project() {
    let p = make_project();
    assert!(!executable_is_trusted("node_modules/.bin/mewkit", &p.root));
    assert!(!executable_is_trusted(
        &p.root.join("nope").to_string_lossy(),
        &p.root
    ));
    assert!(!executable_is_trusted("/usr/local/bin/mewkit", &p.root));
    assert!(!executable_is_trusted("/tmp/evil", &p.root));
    assert!(!executable_is_trusted("", &p.root));
}

#[cfg(unix)]
#[test]
fn rejects_a_symlink_whose_real_target_escapes_the_project() {
    let p = make_project();
    let outside = TempDir::new().expect("outside dir");
    let evil = outside.path().join("evil");
    fs::write(&evil, "#!/bin/sh\n").expect("evil file");
    let link = p.root.join("node_modules").join(".bin").join("evil-link");
    std::os::unix::fs::symlink(&evil, &link).expect("symlink");
    // Lexically inside the project; its real target is not → refused.
    assert!(!executable_is_trusted(&link.to_string_lossy(), &p.root));
}

#[test]
fn accepts_a_well_formed_descriptor_for_an_in_project_executable() {
    let p = make_project();
    let payload = json!({
        "schemaVersion": "1.0",
        "executable": p.bin.to_string_lossy(),
        "packageVersion": "1.18.2",
        "writtenAt": NOW
    });
    let descriptor = accept(&payload, &p.root).expect("trusted descriptor");
    assert_eq!(descriptor.package_version, "1.18.2");
    assert_eq!(
        descriptor_path(&p.claude_dir).file_name().expect("name"),
        "runtime.json"
    );
}

#[test]
fn refuses_a_descriptor_whose_executable_escaped_the_project() {
    let p = make_project();
    let payload = json!({
        "schemaVersion": "1.0",
        "executable": "/tmp/evil",
        "packageVersion": "x",
        "writtenAt": NOW
    });
    assert_eq!(accept(&payload, &p.root), Err(DescriptorRefusal::Untrusted));
    assert_eq!(
        DescriptorRefusal::Untrusted.to_string(),
        "runtime executable missing or outside the project boundary"
    );
}

#[test]
fn refuses_a_corrupt_descriptor_with_a_reason_rather_than_a_panic() {
    let p = make_project();
    let refusal = accept(&json!({ "schemaVersion": "1.0" }), &p.root)
        .expect_err("a descriptor with no executable is invalid");
    assert!(
        refusal
            .to_string()
            .starts_with("invalid runtime descriptor: "),
        "{refusal}"
    );
    let stale = accept(
        &json!({ "schemaVersion": "9.9", "executable": "/x" }),
        &p.root,
    )
    .expect_err("an unreadable schemaVersion is invalid");
    assert!(matches!(stale, DescriptorRefusal::Invalid(_)));
}

#[test]
fn describe_refuses_an_executable_outside_the_project() {
    let p = make_project();
    let err = describe("/usr/local/bin/mewkit", "x", NOW, &p.root)
        .expect_err("an out-of-project executable is never recorded");
    assert!(
        err.starts_with("refusing to write runtime descriptor: "),
        "{err}"
    );
}

#[test]
fn describe_records_the_in_project_executable_and_round_trips() {
    let p = make_project();
    let exe = p.bin.to_string_lossy().to_string();
    let descriptor = describe(&exe, "1.18.2", NOW, &p.root).expect("trusted");
    let back = serde_json::to_value(&descriptor).expect("serializable");
    assert_eq!(back["schemaVersion"], json!("1.0"));
    assert_eq!(back["executable"], json!(exe));
    assert_eq!(
        RuntimeDescriptor::parse(&back).expect("round-trips"),
        descriptor
    );
}

#[test]
fn preserves_an_unknown_additive_field() {
    let p = make_project();
    let payload = json!({
        "schemaVersion": "1.0",
        "executable": p.bin.to_string_lossy(),
        "futureField": 7
    });
    let descriptor = accept(&payload, &p.root).expect("trusted");
    assert_eq!(descriptor.extra["futureField"], json!(7));
}
