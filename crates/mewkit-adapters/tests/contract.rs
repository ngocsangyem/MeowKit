//! A stub emitter's plans run through the core executor: install, then strip.
use mewkit_adapters::contract::{Kit, Op, OwnershipIndex, Plan, RelPath};
use mewkit_adapters::{EmitError, EmitRequest, Emitter, Runtime, Scope};
use mewkit_core::exec::{ExecOptions, Scope as ExecScope, execute};
use mewkit_core::fsx::sha256_hex;
use mewkit_core::ownership::Origin;

struct Stub;

fn rel(s: &str) -> RelPath {
    RelPath::new(s).unwrap()
}

impl Emitter for Stub {
    fn target(&self) -> Runtime {
        Runtime::Codex
    }
    fn roots(&self, _: &Scope) -> Vec<RelPath> {
        vec![rel(".codex"), rel("AGENTS.md")]
    }
    fn prepare(&self, req: &EmitRequest<'_>) -> Result<Plan, EmitError> {
        let bytes = std::fs::read(req.kit.dir.join("rules.md"))
            .map_err(|e| EmitError::Kit(e.to_string()))?;
        Ok(Plan {
            ops: vec![
                Op::WriteFile {
                    path: rel(".codex/rules.md"),
                    bytes,
                    mode: None,
                },
                Op::MergeBlock {
                    path: rel("AGENTS.md"),
                    id: "meowkit".into(),
                    content: "see .codex/rules.md".into(),
                },
            ],
            ..Plan::default()
        })
    }
    fn plan_strip(&self, _: &Scope, owned: &OwnershipIndex) -> Result<Plan, EmitError> {
        let mut ops: Vec<Op> = owned
            .paths
            .keys()
            .map(|p| Op::RemoveFile { path: rel(p) })
            .collect();
        for (file, ids) in &owned.sections {
            ops.extend(ids.keys().map(|id| Op::StripBlock {
                path: rel(file),
                id: id.clone(),
            }));
        }
        Ok(Plan {
            ops,
            ..Plan::default()
        })
    }
}

#[test]
fn a_stub_emitter_installs_and_strips_through_the_executor() {
    let kit_dir = tempfile::tempdir().unwrap();
    std::fs::write(kit_dir.path().join("rules.md"), "rules").unwrap();
    let kit = Kit {
        dir: kit_dir.path().to_path_buf(),
        version: "2.16.0".into(),
        digest: None,
        origin: Origin::LocalDir,
        contract: None,
        notices: vec![],
    };
    let project = tempfile::tempdir().unwrap();
    std::fs::write(project.path().join("AGENTS.md"), "# Mine\n").unwrap();
    let scope = Scope::project(project.path());
    let exec_scope = ExecScope {
        root: scope.root.clone(),
        mounts: vec![],
        roots: Stub.roots(&scope),
        index_file: rel(".meowkit/state/ownership/codex.json"),
        lock_file: rel(".meowkit/state/mewkit.lock"),
        backups_dir: rel(".meowkit/backups"),
    };
    let req = EmitRequest {
        kit: &kit,
        scope: &scope,
        packs: &[],
        disabled: &[],
        fresh: false,
        other_scope: None,
    };
    let plan = Stub.prepare(&req).unwrap();
    let mut index = OwnershipIndex::new(&kit.version, "1", kit.origin);
    let kit_hash = |p: &RelPath| (p.as_str() == ".codex/rules.md").then(|| sha256_hex(b"rules"));
    execute(
        &plan,
        &exec_scope,
        &mut index,
        &kit_hash,
        ExecOptions::default(),
    )
    .unwrap();
    assert_eq!(
        std::fs::read_to_string(project.path().join(".codex/rules.md")).unwrap(),
        "rules"
    );

    let strip = Stub.plan_strip(&scope, &index).unwrap();
    let report = execute(
        &strip,
        &exec_scope,
        &mut index,
        &kit_hash,
        ExecOptions::default(),
    )
    .unwrap();
    assert!(report.preserved.is_empty(), "{:?}", report.preserved);
    assert_eq!(
        std::fs::read_to_string(project.path().join("AGENTS.md")).unwrap(),
        "# Mine\n"
    );
    assert!(!project.path().join(".codex/rules.md").exists());
}
