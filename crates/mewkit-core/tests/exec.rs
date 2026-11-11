//! The executor end to end against a real temp directory.
use std::path::Path;

use mewkit_core::exec::{ExecError, ExecOptions, Scope, execute};
use mewkit_core::fsx::{PathError, RelPath, sha256_hex};
use mewkit_core::lock::ScopeLock;
use mewkit_core::ownership::{Origin, OwnershipIndex};
use mewkit_core::plan::{Format, Op, Plan};
use serde_json::json;

fn rel(s: &str) -> RelPath {
    RelPath::new(s).unwrap()
}

fn scope(root: &Path) -> Scope {
    Scope {
        root: root.to_path_buf(),
        roots: vec![rel(".codex"), rel("AGENTS.md")],
        index_file: rel(".meowkit/state/ownership/codex.json"),
        lock_file: rel(".meowkit/state/mewkit.lock"),
        backups_dir: rel(".meowkit/backups"),
    }
}

fn install_plan() -> Plan {
    Plan {
        ops: vec![
            Op::WriteFile {
                path: rel(".codex/hooks/gate.cjs"),
                bytes: b"gate".to_vec(),
                mode: Some(0o755),
            },
            Op::MergeBlock {
                path: rel("AGENTS.md"),
                id: "meowkit".into(),
                content: "kit rules".into(),
            },
            Op::MergeEntries {
                path: rel(".codex/config.toml"),
                format: Format::Toml,
                key: vec!["mcp_servers".into()],
                entries: json!({"meowkit": {"command": "node"}})
                    .as_object()
                    .unwrap()
                    .clone(),
            },
        ],
        notices: vec!["hello".into()],
        ..Plan::default()
    }
}

fn uninstall_plan() -> Plan {
    Plan {
        ops: vec![
            Op::RemoveFile {
                path: rel(".codex/hooks/gate.cjs"),
            },
            Op::StripBlock {
                path: rel("AGENTS.md"),
                id: "meowkit".into(),
            },
            Op::StripEntries {
                path: rel(".codex/config.toml"),
                format: Format::Toml,
                key: vec!["mcp_servers".into()],
                names: vec!["meowkit".into()],
            },
        ],
        ..Plan::default()
    }
}

fn kit(p: &RelPath) -> Option<String> {
    (p.as_str() == ".codex/hooks/gate.cjs").then(|| sha256_hex(b"gate"))
}

fn fresh_index() -> OwnershipIndex {
    OwnershipIndex::new("2.16.0", "1", Origin::Release)
}

fn files(root: &Path) -> Vec<String> {
    let mut out = Vec::new();
    let mut stack = vec![root.to_path_buf()];
    while let Some(d) = stack.pop() {
        for e in std::fs::read_dir(&d).unwrap() {
            let p = e.unwrap().path();
            if p.is_dir() {
                stack.push(p);
            } else {
                out.push(
                    p.strip_prefix(root)
                        .unwrap()
                        .to_string_lossy()
                        .replace('\\', "/"),
                );
            }
        }
    }
    out.sort();
    out
}

#[test]
fn dry_run_reports_and_writes_nothing() {
    let dir = tempfile::tempdir().unwrap();
    let mut index = fresh_index();
    let report = execute(
        &install_plan(),
        &scope(dir.path()),
        &mut index,
        &kit,
        ExecOptions {
            dry_run: true,
            force: false,
        },
    )
    .unwrap();
    assert_eq!(
        report.written,
        [".codex/hooks/gate.cjs", "AGENTS.md", ".codex/config.toml"]
    );
    assert_eq!(report.notices, ["hello"]);
    assert!(files(dir.path()).is_empty());
    assert_eq!(index, fresh_index());
}

#[test]
fn install_is_idempotent_and_uninstall_restores_user_files_exactly() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("AGENTS.md"), "# My agents\n").unwrap();
    let user_files = files(dir.path());
    let s = scope(dir.path());
    let mut index = fresh_index();

    execute(
        &install_plan(),
        &s,
        &mut index,
        &kit,
        ExecOptions::default(),
    )
    .unwrap();
    assert!(
        std::fs::read_to_string(dir.path().join("AGENTS.md"))
            .unwrap()
            .contains("kit rules")
    );
    let on_disk = OwnershipIndex::load(&s.index_file.under(dir.path()))
        .unwrap()
        .unwrap();
    assert_eq!(on_disk, index);
    assert_eq!(index.paths.len(), 1);
    assert!(!index.sections["AGENTS.md"]["meowkit"].file_created);
    assert!(index.sections[".codex/config.toml"]["mcp_servers"].file_created);

    let again = execute(
        &install_plan(),
        &s,
        &mut index,
        &kit,
        ExecOptions::default(),
    )
    .unwrap();
    assert!(again.written.is_empty(), "{:?}", again.written);

    let report = execute(
        &uninstall_plan(),
        &s,
        &mut index,
        &kit,
        ExecOptions::default(),
    )
    .unwrap();
    assert!(report.preserved.is_empty(), "{:?}", report.preserved);
    assert_eq!(
        std::fs::read_to_string(dir.path().join("AGENTS.md")).unwrap(),
        "# My agents\n"
    );
    let left: Vec<String> = files(dir.path())
        .into_iter()
        .filter(|f| !f.starts_with(".meowkit/"))
        .collect();
    assert_eq!(left, user_files);
    assert!(!s.index_file.under(dir.path()).exists());
}

#[test]
fn user_edits_are_preserved_unless_forced() {
    let dir = tempfile::tempdir().unwrap();
    let s = scope(dir.path());
    let mut index = fresh_index();
    execute(
        &install_plan(),
        &s,
        &mut index,
        &kit,
        ExecOptions::default(),
    )
    .unwrap();
    let gate = dir.path().join(".codex/hooks/gate.cjs");
    std::fs::write(&gate, "user edit").unwrap();

    let mut plan = install_plan();
    plan.ops[0] = Op::WriteFile {
        path: rel(".codex/hooks/gate.cjs"),
        bytes: b"gate v2".to_vec(),
        mode: None,
    };
    let report = execute(&plan, &s, &mut index, &kit, ExecOptions::default()).unwrap();
    assert_eq!(report.preserved.len(), 1);
    assert_eq!(std::fs::read_to_string(&gate).unwrap(), "user edit");

    let removal = execute(
        &uninstall_plan(),
        &s,
        &mut index,
        &kit,
        ExecOptions::default(),
    )
    .unwrap();
    assert!(
        removal
            .preserved
            .iter()
            .any(|(p, _)| p == ".codex/hooks/gate.cjs")
    );
    assert!(gate.exists());

    let forced = execute(
        &plan,
        &s,
        &mut index,
        &kit,
        ExecOptions {
            dry_run: false,
            force: true,
        },
    )
    .unwrap();
    assert_eq!(
        forced.written,
        [".codex/hooks/gate.cjs", "AGENTS.md", ".codex/config.toml"]
    );
    assert_eq!(std::fs::read_to_string(&gate).unwrap(), "gate v2");
}

#[test]
fn an_unowned_existing_file_is_not_overwritten_or_removed() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(dir.path().join(".codex/hooks")).unwrap();
    std::fs::write(dir.path().join(".codex/hooks/gate.cjs"), "mine").unwrap();
    let mut index = fresh_index();
    let r = execute(
        &install_plan(),
        &scope(dir.path()),
        &mut index,
        &kit,
        ExecOptions::default(),
    )
    .unwrap();
    assert!(
        r.preserved
            .iter()
            .any(|(p, _)| p == ".codex/hooks/gate.cjs")
    );
    assert!(!index.paths.contains_key(".codex/hooks/gate.cjs"));
    let r = execute(
        &uninstall_plan(),
        &scope(dir.path()),
        &mut index,
        &kit,
        ExecOptions {
            dry_run: false,
            force: true,
        },
    )
    .unwrap();
    assert!(
        r.preserved
            .iter()
            .any(|(p, _)| p == ".codex/hooks/gate.cjs")
    );
    assert_eq!(
        std::fs::read_to_string(dir.path().join(".codex/hooks/gate.cjs")).unwrap(),
        "mine"
    );
}

#[test]
fn invalid_plans_fail_before_any_write() {
    let dir = tempfile::tempdir().unwrap();
    let s = scope(dir.path());
    let bad_root = Plan {
        ops: vec![Op::WriteFile {
            path: rel(".claude/x"),
            bytes: vec![],
            mode: None,
        }],
        ..Plan::default()
    };
    let mut plan = install_plan();
    plan.ops.extend(bad_root.ops);
    let err = execute(&plan, &s, &mut fresh_index(), &kit, ExecOptions::default()).unwrap_err();
    assert!(
        matches!(err, ExecError::Path(PathError::OutsideRoots(_))),
        "{err}"
    );
    assert!(files(dir.path()).is_empty());

    let mut never = scope(dir.path());
    never.roots.push(rel(".meowkit"));
    let plan = Plan {
        ops: vec![Op::RemoveFile {
            path: rel(".meowkit/memory/decisions.md"),
        }],
        ..Plan::default()
    };
    let err = execute(
        &plan,
        &never,
        &mut fresh_index(),
        &kit,
        ExecOptions::default(),
    )
    .unwrap_err();
    assert!(
        matches!(err, ExecError::Path(PathError::NeverDelete(_))),
        "{err}"
    );
}

#[cfg(unix)]
#[test]
fn a_symlinked_parent_fails_before_any_write() {
    let dir = tempfile::tempdir().unwrap();
    let outside = tempfile::tempdir().unwrap();
    std::os::unix::fs::symlink(outside.path(), dir.path().join(".codex")).unwrap();
    let err = execute(
        &install_plan(),
        &scope(dir.path()),
        &mut fresh_index(),
        &kit,
        ExecOptions::default(),
    )
    .unwrap_err();
    assert!(
        matches!(err, ExecError::Path(PathError::SymlinkedParent { .. })),
        "{err}"
    );
    assert!(files(outside.path()).is_empty());
    assert!(!dir.path().join("AGENTS.md").exists());
}

#[test]
fn a_failure_mid_apply_rolls_everything_back() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("AGENTS.md"), "# Mine\n").unwrap();
    // A directory where the TOML file should go makes the third write fail.
    std::fs::create_dir_all(dir.path().join(".codex/config.toml")).unwrap();
    let mut index = fresh_index();
    let mut plan = install_plan();
    plan.ops.swap(1, 2);
    plan.ops.swap(0, 2);
    // Order now: MergeBlock(AGENTS.md), MergeEntries(config.toml), WriteFile(gate).
    let err = execute(
        &plan,
        &scope(dir.path()),
        &mut index,
        &kit,
        ExecOptions::default(),
    );
    assert!(err.is_err());
    assert_eq!(
        std::fs::read_to_string(dir.path().join("AGENTS.md")).unwrap(),
        "# Mine\n"
    );
    assert!(!dir.path().join(".codex/hooks").exists());
    assert_eq!(index, fresh_index());
}

#[test]
fn a_held_lock_refuses_a_second_writer() {
    let dir = tempfile::tempdir().unwrap();
    let s = scope(dir.path());
    let _held = ScopeLock::acquire(&s.lock_file.under(dir.path())).unwrap();
    let err = execute(
        &install_plan(),
        &s,
        &mut fresh_index(),
        &kit,
        ExecOptions::default(),
    )
    .unwrap_err();
    assert!(matches!(err, ExecError::Lock(_)), "{err}");
}

#[test]
fn never_delete_paths_cannot_be_written_either() {
    let dir = tempfile::tempdir().unwrap();
    let mut s = scope(dir.path());
    s.roots.push(rel(".meowkit"));
    let plan = Plan {
        ops: vec![Op::WriteFile {
            path: rel(".meowkit/memory/decisions.md"),
            bytes: b"overwritten".to_vec(),
            mode: None,
        }],
        ..Plan::default()
    };
    let err = execute(&plan, &s, &mut fresh_index(), &kit, ExecOptions::default()).unwrap_err();
    assert!(
        matches!(err, ExecError::Path(PathError::NeverDelete(_))),
        "{err}"
    );
    assert!(files(dir.path()).is_empty());
}

#[cfg(unix)]
#[test]
fn a_symlinked_state_dir_fails_before_the_ledger_is_written() {
    let dir = tempfile::tempdir().unwrap();
    let outside = tempfile::tempdir().unwrap();
    std::os::unix::fs::symlink(outside.path(), dir.path().join(".meowkit")).unwrap();
    let err = execute(
        &install_plan(),
        &scope(dir.path()),
        &mut fresh_index(),
        &kit,
        ExecOptions::default(),
    )
    .unwrap_err();
    assert!(
        matches!(err, ExecError::Path(PathError::SymlinkedParent { .. })),
        "{err}"
    );
    assert!(files(outside.path()).is_empty());
    assert!(!dir.path().join("AGENTS.md").exists());
}

fn hooks_op(commands: &[&str]) -> Op {
    Op::MergeHooks {
        path: rel(".codex/hooks.json"),
        event: "PreToolUse".into(),
        layout: mewkit_core::plan::HookLayout::Grouped,
        handlers: commands
            .iter()
            .map(|c| mewkit_core::plan::Handler {
                matcher: Some("Bash".into()),
                handler: json!({"type": "command", "command": c}),
            })
            .collect(),
    }
}

fn entries_op(names: &[&str]) -> Op {
    Op::MergeEntries {
        path: rel(".codex/config.toml"),
        format: Format::Toml,
        key: vec!["mcp_servers".into()],
        entries: names
            .iter()
            .map(|n| ((*n).to_owned(), json!({"command": "node"})))
            .collect(),
    }
}

#[test]
fn an_upgrade_takes_out_hooks_and_entries_the_new_kit_dropped() {
    let dir = tempfile::tempdir().unwrap();
    let s = scope(dir.path());
    let user_hooks = "{\n  \"hooks\": {\n    \"PreToolUse\": [\n      {\n        \"matcher\": \"Bash\",\n        \"hooks\": [\n          {\n            \"command\": \"mine\"\n          }\n        ]\n      }\n    ]\n  }\n}\n";
    std::fs::create_dir_all(dir.path().join(".codex")).unwrap();
    std::fs::write(dir.path().join(".codex/hooks.json"), user_hooks).unwrap();
    let mut index = OwnershipIndex::new("1", "1", Origin::LocalDir);
    let no_kit = |_: &RelPath| None;
    let run = |ops: Vec<Op>, index: &mut OwnershipIndex| {
        let plan = Plan {
            ops,
            ..Plan::default()
        };
        execute(&plan, &s, index, &no_kit, ExecOptions::default()).unwrap();
    };
    run(
        vec![hooks_op(&["old", "kept"]), entries_op(&["old", "kept"])],
        &mut index,
    );
    run(vec![hooks_op(&["kept"]), entries_op(&["kept"])], &mut index);

    let hooks = std::fs::read_to_string(dir.path().join(".codex/hooks.json")).unwrap();
    assert!(!hooks.contains("\"old\""), "{hooks}");
    assert!(hooks.contains("\"mine\"") && hooks.contains("\"kept\""));
    let config = std::fs::read_to_string(dir.path().join(".codex/config.toml")).unwrap();
    assert!(
        !config.contains("old") && config.contains("kept"),
        "{config}"
    );

    let strip = Plan {
        ops: vec![
            Op::StripHooks {
                path: rel(".codex/hooks.json"),
                event: "PreToolUse".into(),
                layout: mewkit_core::plan::HookLayout::Grouped,
                ids: index.sections[".codex/hooks.json"]["hooks.PreToolUse"]
                    .names
                    .clone(),
            },
            Op::StripEntries {
                path: rel(".codex/config.toml"),
                format: Format::Toml,
                key: vec!["mcp_servers".into()],
                names: index.sections[".codex/config.toml"]["mcp_servers"]
                    .names
                    .clone(),
            },
        ],
        ..Plan::default()
    };
    execute(&strip, &s, &mut index, &no_kit, ExecOptions::default()).unwrap();
    assert_eq!(
        std::fs::read_to_string(dir.path().join(".codex/hooks.json")).unwrap(),
        user_hooks
    );
    assert!(
        !dir.path().join(".codex/config.toml").exists(),
        "kit-created file goes when empty"
    );
}

#[test]
fn an_entry_the_user_already_had_with_the_kits_value_survives_uninstall() {
    let dir = tempfile::tempdir().unwrap();
    let s = scope(dir.path());
    let user = "{\n  \"version\": 1,\n  \"mine\": true\n}\n";
    std::fs::create_dir_all(dir.path().join(".codex")).unwrap();
    std::fs::write(dir.path().join(".codex/x.json"), user).unwrap();
    let mut index = OwnershipIndex::new("1", "1", Origin::LocalDir);
    let no_kit = |_: &RelPath| None;
    let entries = json!({"version": 1, "kit": 2}).as_object().unwrap().clone();
    let install = Plan {
        ops: vec![Op::MergeEntries {
            path: rel(".codex/x.json"),
            format: Format::Json,
            key: vec![],
            entries,
        }],
        ..Plan::default()
    };
    // Twice: a re-merge must not start claiming the user's entry either.
    for _ in 0..2 {
        execute(&install, &s, &mut index, &no_kit, ExecOptions::default()).unwrap();
    }
    assert_eq!(index.sections[".codex/x.json"][""].names, ["kit"]);
    let strip = Plan {
        ops: vec![Op::StripEntries {
            path: rel(".codex/x.json"),
            format: Format::Json,
            key: vec![],
            names: index.sections[".codex/x.json"][""].names.clone(),
        }],
        ..Plan::default()
    };
    execute(&strip, &s, &mut index, &no_kit, ExecOptions::default()).unwrap();
    assert_eq!(
        std::fs::read_to_string(dir.path().join(".codex/x.json")).unwrap(),
        user
    );
}

fn flat_hooks_op(commands: &[&str]) -> Op {
    Op::MergeHooks {
        path: rel(".codex/flat.json"),
        event: "preToolUse".into(),
        layout: mewkit_core::plan::HookLayout::Flat,
        handlers: commands
            .iter()
            .map(|c| mewkit_core::plan::Handler {
                matcher: None,
                handler: json!({"command": c, "failClosed": true}),
            })
            .collect(),
    }
}

#[test]
fn a_flat_upgrade_drops_the_old_handler_and_uninstall_restores_the_user_file() {
    let dir = tempfile::tempdir().unwrap();
    let s = scope(dir.path());
    let user = "{\n  \"version\": 1,\n  \"hooks\": {\n    \"preToolUse\": [\n      {\n        \"command\": \"mine\"\n      }\n    ]\n  }\n}\n";
    std::fs::create_dir_all(dir.path().join(".codex")).unwrap();
    std::fs::write(dir.path().join(".codex/flat.json"), user).unwrap();
    let mut index = OwnershipIndex::new("1", "1", Origin::LocalDir);
    let no_kit = |_: &RelPath| None;
    for ops in [flat_hooks_op(&["old", "kept"]), flat_hooks_op(&["kept"])] {
        let plan = Plan {
            ops: vec![ops],
            ..Plan::default()
        };
        execute(&plan, &s, &mut index, &no_kit, ExecOptions::default()).unwrap();
    }
    let text = std::fs::read_to_string(dir.path().join(".codex/flat.json")).unwrap();
    assert!(
        !text.contains("\"old\"") && text.contains("\"kept\""),
        "{text}"
    );

    let strip = Plan {
        ops: vec![Op::StripHooks {
            path: rel(".codex/flat.json"),
            event: "preToolUse".into(),
            layout: mewkit_core::plan::HookLayout::Flat,
            ids: index.sections[".codex/flat.json"]["hooks.preToolUse"]
                .names
                .clone(),
        }],
        ..Plan::default()
    };
    execute(&strip, &s, &mut index, &no_kit, ExecOptions::default()).unwrap();
    assert_eq!(
        std::fs::read_to_string(dir.path().join(".codex/flat.json")).unwrap(),
        user
    );
}

#[test]
fn a_toml_entry_the_user_already_had_is_not_claimed() {
    let dir = tempfile::tempdir().unwrap();
    let s = scope(dir.path());
    let user = "[mcp_servers.kept]\ncommand = \"node\"\n";
    std::fs::create_dir_all(dir.path().join(".codex")).unwrap();
    std::fs::write(dir.path().join(".codex/config.toml"), user).unwrap();
    let mut index = OwnershipIndex::new("1", "1", Origin::LocalDir);
    let plan = Plan {
        ops: vec![entries_op(&["kept", "kit"])],
        ..Plan::default()
    };
    execute(&plan, &s, &mut index, &|_| None, ExecOptions::default()).unwrap();
    assert_eq!(
        index.sections[".codex/config.toml"]["mcp_servers"].names,
        ["kit"]
    );
}
