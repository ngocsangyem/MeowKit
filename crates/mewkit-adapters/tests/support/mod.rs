//! Shared helpers for emitter tests: this checkout as a kit, a temp project.
#![allow(dead_code)]

use std::cell::RefCell;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;

use mewkit_adapters::contract::{Kit, OwnershipIndex, Plan, RelPath, written_hashes};
use mewkit_adapters::{EmitRequest, Emitter, Scope};
use mewkit_core::exec::{ExecOptions, Scope as ExecScope, execute};
use mewkit_core::fsx::sha256_hex;
use mewkit_core::ownership::Origin;
use mewkit_core::report::EmitReport;

/// The checkout this test runs in.
pub fn repo() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

/// The kit this checkout would publish, built once per test binary: every
/// git-tracked file under the archive roots minus `base.exclude`, the rule
/// `scripts/kit-ship-set.cjs` applies to a release.
pub fn kit() -> Kit {
    static DIR: OnceLock<PathBuf> = OnceLock::new();
    let dir = DIR.get_or_init(build_kit).clone();
    Kit {
        dir,
        version: "0.0.0-test".into(),
        digest: None,
        origin: Origin::LocalDir,
        contract: None,
        notices: vec![],
    }
}

pub fn request<'a>(
    kit: &'a Kit,
    scope: &'a Scope,
    packs: &'a [String],
    disabled: &'a [String],
) -> EmitRequest<'a> {
    EmitRequest {
        kit,
        scope,
        packs,
        disabled,
        fresh: false,
        other_scope: None,
    }
}

pub struct Project<E: Emitter> {
    /// `None` for a project sharing another's directory.
    _dir: Option<tempfile::TempDir>,
    pub scope: Scope,
    emitter: E,
    index: RefCell<OwnershipIndex>,
}

impl<E: Emitter> Project<E> {
    pub fn new(emitter: E) -> Self {
        let dir = tempfile::tempdir().unwrap();
        let scope = Scope::project(dir.path());
        Self {
            _dir: Some(dir),
            scope,
            emitter,
            index: RefCell::new(OwnershipIndex::new("0.0.0-test", "1", Origin::LocalDir)),
        }
    }

    /// A global install into a fresh temp home; `env` answers the runtime
    /// directory variables (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`).
    pub fn global(emitter: E, env: &[(&str, &Path)]) -> Self {
        let dir = tempfile::tempdir().unwrap();
        let scope = Scope::global(dir.path(), |name| {
            env.iter()
                .find(|(n, _)| *n == name)
                .map(|(_, v)| v.as_os_str().to_owned())
        })
        .unwrap();
        Self {
            _dir: Some(dir),
            scope,
            emitter,
            index: RefCell::new(OwnershipIndex::new("0.0.0-test", "1", Origin::LocalDir)),
        }
    }

    /// A global install into a fresh temp home that `setup` prepares first
    /// (a symlinked runtime dir, say), with no variables set.
    pub fn new_home_with(emitter: E, setup: impl FnOnce(&Path)) -> Self {
        let dir = tempfile::tempdir().unwrap();
        setup(dir.path());
        let scope = Scope::global(dir.path(), |_| None).unwrap();
        Self {
            _dir: Some(dir),
            scope,
            emitter,
            index: RefCell::new(OwnershipIndex::new("0.0.0-test", "1", Origin::LocalDir)),
        }
    }

    /// Another runtime installed into the same project directory, with its own
    /// ownership index. `self` must outlive it: it owns the directory.
    pub fn alongside<F: Emitter>(&self, emitter: F) -> Project<F> {
        Project {
            _dir: None,
            scope: self.scope.clone(),
            emitter,
            index: RefCell::new(OwnershipIndex::new("0.0.0-test", "1", Origin::LocalDir)),
        }
    }

    pub fn root(&self) -> &Path {
        &self.scope.root
    }

    pub fn write(&self, rel: &str, text: &str) {
        let path = self.root().join(rel);
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, text).unwrap();
    }

    pub fn read(&self, rel: &str) -> String {
        std::fs::read_to_string(self.root().join(rel)).unwrap()
    }

    pub fn index(&self) -> OwnershipIndex {
        self.index.borrow().clone()
    }

    /// The emitter's install plan for this scope, default packs.
    pub fn emitter_prepare(&self, kit: &Kit) -> Plan {
        self.emitter
            .prepare(&request(kit, &self.scope, &[], &[]))
            .unwrap()
    }

    /// The emitter's removal plan from this scope's index.
    pub fn strip_plan(&self) -> Plan {
        self.emitter.plan_strip(&self.scope, &self.index()).unwrap()
    }

    /// Run `plan`; the kit's own hash of a path is what a default install writes.
    pub fn execute(&self, plan: &Plan, kit: &Kit) -> EmitReport {
        let install = self
            .emitter
            .prepare(&request(kit, &self.scope, &[], &[]))
            .unwrap();
        let hashes = written_hashes(&install);
        let kit_hash = |p: &RelPath| hashes.get(p.as_str()).cloned();
        let exec_scope = ExecScope {
            root: self.scope.root.clone(),
            mounts: self.scope.mounts.clone(),
            roots: self.emitter.roots(&self.scope),
            index_file: rel(&format!(
                ".meowkit/state/ownership/{}.json",
                self.emitter.target().name()
            )),
            lock_file: rel(".meowkit/state/mewkit.lock"),
            backups_dir: rel(".meowkit/backups"),
        };
        execute(
            plan,
            &exec_scope,
            &mut self.index.borrow_mut(),
            &kit_hash,
            ExecOptions::default(),
        )
        .unwrap()
    }
}

pub fn rel(s: &str) -> RelPath {
    RelPath::new(s).unwrap()
}

/// Every file and directory under `root` except mewkit's own `.meowkit/`
/// state, with each file's SHA-256 (directories map to an empty string).
pub fn sha_tree(root: &Path) -> BTreeMap<PathBuf, String> {
    let mut out = BTreeMap::new();
    let mut todo = vec![root.to_path_buf()];
    while let Some(dir) = todo.pop() {
        for entry in std::fs::read_dir(&dir).unwrap() {
            let path = entry.unwrap().path();
            let rel = path.strip_prefix(root).unwrap().to_path_buf();
            if rel.starts_with(".meowkit") {
                continue;
            }
            if path.is_dir() {
                out.insert(rel, String::new());
                todo.push(path);
            } else {
                out.insert(rel, sha256_hex(&std::fs::read(&path).unwrap()));
            }
        }
    }
    out
}

const ARCHIVE_ROOTS: &[&str] = &[
    ".claude",
    ".meowkit/.env.example",
    ".meowkit/gitignore.meowkit",
    ".meowkit/harness-inventory.json",
    ".meowkit/mcp.json.example",
    ".meowkit/pack-manifest.json",
    "packages/mewkit/src/migrate/modules/cursor/catalog/mcp-profiles.json",
    "packages/mewkit/src/migrate/modules/codex/root",
    "packages/mewkit/src/migrate/modules/codex/catalog/skill-packs.json",
    "packages/mewkit/src/migrate/modules/cursor/root",
    "packages/mewkit/src/migrate/modules/cursor/catalog/skill-packs.json",
];

fn build_kit() -> PathBuf {
    let repo = repo();
    let out =
        Path::new(env!("CARGO_TARGET_TMPDIR")).join(format!("kit-{}", env!("CARGO_CRATE_NAME")));
    let _ = std::fs::remove_dir_all(&out);
    let manifest: serde_json::Value =
        serde_json::from_slice(&std::fs::read(repo.join(".meowkit/pack-manifest.json")).unwrap())
            .unwrap();
    let excludes: Vec<String> = manifest["base"]["exclude"]
        .as_array()
        .unwrap()
        .iter()
        .map(|p| p.as_str().unwrap().to_owned())
        .collect();
    let listed = Command::new("git")
        .args(["ls-files", "-z", "--"])
        .args(ARCHIVE_ROOTS)
        .current_dir(&repo)
        .output()
        .unwrap();
    assert!(listed.status.success(), "git ls-files failed");
    for path in String::from_utf8(listed.stdout)
        .unwrap()
        .split('\0')
        .filter(|p| !p.is_empty())
    {
        if excludes.iter().any(|pat| glob(pat, path)) {
            continue;
        }
        let dest = out.join(path);
        std::fs::create_dir_all(dest.parent().unwrap()).unwrap();
        std::fs::copy(repo.join(path), dest).unwrap();
    }
    out
}

/// The ship-set pattern rule: `*` matches any run including `/`, `?` one character.
fn glob(pattern: &str, text: &str) -> bool {
    let (p, t): (Vec<char>, Vec<char>) = (pattern.chars().collect(), text.chars().collect());
    let (mut pi, mut ti, mut star, mut mark) = (0, 0, None, 0);
    while ti < t.len() {
        if pi < p.len() && (p[pi] == '?' || p[pi] == t[ti]) {
            pi += 1;
            ti += 1;
        } else if pi < p.len() && p[pi] == '*' {
            star = Some(pi);
            mark = ti;
            pi += 1;
        } else if let Some(s) = star {
            pi = s + 1;
            mark += 1;
            ti = mark;
        } else {
            return false;
        }
    }
    p[pi..].iter().all(|c| *c == '*')
}
