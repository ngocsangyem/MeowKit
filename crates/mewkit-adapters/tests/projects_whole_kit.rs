//! This checkout's `.claude/` projects whole for each runtime, with that
//! runtime's overlay applied, and every projected header is well formed.
//!
//! With `MEWKIT_PROJECT_TO=<dir>` each tree is also written to
//! `<dir>/<runtime>/`, to read what projection produced.
use std::path::{Path, PathBuf};

use mewkit_adapters::projection::target::{CODEX, CURSOR};
use mewkit_adapters::projection::{Overlay, Target, project_tree};

fn repo() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn whole_kit(runtime: &str, target: &Target) {
    let overlay = Overlay::read(&repo().join("kit/overlays").join(runtime)).unwrap();
    let tree = project_tree(&repo().join(".claude"), &overlay, target).unwrap();
    let skills = tree.keys().filter(|p| p.ends_with("/SKILL.md")).count();
    let agents = format!("{}/agents/", target.host_dir);
    let agents = tree.keys().filter(|p| p.starts_with(&agents)).count();
    println!("{runtime} projection: {skills} skills, {agents} agents");
    assert!(skills > 100 && agents > 30);
    // A file the overlay supplies whole is written by hand and has its own form.
    for (path, bytes) in tree.iter().filter(|(p, _)| !overlay.files.contains_key(*p)) {
        let text = String::from_utf8_lossy(bytes);
        if path.ends_with(".toml") {
            let parsed = text.parse::<toml_edit::DocumentMut>();
            assert!(parsed.is_ok(), "{path}: {:?}", parsed.err());
        } else if path.ends_with("/SKILL.md") {
            let front = &text[..text.find("\n---\n").expect(path)];
            let lines: Vec<&str> = front.lines().skip(1).collect();
            assert!(lines[0].starts_with("name: \"mk-"), "{path}");
            assert!(lines[1].starts_with("description: \""), "{path}");
            assert!(lines.iter().all(|l| l.contains(": ")), "{path}");
        }
    }

    let Some(out) = std::env::var_os("MEWKIT_PROJECT_TO") else {
        return;
    };
    let out = PathBuf::from(out).join(runtime);
    for (path, bytes) in &tree {
        let file = out.join(path);
        std::fs::create_dir_all(file.parent().unwrap()).unwrap();
        std::fs::write(file, bytes).unwrap();
    }
}

#[test]
fn the_whole_kit_projects_for_codex() {
    whole_kit("codex", &CODEX);
}

#[test]
fn the_whole_kit_projects_for_cursor() {
    whole_kit("cursor", &CURSOR);
}

/// Projected skills cite a rule file as "AGENTS.md (<section>)": each section
/// they can name is a heading of the block every runtime shares.
#[test]
fn every_rule_section_a_skill_can_cite_is_in_the_shared_block() {
    let block = String::from_utf8(mewkit_adapters::agents_block::read(&repo()).unwrap()).unwrap();
    let headings: Vec<&str> = block
        .lines()
        .filter(|l| l.starts_with('#'))
        .map(|l| l.trim_start_matches('#').trim())
        .collect();
    for target in [&CODEX, &CURSOR] {
        for (file, section) in target.rule_sections {
            assert!(
                headings.iter().any(|h| h.starts_with(section)),
                "{}: {file} is cited as {section:?}, which the block has no heading for",
                target.host_name
            );
        }
    }
    assert!(block.len() <= mewkit_adapters::agents_block::BUDGET);
}
