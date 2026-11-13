// Ports `state/__tests__/meowkit-state-paths.test.ts`.
//
// Pure path builders — no filesystem side effects. Taxonomy is fixed:
// memory/ telemetry/ state/ cache/ migrations/. The migration lock lives under
// state/ (relocated from `.mewkit/.lock`).
use super::*;

fn meowkit() -> PathBuf {
    Path::new("/project").join(".meowkit")
}

#[test]
fn exposes_the_five_store_taxonomy_under_the_meowkit_base() {
    let base = meowkit();
    let p = meowkit_state_paths(&base);
    assert_eq!(p.base, base);
    assert_eq!(p.memory, base.join("memory"));
    assert_eq!(p.telemetry, base.join("telemetry"));
    assert_eq!(p.state, base.join("state"));
    assert_eq!(p.cache, base.join("cache"));
    assert_eq!(p.migrations, base.join("migrations"));
}

#[test]
fn locates_the_migration_lock_under_state() {
    let base = meowkit();
    assert_eq!(
        meowkit_state_paths(&base).migrate_lock,
        base.join("state").join("migrate.lock")
    );
}

#[test]
fn locates_per_store_locks_under_state_locks() {
    let base = meowkit();
    assert_eq!(
        meowkit_state_paths(&base).store_locks_dir,
        base.join("state").join("locks")
    );
}

// The ledger paths `adopt.rs` reads today, asserted here so the two cannot drift
// apart silently.
#[test]
fn locates_the_provider_ledgers_under_state() {
    let base = meowkit();
    let p = meowkit_state_paths(&base);
    assert_eq!(p.codex_ledger, base.join("state").join("codex-ledger.json"));
    assert_eq!(
        p.cursor_ledger,
        base.join("state").join("cursor-ledger.json")
    );
}

#[test]
fn resolves_every_class_under_meowkit_by_default() {
    let root = Path::new("/project");
    for (class, name) in [
        (StateClass::Memory, "memory"),
        (StateClass::Telemetry, "telemetry"),
        (StateClass::State, "state"),
        (StateClass::Cache, "cache"),
    ] {
        assert_eq!(
            resolve_state_dir(root, class),
            root.join(".meowkit").join(name)
        );
    }
}

#[test]
fn falls_back_to_the_legacy_memory_tree_only_for_a_real_store() {
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path();
    let legacy = root.join(".claude").join("memory");
    std::fs::create_dir_all(&legacy).unwrap();

    // An unrelated file in the legacy tree is NOT a store: a stray log must not
    // relocate the committed memory store into a gitignored directory.
    std::fs::write(legacy.join("session.log"), "x").unwrap();
    assert!(!using_legacy_memory_tree(root));
    assert_eq!(
        resolve_state_dir(root, StateClass::Memory),
        root.join(".meowkit").join("memory")
    );

    std::fs::write(legacy.join("gotchas.md"), "# Gotchas\n").unwrap();
    assert!(using_legacy_memory_tree(root));
    assert_eq!(resolve_state_dir(root, StateClass::Memory), legacy);
    // Scoped to memory: telemetry never lived in the legacy tree.
    assert_eq!(
        resolve_state_dir(root, StateClass::Telemetry),
        root.join(".meowkit").join("telemetry")
    );

    // A `.meowkit/memory` counterpart wins, whatever the legacy tree holds.
    std::fs::create_dir_all(root.join(".meowkit").join("memory")).unwrap();
    assert!(!using_legacy_memory_tree(root));
}

#[test]
fn a_session_marker_resolves_canonical_first_then_each_pre_move_location() {
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path();
    let canonical = root.join(".meowkit").join("state").join("active-plan.json");

    // Absent everywhere: reported where a writer would put it.
    assert_eq!(
        resolve_session_state_file(root, "active-plan.json"),
        canonical
    );

    // The oldest location is still read…
    let oldest = root.join(".claude").join("session-state");
    std::fs::create_dir_all(&oldest).unwrap();
    std::fs::write(oldest.join("active-plan.json"), "{}").unwrap();
    assert_eq!(
        resolve_session_state_file(root, "active-plan.json"),
        oldest.join("active-plan.json")
    );

    // …until a newer one exists, in the documented precedence order.
    let newer = root.join("session-state");
    std::fs::create_dir_all(&newer).unwrap();
    std::fs::write(newer.join("active-plan.json"), "{}").unwrap();
    assert_eq!(
        resolve_session_state_file(root, "active-plan.json"),
        newer.join("active-plan.json")
    );

    std::fs::create_dir_all(canonical.parent().unwrap()).unwrap();
    std::fs::write(&canonical, "{}").unwrap();
    assert_eq!(
        resolve_session_state_file(root, "active-plan.json"),
        canonical
    );
}
