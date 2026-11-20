//! The `.agents/` tree that Codex, Pi and OMP share: skills in
//! `.agents/skills`, and in `.agents/meowkit/` the files that skill text names
//! by path (helper scripts, rubrics, agent prompts) and the guard script.
//!
//! Each of the three installs the same bytes there, so one install's files
//! are another's, and a file leaves with the last of them.
use crate::agents_block::{self, AGENTS_MD};
use crate::contract::{EmitError, EmitRequest, Op, Plan, Runtime};
use crate::kit_files::{self, rel};
use crate::placement_resolver::Placement;
use crate::projected_kit::{ProjectedKit, Spec};
use crate::projection::target;
use crate::surface_table::Kind;

/// The root the three runtimes read skills from.
pub const SKILLS_ROOT: &str = ".agents/skills";
/// The folder for kit files none of them loads itself.
pub const KIT_DIR: &str = ".agents/meowkit";
/// The roots an emitter that writes this tree owns in a project.
pub const ROOTS: [&str; 3] = [SKILLS_ROOT, KIT_DIR, AGENTS_MD];
/// The one script the Pi extension and the OMP hook module run.
pub const GUARD: &str = ".agents/meowkit/hooks/guard.cjs";
const OVERLAY: &str = "kit/overlays/agents";

/// Wording every reader of the root can follow.
pub const SHARED: Spec = Spec {
    runtime: "the shared skills root",
    overlay: OVERLAY,
    target: &target::SHARED,
};
pub const PI: Spec = Spec {
    runtime: "Pi",
    overlay: OVERLAY,
    target: &target::PI,
};
pub const OMP: Spec = Spec {
    runtime: "OMP",
    overlay: OVERLAY,
    target: &target::OMP,
};

/// The runtimes whose emitters install this tree.
pub const WRITERS: [Runtime; 3] = [Runtime::Codex, Runtime::Pi, Runtime::Omp];

/// Whether more than one of the runtimes that install the tree is in the set,
/// which is when its text has to suit them all. A runtime that only reads the
/// root beside a folder of its own (Cursor) does not change the wording.
pub fn is_shared(placement: Option<&Placement>) -> bool {
    placement.is_some_and(|p| p.set.iter().filter(|r| WRITERS.contains(r)).count() > 1)
}

/// The spec `runtime` writes the tree with: its own wording alone, the shared
/// wording in company.
pub fn spec(runtime: Runtime, placement: Option<&Placement>) -> &'static Spec {
    match runtime {
        _ if is_shared(placement) => &SHARED,
        Runtime::Pi => &PI,
        Runtime::Omp => &OMP,
        _ => &SHARED,
    }
}

/// Every file of the tree and the `AGENTS.md` block, as `spec` projects them.
pub fn plan(req: &EmitRequest<'_>, spec: &'static Spec) -> Result<Plan, EmitError> {
    let kit = ProjectedKit::open(&req.kit.dir, spec)?;
    let chosen = kit.select(req.packs, req.disabled)?;
    let mut plan = Plan::default();
    for f in &kit.files {
        let path = f.rel.as_str();
        if path == AGENTS_MD {
            let text = String::from_utf8(f.bytes.clone())
                .map_err(|_| EmitError::Kit(format!("{path} is not UTF-8")))?;
            plan.ops.push(agents_block::merge(&text, AGENTS_MD)?);
            continue;
        }
        if kit.skill_of(path).is_some_and(|s| !chosen.contains(s)) {
            continue;
        }
        plan.ops.push(Op::WriteFile {
            path: rel(path)?,
            bytes: f.bytes.clone(),
            mode: f.mode,
        });
    }
    let have = kit.skills();
    for missing in chosen.iter().filter(|s| !have.contains(s.as_str())) {
        plan.notices.push(format!(
            "skill pack lists {missing}, which the kit does not ship for {}",
            spec.runtime
        ));
    }
    Ok(plan)
}

/// The files of a runtime's own overlay (`<overlay>/files/**`), written as
/// they are.
pub fn overlay_files(req: &EmitRequest<'_>, overlay: &str) -> Result<Vec<Op>, EmitError> {
    let dir = req.kit.dir.join(overlay).join("files");
    if !dir.is_dir() {
        return Err(EmitError::Kit(format!(
            "the kit has no {overlay}/files (kit too old for this binary?)"
        )));
    }
    let mut ops = Vec::new();
    for file in kit_files::walk(&dir)? {
        ops.push(Op::WriteFile {
            path: rel(&file.rel)?,
            bytes: kit_files::read(&file.abs)?,
            mode: kit_files::mode(&file.abs),
        });
    }
    Ok(ops)
}

/// One notice per folder of another runtime that `runtime` loads as well, for
/// the set installed here, and no project file switches off.
pub fn also_read(req: &EmitRequest<'_>, runtime: Runtime, name: &str) -> Vec<String> {
    let Some(placement) = req.placement else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for kind in Kind::ALL {
        let extras = placement.view(runtime, kind).map(|v| v.extras.as_slice());
        for extra in extras.unwrap_or_default() {
            let certainty = match &extra.unsure {
                Some(why) => format!("may also read {} ({why})", extra.root),
                None => format!("also reads {}", extra.root),
            };
            let off = match &extra.turn_off {
                Some(set) => format!("; to stop it, set {set}"),
                None => String::new(),
            };
            out.push(format!(
                "{name} {certainty}, so its {} can load twice{off}",
                kind.name()
            ));
        }
    }
    out
}
