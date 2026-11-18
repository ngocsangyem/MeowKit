//! The hand-ported Codex and Cursor bundles as an oracle for projection:
//! project the authored skills and agents and compare each file with the
//! bundle's copy. Lives only while `kit/bundles` does.
//!
//! Each limit is the number of files that differ today, every one of them
//! accounted for in `docs/maintainer/projection-divergences.md`. Lower a
//! limit as differences are settled; a rule change that raises one has
//! broken a file that used to match.
use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use mewkit_adapters::projection::target::{CODEX, CURSOR};
use mewkit_adapters::projection::{
    Invocation, Overlay, Skill, Target, agent, anchor, frontmatter, project_skill_body,
    project_tree, read_skills, script,
};

struct Bundle {
    target: &'static Target,
    /// Folder under `kit/bundles` and under `kit/overlays`.
    runtime: &'static str,
    /// Product names the bundle uses for this runtime. The Cursor bundle was
    /// ported from the Codex one and still says "Codex" in places.
    host_aliases: &'static [(&'static str, &'static str)],
    /// Skills whose frontmatter keeps a key from the source that the bundle
    /// dropped: the bundle did not port the Python scripts the key is for.
    frontmatter_from_source: &'static [&'static str],
    max_differing_bodies: usize,
    /// Text files that are not Markdown, compared byte for byte.
    max_differing_scripts: usize,
    max_reworded_skill_descriptions: usize,
    max_reworded_agent_descriptions: usize,
    max_reworded_agent_prompts: usize,
}

const CODEX_BUNDLE: Bundle = Bundle {
    target: &CODEX,
    runtime: "codex",
    host_aliases: &[],
    frontmatter_from_source: &["lint-and-validate"],
    max_differing_bodies: 161,
    max_differing_scripts: 79,
    max_reworded_skill_descriptions: 110,
    max_reworded_agent_descriptions: 25,
    max_reworded_agent_prompts: 34,
};

const CURSOR_BUNDLE: Bundle = Bundle {
    target: &CURSOR,
    runtime: "cursor",
    host_aliases: &[("Codex", "Cursor"), ("codex", "cursor")],
    frontmatter_from_source: &["lint-and-validate"],
    max_differing_bodies: 244,
    max_differing_scripts: 80,
    max_reworded_skill_descriptions: 110,
    // Every Cursor agent was rewritten by hand in the third person.
    max_reworded_agent_descriptions: 41,
    max_reworded_agent_prompts: 41,
};

fn repo() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn body(text: &str) -> &str {
    text.strip_prefix("---\n")
        .and_then(|rest| rest.find("\n---").map(|end| &rest[end + 4..]))
        .unwrap_or(text)
}

/// An invocation (`$mk-x`, `/mk-x`), code-quoted or not, written as "the x skill".
fn fold_invocations(line: &str, sigil: &str) -> String {
    let needle = format!("{sigil}mk-");
    let mut out = String::new();
    let mut rest = line;
    while let Some(at) = rest.find(&needle) {
        let name_at = at + needle.len();
        let name_len = rest[name_at..]
            .find(|c: char| !(c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-'))
            .unwrap_or(rest.len() - name_at);
        let in_path = rest[..at]
            .chars()
            .next_back()
            .is_some_and(|c| c.is_alphanumeric() || "/._-".contains(c));
        if in_path {
            out.push_str(&rest[..name_at]);
            rest = &rest[name_at..];
            continue;
        }
        let quoted = rest[..at].ends_with('`') && rest[name_at + name_len..].starts_with('`');
        out.push_str(&rest[..at - usize::from(quoted)]);
        out.push_str(&format!("the {} skill", &rest[name_at..name_at + name_len]));
        rest = &rest[name_at + name_len + usize::from(quoted)..];
    }
    out + rest
}

/// Forms a bundle uses interchangeably for the same source text, folded so
/// they do not count as a difference: an invocation and "the x skill"; the
/// delegation noun in any number, case or emphasis; `AGENTS.md` quoted or
/// not; the bundle's aliases for its own product name.
fn fold(line: &str, bundle: &Bundle) -> String {
    let mut line = line.trim_end().to_owned();
    if let Invocation::Sigil(sigil) = bundle.target.invocation {
        line = fold_invocations(&line, sigil);
    }
    for (alias, name) in bundle.host_aliases {
        line = line.replace(alias, name);
    }
    let line = line
        .replace("`the ", "the ")
        .replace(" skill`", " skill")
        .replace("`AGENTS.md`", "AGENTS.md");
    let lower = line.to_ascii_lowercase(); // same byte offsets as `line`
    let mut out = String::new();
    let mut copied = 0;
    while let Some(at) = lower[copied..].find("sub").map(|i| copied + i) {
        let noun = ["sub-tasks", "subagents", "sub-task", "subagent"]
            .iter()
            .find(|n| lower[at..].starts_with(**n));
        let end = at + noun.map_or(3, |n| n.len());
        out.push_str(&line[copied..if noun.is_some() { at } else { end }]);
        if noun.is_some() {
            out.push_str("SUBAGENT");
        }
        copied = end;
    }
    (out + &line[copied..]).replace("**SUBAGENT**", "SUBAGENT")
}

fn lines(text: &str, bundle: &Bundle) -> Vec<String> {
    text.lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| fold(l, bundle))
        .collect()
}

/// The non-blank lines of `text` up to `end`, without the one that starts with `skip`.
fn head<'a>(text: &'a str, end: &str, skip: &str) -> Vec<&'a str> {
    let head = &text[..text.find(end).unwrap_or(text.len())];
    head.lines()
        .filter(|l| !l.is_empty() && !l.starts_with(skip))
        .collect()
}

fn line<'a>(text: &'a str, start: &str) -> &'a str {
    text.lines().find(|l| l.starts_with(start)).unwrap_or("")
}

fn authored_skills() -> (Vec<Skill>, BTreeSet<String>) {
    let skills = read_skills(&repo().join(".claude/skills")).unwrap();
    let names = skills.iter().map(|s| s.name.clone()).collect();
    (skills, names)
}

fn skill_bodies(bundle: &Bundle) {
    let target = bundle.target;
    let ported_root = repo()
        .join("kit/bundles")
        .join(bundle.runtime)
        .join("root")
        .join(target.skills_root);
    let (skills, names) = authored_skills();

    let (mut same, mut differing) = (0usize, Vec::new());
    for skill in &skills {
        let folder = format!("{}{}", target.skill_prefix, skill.name);
        let own = format!("{}/{folder}", target.skills_root);
        for file in skill.files.iter().filter(|f| f.ends_with(".md")) {
            let Ok(ported) = std::fs::read_to_string(ported_root.join(&folder).join(file)) else {
                continue; // not ported to the bundle
            };
            let source = repo().join(format!(".claude/skills/{}/{file}", skill.name));
            let source = std::fs::read_to_string(source).unwrap();
            let projected = project_skill_body(body(&source), skill, &names, target);
            // The installer anchors the bundle's helper paths; compare with that applied.
            let installed = anchor::helper_paths(body(&ported), &own, &skill.files);
            if lines(&projected, bundle) == lines(&installed, bundle) {
                same += 1;
            } else {
                differing.push(format!("{}/{file}", skill.name));
            }
        }
    }
    assert!(same + differing.len() >= 800, "too few files compared");
    println!(
        "{} skill bodies: identical {same}, differing {}",
        bundle.runtime,
        differing.len()
    );
    assert!(
        differing.len() <= bundle.max_differing_bodies,
        "{} files differ from the {} bundle (limit {}):\n{}",
        differing.len(),
        bundle.runtime,
        bundle.max_differing_bodies,
        differing.join("\n")
    );
}

fn skill_scripts(bundle: &Bundle) {
    let target = bundle.target;
    let ported_root = repo()
        .join("kit/bundles")
        .join(bundle.runtime)
        .join("root")
        .join(target.skills_root);
    let (skills, names) = authored_skills();

    // `moved`: files the bundle carries as authored and projection changes.
    let (mut same, mut differing, mut moved) = (0usize, Vec::new(), Vec::new());
    for skill in &skills {
        let folder = format!("{}{}", target.skill_prefix, skill.name);
        for file in skill.files.iter().filter(|f| !f.ends_with(".md")) {
            let source = repo().join(format!(".claude/skills/{}/{file}", skill.name));
            let (Ok(source), Ok(ported)) = (
                std::fs::read_to_string(source),
                std::fs::read_to_string(ported_root.join(&folder).join(file)),
            ) else {
                continue; // not text, or not ported to the bundle
            };
            let projected = script::project_script(&source, file, &skill.name, &names, target);
            if projected == ported {
                same += 1;
            } else {
                if source == ported {
                    moved.push(format!("{}/{file}", skill.name));
                }
                differing.push(format!("{}/{file}", skill.name));
            }
        }
    }
    assert!(same + differing.len() >= 180, "too few files compared");
    println!(
        "{} skill scripts: identical {same}, differing {} ({} of them carried as authored by the bundle)",
        bundle.runtime,
        differing.len(),
        moved.len()
    );
    if std::env::var_os("MEWKIT_LIST_SCRIPTS").is_some() {
        println!(
            "differing:\n{}\nmoved:\n{}",
            differing.join("\n"),
            moved.join("\n")
        );
    }
    assert!(
        differing.len() <= bundle.max_differing_scripts,
        "{} scripts differ from the {} bundle (limit {}):\n{}",
        differing.len(),
        bundle.runtime,
        bundle.max_differing_scripts,
        differing.join("\n")
    );
}

fn skill_frontmatter(bundle: &Bundle) {
    let target = bundle.target;
    let ported_root = repo()
        .join("kit/bundles")
        .join(bundle.runtime)
        .join("root")
        .join(target.skills_root);
    let overlay = Overlay::read(&repo().join("kit/overlays").join(bundle.runtime)).unwrap();
    let (skills, names) = authored_skills();

    let (mut reworded, mut other) = (0usize, Vec::new());
    for skill in &skills {
        let folder = format!("{}{}", target.skill_prefix, skill.name);
        let Ok(ported) = std::fs::read_to_string(ported_root.join(folder).join("SKILL.md")) else {
            continue;
        };
        let source = repo().join(format!(".claude/skills/{}/SKILL.md", skill.name));
        let source = std::fs::read_to_string(source).unwrap();
        let keys = overlay.skill_keys(&skill.name);
        let projected = frontmatter::skill_file(&source, skill, &names, target, keys, Ok).unwrap();
        if line(&projected, "description:") != line(&ported, "description:") {
            reworded += 1;
        }
        let same =
            head(&projected, "\n---\n", "description:") == head(&ported, "\n---\n", "description:");
        if !same
            && !bundle
                .frontmatter_from_source
                .contains(&skill.name.as_str())
        {
            other.push(skill.name.clone());
        }
    }
    println!(
        "{} skill descriptions reworded in the bundle: {reworded}",
        bundle.runtime
    );
    assert!(other.is_empty(), "frontmatter differs: {other:?}");
    assert!(reworded >= 100, "the bundle's skills were not read");
    assert!(
        reworded <= bundle.max_reworded_skill_descriptions,
        "{reworded}"
    );
}

fn agents(bundle: &Bundle) {
    let target = bundle.target;
    let ported_root = repo()
        .join("kit/bundles")
        .join(bundle.runtime)
        .join("root")
        .join(target.host_dir)
        .join("agents");
    let overlay = Overlay::read(&repo().join("kit/overlays").join(bundle.runtime)).unwrap();
    let (_, names) = authored_skills();
    let toml = target.agent_ext == "toml";
    let (description, prompt_start) = if toml {
        ("description =", "developer_instructions")
    } else {
        ("description:", "\n---\n")
    };

    let (mut descriptions, mut prompts, mut keys, mut seen) = (0usize, 0usize, Vec::new(), 0);
    for entry in std::fs::read_dir(&ported_root).unwrap() {
        let path = entry.unwrap().path();
        let name = path.file_stem().unwrap().to_str().unwrap().to_owned();
        let ported = std::fs::read_to_string(&path).unwrap();
        let file = format!("{name}.md");
        let source = std::fs::read_to_string(repo().join(".claude/agents").join(&file)).unwrap();
        let extra = overlay.agent_keys(&name);
        let project = if toml {
            agent::codex_agent
        } else {
            agent::markdown_agent
        };
        let projected = project(&file, &source, &names, target, extra, Ok).unwrap();
        seen += 1;
        if line(&projected, description) != line(&ported, description) {
            descriptions += 1;
        }
        if head(&projected, prompt_start, description) != head(&ported, prompt_start, description) {
            keys.push(name.clone());
        }
        let prompt = |t: &str| lines(&t[t.find(prompt_start).unwrap()..], bundle);
        if prompt(&projected) != prompt(&ported) {
            prompts += 1;
        }
    }
    println!(
        "{} agents: {seen}; descriptions reworded: {descriptions}; prompts reworded: {prompts}",
        bundle.runtime
    );
    assert!(keys.is_empty(), "agent keys differ: {keys:?}");
    assert_eq!(seen, 41, "the bundle's agents were not read");
    assert!(
        descriptions <= bundle.max_reworded_agent_descriptions,
        "{descriptions}"
    );
    assert!(prompts <= bundle.max_reworded_agent_prompts, "{prompts}");
}

/// The whole kit projects with the runtime's overlay applied. With
/// `MEWKIT_PROJECT_TO=<dir>` the tree is also written to
/// `<dir>/<runtime>/`, for `scripts/check-instruction-criteria.cjs`.
fn whole_kit(bundle: &Bundle) {
    let overlay = Overlay::read(&repo().join("kit/overlays").join(bundle.runtime)).unwrap();
    let tree = project_tree(&repo().join(".claude"), &overlay, bundle.target).unwrap();
    let skills = tree.keys().filter(|p| p.ends_with("/SKILL.md")).count();
    let agents = format!("{}/agents/", bundle.target.host_dir);
    let agents = tree.keys().filter(|p| p.starts_with(&agents)).count();
    println!(
        "{} projection: {skills} skills, {agents} agents",
        bundle.runtime
    );
    assert!(skills > 100 && agents > 30);
    // Every projected agent and skill header is well formed.
    for (path, bytes) in &tree {
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
    let out = PathBuf::from(out).join(bundle.runtime);
    for (path, bytes) in &tree {
        let file = out.join(path);
        std::fs::create_dir_all(file.parent().unwrap()).unwrap();
        std::fs::write(file, bytes).unwrap();
    }
}

#[test]
fn the_whole_kit_projects_for_codex() {
    whole_kit(&CODEX_BUNDLE);
}

#[test]
fn the_whole_kit_projects_for_cursor() {
    whole_kit(&CURSOR_BUNDLE);
}

#[test]
fn projected_skill_bodies_match_the_codex_bundle() {
    skill_bodies(&CODEX_BUNDLE);
}

#[test]
fn projected_skill_frontmatter_matches_the_codex_bundle() {
    skill_frontmatter(&CODEX_BUNDLE);
}

#[test]
fn projected_agents_match_the_codex_bundle() {
    agents(&CODEX_BUNDLE);
}

#[test]
fn projected_skill_bodies_match_the_cursor_bundle() {
    skill_bodies(&CURSOR_BUNDLE);
}

#[test]
fn projected_skill_frontmatter_matches_the_cursor_bundle() {
    skill_frontmatter(&CURSOR_BUNDLE);
}

#[test]
fn projected_agents_match_the_cursor_bundle() {
    agents(&CURSOR_BUNDLE);
}

#[test]
fn projected_skill_scripts_match_the_codex_bundle() {
    skill_scripts(&CODEX_BUNDLE);
}

#[test]
fn projected_skill_scripts_match_the_cursor_bundle() {
    skill_scripts(&CURSOR_BUNDLE);
}
