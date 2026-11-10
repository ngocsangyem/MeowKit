use super::*;

fn rel(s: &str) -> RelPath {
    RelPath::new(s).unwrap()
}

/// A project with one file of each class, its index, and the kit's hashes.
fn fixture() -> (tempfile::TempDir, OwnershipIndex, BTreeMap<String, String>) {
    let dir = tempfile::tempdir().unwrap();
    let w = |p: &str, b: &[u8]| {
        let abs = rel(p).under(dir.path());
        std::fs::create_dir_all(abs.parent().unwrap()).unwrap();
        std::fs::write(abs, b).unwrap();
    };
    w(".codex/clean.md", b"kit");
    w(".codex/edited.md", b"user edit");
    w(".codex/dropped.md", b"old kit");
    w(".codex/user-own.md", b"mine");
    w(".meowkit/memory/decisions.md", b"notes");
    let mut index = OwnershipIndex::new("2.16.0", "1", Origin::Release);
    for (p, b) in [
        (".codex/clean.md", &b"kit"[..]),
        (".codex/edited.md", b"kit"),
        (".codex/dropped.md", b"old kit"),
        (".codex/gone.md", b"kit"),
        (".meowkit/memory/decisions.md", b"notes"),
    ] {
        index.paths.insert(p.into(), sha256_hex(b));
    }
    let kit: BTreeMap<String, String> = [".codex/clean.md", ".codex/edited.md", ".codex/gone.md"]
        .into_iter()
        .map(|p| (p.to_owned(), sha256_hex(b"kit")))
        .collect();
    (dir, index, kit)
}

#[test]
fn classifies_every_case() {
    let (dir, index, kit) = fixture();
    let lookup = |p: &RelPath| kit.get(p.as_str()).cloned();
    let got: BTreeMap<String, Class> = classify(dir.path(), &index, &[rel(".codex")], &lookup)
        .unwrap()
        .into_iter()
        .map(|(p, c)| (p.as_str().to_owned(), c))
        .collect();
    let want: BTreeMap<String, Class> = [
        (".codex/clean.md", Class::Clean),
        (".codex/edited.md", Class::Modified),
        (".codex/dropped.md", Class::Refused),
        (".codex/gone.md", Class::Missing),
        (".codex/user-own.md", Class::Orphan),
        (".meowkit/memory/decisions.md", Class::Protected),
    ]
    .into_iter()
    .map(|(p, c)| (p.to_owned(), c))
    .collect();
    assert_eq!(got, want);
}

#[test]
fn a_lying_index_cannot_make_a_user_file_clean() {
    // The index claims the user's file with its true hash; the kit disagrees.
    let (dir, mut index, kit) = fixture();
    index
        .paths
        .insert(".codex/user-own.md".into(), sha256_hex(b"mine"));
    let lookup = |p: &RelPath| kit.get(p.as_str()).cloned();
    let classes = classify(dir.path(), &index, &[], &lookup).unwrap();
    let class = classes
        .iter()
        .find(|(p, _)| p.as_str() == ".codex/user-own.md")
        .map(|(_, c)| c.clone());
    assert_eq!(class, Some(Class::Refused));
}

#[test]
fn round_trips_through_json() {
    let (dir, mut index, _) = fixture();
    index.packs = vec!["core".into()];
    index.hooks.insert("gate-enforcement".into(), "ab".into());
    let block = Section {
        format: crate::plan::Format::Markdown,
        key: vec![],
        names: vec![],
        created: 0,
        file_created: true,
    };
    index
        .sections
        .insert("AGENTS.md".into(), [("meowkit".to_owned(), block)].into());
    let file = dir.path().join("index.json");
    std::fs::write(&file, index.to_json()).unwrap();
    assert_eq!(OwnershipIndex::load(&file).unwrap(), Some(index));
}

#[test]
fn missing_index_is_none() {
    let dir = tempfile::tempdir().unwrap();
    assert!(
        OwnershipIndex::load(&dir.path().join("none.json"))
            .unwrap()
            .is_none()
    );
}

#[test]
fn refuses_a_newer_schema_naming_self_update() {
    let dir = tempfile::tempdir().unwrap();
    let file = dir.path().join("index.json");
    std::fs::write(&file, br#"{"schema_version": 2, "brand_new_field": true}"#).unwrap();
    let err = OwnershipIndex::load(&file).unwrap_err();
    assert!(matches!(err, IndexError::Newer { found: 2, .. }), "{err}");
    assert!(err.to_string().contains("self-update"));
}

#[test]
fn refuses_unknown_fields_and_unsafe_paths() {
    let dir = tempfile::tempdir().unwrap();
    let file = dir.path().join("index.json");
    let base = OwnershipIndex::new("1.0.0", "1", Origin::Release);
    let mut v: serde_json::Value = serde_json::from_slice(&base.to_json()).unwrap();
    v["extra"] = serde_json::json!(1);
    std::fs::write(&file, v.to_string()).unwrap();
    assert!(matches!(
        OwnershipIndex::load(&file),
        Err(IndexError::Invalid { .. })
    ));

    let mut escaping = base.clone();
    escaping.paths.insert("../outside".into(), "00".into());
    std::fs::write(&file, escaping.to_json()).unwrap();
    assert!(matches!(
        OwnershipIndex::load(&file),
        Err(IndexError::Invalid { .. })
    ));
}

#[test]
fn refuses_an_oversized_index_unread() {
    let dir = tempfile::tempdir().unwrap();
    let file = dir.path().join("index.json");
    let f = std::fs::File::create(&file).unwrap();
    f.set_len(MAX_INDEX_BYTES + 1).unwrap();
    assert!(matches!(
        OwnershipIndex::load(&file),
        Err(IndexError::TooLarge(_))
    ));
}
