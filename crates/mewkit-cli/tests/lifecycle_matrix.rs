//! The whole lifecycle for every runtime at both scopes: install → doctor →
//! edit one owned file → upgrade → uninstall. After install every path the
//! ownership index names exists and doctor finds every hook script; after
//! uninstall the tree is what it was before install, plus the kept edit.
mod support;

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use support::kit::sha_tree;
use support::temp_home::TempHome;
use support::{code, text};

const EDIT: &str = "edited by hand\n";

#[derive(Clone, Copy, PartialEq)]
enum Scope {
    Project,
    Global,
}

/// Where a scope keeps things, relative to its root.
struct Dirs {
    label: &'static str,
    /// mewkit's own state and backups, kept out of the snapshots.
    state: &'static str,
    index: &'static str,
    backups: &'static str,
}

impl Scope {
    fn root(self, env: &TempHome) -> PathBuf {
        if self == Scope::Project {
            env.project()
        } else {
            env.home()
        }
    }

    fn dirs(self) -> Dirs {
        match self {
            Scope::Project => Dirs {
                label: "project",
                state: ".meowkit",
                index: ".meowkit/state/ownership",
                backups: ".meowkit/backups",
            },
            Scope::Global => Dirs {
                label: "global",
                state: ".mewkit",
                index: ".mewkit/state/ownership",
                backups: ".mewkit/state/backups",
            },
        }
    }

    /// `args` for one runtime at this scope.
    fn args<'a>(self, verb: &'a str, runtime: &'a str, extra: &[&'a str]) -> Vec<&'a str> {
        let mut all = vec![verb, "--target", runtime];
        if self == Scope::Global {
            all.push("--global");
        }
        all.extend(extra);
        all
    }
}

/// The tree under `root` without mewkit's state directory.
fn snapshot(root: &Path, scope: Scope) -> BTreeMap<PathBuf, String> {
    sha_tree(root)
        .into_iter()
        .filter(|(k, _)| !k.starts_with(scope.dirs().state))
        .collect()
}

/// The ownership index paths of `runtime` after an install.
fn owned_paths(root: &Path, scope: Scope, runtime: &str) -> Vec<String> {
    let file = root
        .join(scope.dirs().index)
        .join(format!("{runtime}.json"));
    let index: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&file).expect("ownership index")).unwrap();
    index["paths"]
        .as_object()
        .expect("paths")
        .keys()
        .cloned()
        .collect()
}

fn cell(runtime: &str, scope: Scope) {
    let env = TempHome::new();
    let root = scope.root(&env);
    let other = match scope {
        Scope::Project => env.home(),
        Scope::Global => env.project(),
    };
    let before = snapshot(&root, scope);
    let other_before = sha_tree(&other);
    let cell = format!("{runtime} ({})", scope.dirs().label);

    let out = env.with_kit(&scope.args("init", runtime, &[]));
    assert_eq!(code(&out), 0, "{cell} init: {}", text(&out));
    let owned = owned_paths(&root, scope, runtime);
    assert!(!owned.is_empty(), "{cell}: the index names files");
    let missing: Vec<_> = owned.iter().filter(|p| !root.join(p).is_file()).collect();
    assert!(
        missing.is_empty(),
        "{cell}: indexed but missing {missing:?}"
    );

    let out = env.mewkit_next(&scope.args("doctor", runtime, &["--json"]));
    assert_eq!(code(&out), 0, "{cell} doctor: {}", text(&out));
    let checks: serde_json::Value = serde_json::from_slice(&out.stdout).unwrap();
    let status = |name: &str| {
        checks
            .as_array()
            .unwrap()
            .iter()
            .find(|c| c["name"] == name)
            .map(|c| c["status"].as_str().unwrap().to_owned())
    };
    assert_eq!(status(&cell).as_deref(), Some("ok"), "{cell}: {checks:#}");
    let hooks = format!("{runtime} hooks ({})", scope.dirs().label);
    assert_eq!(status(&hooks).as_deref(), Some("ok"), "{cell}: {checks:#}");

    let edited = owned
        .iter()
        .find(|p| p.ends_with("SKILL.md"))
        .expect("a skill is owned");
    std::fs::write(root.join(edited), EDIT).unwrap();

    let out = env.with_kit(&scope.args("upgrade", runtime, &[]));
    assert_eq!(
        code(&out),
        6,
        "{cell} upgrade keeps the edit: {}",
        text(&out)
    );
    assert_eq!(std::fs::read_to_string(root.join(edited)).unwrap(), EDIT);

    let out = env.with_kit(&scope.args("uninstall", runtime, &["--yes"]));
    assert_eq!(
        code(&out),
        6,
        "{cell} uninstall keeps the edit: {}",
        text(&out)
    );
    assert_eq!(std::fs::read_to_string(root.join(edited)).unwrap(), EDIT);

    let mut expected = before;
    let mut dir = PathBuf::new();
    for part in Path::new(edited).parent().unwrap().components() {
        dir.push(part);
        expected.insert(dir.clone(), String::new());
    }
    expected.insert(
        PathBuf::from(edited),
        mewkit_core::fsx::sha256_hex(EDIT.as_bytes()),
    );
    assert_eq!(
        snapshot(&root, scope),
        expected,
        "{cell}: only the edit remains"
    );
    let backups = root.join(scope.dirs().backups);
    let taken = backups
        .read_dir()
        .map(|d| d.flatten().filter(|e| e.path().is_dir()).count())
        .unwrap_or(0);
    assert!(
        taken > 0,
        "{cell}: the files uninstall changed were backed up under {}",
        backups.display()
    );
    assert!(
        backups.join(".gitignore").is_file(),
        "{cell}: the backups keep themselves out of git"
    );
    assert_eq!(
        sha_tree(&other),
        other_before,
        "{cell}: the other scope is untouched"
    );
    if scope == Scope::Global {
        // `sha_tree` skips `.meowkit`, so check the project state dir directly.
        assert!(
            !env.project().join(".meowkit").exists(),
            "{cell}: a global install writes no project state"
        );
    }
}

// One test per cell, so the six run in parallel.
macro_rules! cells {
    ($($name:ident: $runtime:literal at $scope:ident;)*) => {
        $(#[test] fn $name() { cell($runtime, Scope::$scope); })*
    };
}

cells! {
    claude_code_in_a_project: "claude-code" at Project;
    codex_in_a_project: "codex" at Project;
    cursor_in_a_project: "cursor" at Project;
    claude_code_globally: "claude-code" at Global;
    codex_globally: "codex" at Global;
    cursor_globally: "cursor" at Global;
}
