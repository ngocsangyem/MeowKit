//! `meowkit-paths.cjs` against where the Rust binary reads and writes state.

use super::*;

/// `{ memory, telemetry, state, cache, pointer }` as the shipped resolver sees
/// them for the project.
fn resolved_paths(s: &Scratch) -> Value {
    let script = r#"
        const p = require(process.argv[1]);
        process.stdout.write(JSON.stringify({
          memory: p.memoryDir(), telemetry: p.telemetryDir(), state: p.sessionStateDir(),
          cache: p.cacheDir(), pointer: p.sessionStateFile('active-plan.json'),
        }));"#;
    let resolver = hook("lib/meowkit-paths.cjs");
    let (code, text) = node(
        s,
        &[
            "-e".as_ref(),
            script.as_ref(),
            "--".as_ref(),
            resolver.as_ref(),
        ],
    );
    assert_eq!(code, 0, "the shipped resolver failed: {text}");
    serde_json::from_str(&text).expect("the resolver prints json")
}

fn same_path(a: &str, b: &Path) -> bool {
    match (Path::new(a).canonicalize(), b.canonicalize()) {
        (Ok(a), Ok(b)) => a == b,
        _ => false,
    }
}

const ENTRY: &str = "## A lesson\nWhy: because\nApply when: always\nSource: a test\n";

#[test]
#[ignore = "needs node and the TS build"]
fn the_path_resolver_finds_what_rust_wrote_under_the_canonical_layout() {
    let Some(_) = parity::check("hook-mirror-paths-canonical") else {
        return;
    };
    let s = scratch("mewkit-mirror-paths-", "task-empty-project");
    let note = rust(&s, &["note", "gotchas"], Some(ENTRY));
    assert_eq!(note.code, 0, "{}", note.describe());
    let task = rust(
        &s,
        &["task", "new", "--activate", "Add user authentication"],
        None,
    );
    assert_eq!(task.code, 0, "{}", task.describe());

    let seen = resolved_paths(&s);
    let at = |key: &str| seen[key].as_str().expect("a path").to_string();
    assert!(
        same_path(&at("memory"), &s.project.join(".meowkit/memory")),
        "{seen}"
    );
    assert!(
        Path::new(&at("memory")).join("gotchas.md").is_file(),
        "`note` did not write where the resolver says memory lives: {seen}"
    );
    assert!(
        Path::new(&at("telemetry"))
            .join("trace-log.jsonl")
            .is_file(),
        "the activation trace is not under the resolver's telemetry dir: {seen}"
    );
    assert!(
        Path::new(&at("pointer")).is_file()
            && same_path(
                &at("pointer"),
                &Path::new(&at("state")).join("active-plan.json")
            ),
        "the pointer Rust wrote is not the resolver's session marker: {seen}"
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn the_legacy_memory_fallback_triggers_on_the_same_evidence_in_both() {
    let Some(_) = parity::check("hook-mirror-paths-legacy") else {
        return;
    };
    // A real pre-migration store: both sides keep using `.claude/memory`.
    let s = scratch("mewkit-mirror-paths-legacy-", "task-empty-project");
    let legacy = s.project.join(".claude/memory");
    std::fs::create_dir_all(&legacy).expect("create the legacy dir");
    std::fs::write(legacy.join("decisions.md"), "# Decisions\n").expect("seed the store");
    let note = rust(&s, &["note", "gotchas"], Some(ENTRY));
    assert_eq!(note.code, 0, "{}", note.describe());
    assert!(
        legacy.join("gotchas.md").is_file(),
        "Rust ignored the legacy store: {}",
        note.describe()
    );
    let seen = resolved_paths(&s);
    assert!(
        same_path(seen["memory"].as_str().unwrap_or_default(), &legacy),
        "{seen}"
    );

    // A decoy: unrelated files in that directory are NOT a store, to either side.
    let s = scratch("mewkit-mirror-paths-decoy-", "task-empty-project");
    let decoy = s.project.join(".claude/memory");
    std::fs::create_dir_all(&decoy).expect("create the decoy dir");
    std::fs::write(decoy.join("debug.log"), "noise\n").expect("seed the decoy");
    let note = rust(&s, &["note", "gotchas"], Some(ENTRY));
    assert_eq!(note.code, 0, "{}", note.describe());
    assert!(
        s.project.join(".meowkit/memory/gotchas.md").is_file(),
        "{}",
        note.describe()
    );
    let seen = resolved_paths(&s);
    assert!(
        same_path(
            seen["memory"].as_str().unwrap_or_default(),
            &s.project.join(".meowkit/memory")
        ),
        "{seen}"
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_pointer_at_the_legacy_location_is_honoured_by_both() {
    let Some(_) = parity::check("hook-mirror-paths-legacy-pointer") else {
        return;
    };
    let s = scratch("mewkit-mirror-paths-pointer-", "pointed-task");
    let canonical = s.project.join(".meowkit/state/active-plan.json");
    let legacy = s.project.join("session-state/active-plan.json");
    std::fs::create_dir_all(legacy.parent().expect("a parent")).expect("create the legacy dir");
    std::fs::rename(&canonical, &legacy).expect("move the pointer to the legacy location");

    let seen = resolved_paths(&s);
    assert!(
        same_path(seen["pointer"].as_str().unwrap_or_default(), &legacy),
        "{seen}"
    );
    // The pointer names `zeta`, the blocked one of two candidates; Rust only
    // resolves the ambiguity if it found the pointer where the hook does.
    let oriented = rust(&s, &["orient", "--no-record"], None);
    assert!(
        oriented.stdout.contains("task: zeta"),
        "Rust did not find the legacy pointer the hook resolver found: {}",
        oriented.describe()
    );
}
