//! `orientation-ritual.cjs` against the runtime descriptor the Rust schema produces.

use super::*;

const DRIVER: &str = r#"
const path = require('node:path');
const root = process.env.CLAUDE_PROJECT_DIR;
const handler = require(path.join(root, '.claude', 'hooks', 'handlers', 'orientation-ritual.cjs'));
process.stdout.write(handler({ source: 'resume' }) || '');
"#;

/// descriptor with `descriptor_edit` applied, and returns what the handler
/// injects.
fn handler_output(descriptor_edit: impl FnOnce(&mut Value)) -> String {
    let s = scratch("mewkit-mirror-handler-", "active-task");
    let hooks = s.project.join(".claude/hooks");
    copy_tree(
        &parity::repo_root().join(".claude/hooks/lib"),
        &hooks.join("lib"),
    );
    std::fs::create_dir_all(hooks.join("handlers")).expect("create the handlers dir");
    std::fs::copy(
        hook("handlers/orientation-ritual.cjs"),
        hooks.join("handlers/orientation-ritual.cjs"),
    )
    .expect("copy the handler");
    let binary = s.project.join(".claude").join(if cfg!(windows) {
        "mewkit.exe"
    } else {
        "mewkit"
    });
    std::fs::copy(env!("CARGO_BIN_EXE_mewkit"), &binary).expect("copy the binary");

    // The descriptor comes from the Rust schema module, not from this file.
    let described = mewkit_core::schema::runtime_descriptor::describe(
        &binary.to_string_lossy(),
        "0.0.0-test",
        "2026-11-14T00:00:00Z",
        &s.project,
    )
    .expect("describe a trusted executable");
    let mut value = serde_json::to_value(&described).expect("encode the descriptor");
    descriptor_edit(&mut value);
    write_json(&s.project.join(".claude/runtime.json"), &value);

    let driver = s.project.join("drive-handler.cjs");
    std::fs::write(&driver, DRIVER).expect("write the driver");
    let (code, text) = node(&s, &[driver.as_ref()]);
    assert_eq!(code, 0, "the handler failed: {text}");
    text
}

#[test]
#[ignore = "needs node and the TS build"]
fn the_handler_trusts_the_runtime_descriptor_the_rust_schema_produces() {
    let Some(_) = parity::check("hook-mirror-runtime-descriptor") else {
        return;
    };
    let injected = handler_output(|_| {});
    assert!(
        injected.contains("orientation: active") && injected.contains("task: alpha"),
        "the handler did not accept the Rust descriptor: {injected:?}"
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn the_handler_refuses_a_descriptor_whose_shape_changed() {
    let Some(_) = parity::check("hook-mirror-runtime-descriptor-neg") else {
        return;
    };
    let renamed_field = handler_output(|v| {
        let object = v.as_object_mut().expect("an object");
        let exe = object.remove("executable").expect("the executable field");
        object.insert("exe".into(), exe);
    });
    let bumped_version = handler_output(|v| v["schemaVersion"] = json!("2.0"));
    for (what, injected) in [
        ("renamed executable", renamed_field),
        ("schemaVersion 2.0", bumped_version),
    ] {
        assert!(
            !injected.contains("orientation: active"),
            "the handler still ran the runtime after the descriptor changed ({what}): {injected:?}"
        );
    }
}
