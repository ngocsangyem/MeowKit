//! Reading the npm `mewkit` CLI's install records.
use std::path::Path;

use mewkit_core::adopt::{tree_checksum, tree_files, ts_ledger, ts_metadata};
use mewkit_core::fsx::sha256_hex;

fn put(root: &Path, rel: &str, text: &str) {
    let p = root.join(rel);
    std::fs::create_dir_all(p.parent().unwrap()).unwrap();
    std::fs::write(p, text).unwrap();
}

#[test]
fn tree_checksum_matches_the_npm_cli() {
    let d = tempfile::tempdir().unwrap();
    put(d.path(), "a/x.md", "one\n");
    put(d.path(), "B/y.txt", "two");
    put(d.path(), "a/Z/z.md", "three\n");
    put(d.path(), "a.md", "four");
    let files = tree_files(d.path()).unwrap();
    let names: Vec<_> = files.iter().map(|f| f.0.as_str()).collect();
    assert_eq!(names, ["B/y.txt", "a.md", "a/Z/z.md", "a/x.md"]);
    // Computed with the npm CLI's algorithm (checksum-utils.ts) in Node.
    assert_eq!(
        tree_checksum(&files),
        "a4c06966cff1d6bbad0c8c7c4bf586e9ef41c2920754ec4a21bc390f1442e3e5"
    );
}

#[test]
fn tree_checksum_sorts_like_javascript_not_by_bytes() {
    // UTF-16 order puts the astral character first; UTF-8 byte order would not.
    let d = tempfile::tempdir().unwrap();
    put(d.path(), "\u{fb00}.md", "a");
    put(d.path(), "\u{1f600}.md", "b");
    let files = tree_files(d.path()).unwrap();
    assert_eq!(files[0].0, "\u{1f600}.md");
    // Computed with the npm CLI's algorithm in Node.
    assert_eq!(
        tree_checksum(&files),
        "338f66f9dff1563bf5a687b6e1ae66f38002fd53db836612ca281893d88cc0a1"
    );
}

fn row(item: &str, provider: &str, global: bool, sum: &str) -> String {
    format!(
        r#"{{"item":"{item}","type":"config","provider":"{provider}","global":{global},"path":"/abs/{item}","installedAt":"2026-11-01T00:00:00.000Z","sourcePath":"root/{item}","sourceChecksum":"{sum}","targetChecksum":"{sum}","installSource":"kit"}}"#
    )
}

#[test]
fn a_ledger_adopts_only_paths_still_holding_the_recorded_bytes() {
    let d = tempfile::tempdir().unwrap();
    let r = d.path();
    put(r, ".codex/config.toml", "kit\n");
    put(r, ".codex/agents/a.toml", "a\n");
    put(r, ".codex/agents/b.toml", "b\n");
    put(r, ".agents/skills/s/SKILL.md", "skill\n");
    let agents = tree_checksum(&tree_files(&r.join(".codex/agents")).unwrap());
    let skills = tree_checksum(&tree_files(&r.join(".agents/skills")).unwrap());
    let rows = [
        row(".codex/config.toml", "codex", false, &sha256_hex(b"kit\n")),
        row(".codex/agents", "codex", false, &agents),
        row(".agents/skills", "codex", false, &skills),
        row(".codex/rules/default.rules", "codex", false, "0"),
        row("../outside", "codex", false, "0"),
        row(".codex/global.toml", "codex", true, "0"),
        row(".cursor/x", "cursor", false, "0"),
    ];
    put(
        r,
        ".meowkit/state/codex-ledger.json",
        &format!(
            r#"{{"version":"3.0","installations":[{}]}}"#,
            rows.join(",")
        ),
    );
    // Edited after install: the whole skills row is left to the user.
    put(r, ".agents/skills/s/SKILL.md", "mine\n");

    let got = ts_ledger(r, "codex").unwrap().unwrap();
    let paths: Vec<_> = got.paths.keys().map(String::as_str).collect();
    assert_eq!(
        paths,
        [
            ".codex/agents/a.toml",
            ".codex/agents/b.toml",
            ".codex/config.toml"
        ]
    );
    assert_eq!(got.skipped, 3, "edited dir, missing file, unsafe path");
    assert_eq!(got.paths[".codex/agents/a.toml"], sha256_hex(b"a\n"));
    assert!(ts_ledger(r, "cursor").unwrap().is_none());
}

#[test]
fn a_corrupt_ledger_is_an_error_not_an_empty_install() {
    let d = tempfile::tempdir().unwrap();
    put(d.path(), ".meowkit/state/cursor-ledger.json", "{ nope");
    let err = ts_ledger(d.path(), "cursor").unwrap_err();
    assert!(err.to_string().contains("cursor-ledger.json"), "{err}");
}

#[test]
fn claude_metadata_adopts_meowkit_owned_unedited_files() {
    let d = tempfile::tempdir().unwrap();
    let r = d.path();
    put(r, ".claude/rules/a.md", "a\n");
    put(r, ".claude/rules/b.md", "edited\n");
    put(r, ".claude/notes.md", "mine\n");
    let meta = format!(
        r#"{{"schemaVersion":"1.0","version":"v2.15.0","installedAt":"x","packs":["core"],"files":[
        {{"path":"rules/a.md","owner":"meowkit","layer":"core","checksum":"{a}","baseChecksum":"{a}"}},
        {{"path":"rules/b.md","owner":"meowkit","layer":"core","checksum":"{b}","baseChecksum":"{b}"}},
        {{"path":"notes.md","owner":"user","layer":"user","checksum":"{n}","baseChecksum":"{n}"}}]}}"#,
        a = sha256_hex(b"a\n"),
        b = sha256_hex(b"b\n"),
        n = sha256_hex(b"mine\n"),
    );
    put(r, ".meowkit/metadata.json", &meta);
    let got = ts_metadata(r).unwrap().unwrap();
    assert_eq!(got.kit_version, "v2.15.0");
    assert_eq!(got.packs, ["core"]);
    assert_eq!(got.paths.keys().collect::<Vec<_>>(), [".claude/rules/a.md"]);
    assert_eq!(got.skipped, 1);
}
