//! The Grok emitter against this checkout's own kit: install, check the form
//! Grok documents, strip back to the starting tree.
mod support;

use mewkit_adapters::Emitter;
use mewkit_adapters::contract::{EmitError, Op, Scope};
use mewkit_adapters::grok::{Grok, HOOKS_JSON, KIT_DIR};
use serde_json::Value;
use support::{Project, kit, request, sha_tree};

#[test]
fn installs_beside_the_users_hook_file_and_strips_back_byte_for_byte() {
    let kit = kit();
    let p = Project::new(Grok);
    p.write(".grok/hooks/mine.json", "{ \"hooks\": {} }\n");
    p.write("AGENTS.md", "# Mine\n");
    let before = sha_tree(p.root());

    let plan = Grok.prepare(&request(&kit, &p.scope, &[], &[])).unwrap();
    let report = p.execute(&plan, &kit);
    assert!(report.preserved.is_empty(), "{:?}", report.preserved);
    assert!(p.read("AGENTS.md").starts_with("# Mine\n"));
    assert!(
        p.read("AGENTS.md")
            .contains("<!-- mewkit:begin meowkit -->")
    );
    assert!(p.root().join(".grok/skills/mk-cook/SKILL.md").is_file());

    let strip = Grok.plan_strip(&p.scope, &p.index()).unwrap();
    let report = p.execute(&strip, &kit);
    assert!(report.preserved.is_empty(), "{:?}", report.preserved);
    assert_eq!(sha_tree(p.root()), before);
}

/// https://docs.x.ai/build/features/hooks: `hooks.<Event>[].hooks[]` with
/// `type`, `command` and a `timeout` in seconds (default 5); only `PreToolUse`
/// blocks; every `*.json` in `.grok/hooks/` is a hook file.
#[test]
fn the_hook_file_is_in_the_documented_form_and_alone_in_the_hooks_folder() {
    let kit = kit();
    let p = Project::new(Grok);
    let plan = Grok.prepare(&request(&kit, &p.scope, &[], &[])).unwrap();
    let written: Vec<&str> = plan
        .ops
        .iter()
        .filter_map(|op| match op {
            Op::WriteFile { path, .. } => Some(path.as_str()),
            _ => None,
        })
        .collect();
    let in_hooks: Vec<&&str> = written
        .iter()
        .filter(|path| path.starts_with(".grok/hooks/"))
        .collect();
    assert_eq!(in_hooks, [&HOOKS_JSON]);

    p.execute(&plan, &kit);
    let doc: Value = serde_json::from_str(&p.read(HOOKS_JSON)).unwrap();
    let events = doc["hooks"].as_object().unwrap();
    assert_eq!(events.keys().collect::<Vec<_>>(), ["PreToolUse"]);
    let mut scripts = Vec::new();
    for group in events["PreToolUse"].as_array().unwrap() {
        for handler in group["hooks"].as_array().unwrap() {
            assert_eq!(handler["type"], "command");
            assert!(handler["timeout"].as_u64().unwrap() > 5);
            let command = handler["command"].as_str().unwrap();
            let script = command
                .strip_prefix("node \"$GROK_WORKSPACE_ROOT/")
                .and_then(|rest| rest.strip_suffix('"'))
                .unwrap_or_else(|| panic!("{command}"));
            assert!(p.root().join(script).is_file(), "{script}");
            scripts.push(script.to_owned());
        }
    }
    assert_eq!(
        scripts,
        [
            format!("{KIT_DIR}/hooks/privacy-block.cjs"),
            format!("{KIT_DIR}/hooks/pre-ship.cjs")
        ]
    );
    let config: Value =
        serde_json::from_str(&p.read(&format!("{KIT_DIR}/hooks/hook-runtime-config.json")))
            .unwrap();
    assert_eq!(config["runtime"], "grok");
}

#[test]
fn no_agent_definition_is_written_and_the_prompts_carry_no_model() {
    let kit = kit();
    let p = Project::new(Grok);
    let plan = Grok.prepare(&request(&kit, &p.scope, &[], &[])).unwrap();
    p.execute(&plan, &kit);
    assert!(!p.root().join(".grok/agents").exists());
    let prompt = p.read(&format!("{KIT_DIR}/agents/reviewer.md"));
    let frontmatter = prompt.split("\n---\n").next().unwrap();
    assert!(frontmatter.contains("\nname: reviewer\n"), "{frontmatter}");
    assert!(!frontmatter.contains("model:"), "{frontmatter}");
    assert!(
        !p.root()
            .join(format!("{KIT_DIR}/agents/orchestrator.md"))
            .exists()
    );
    assert!(
        plan.notices
            .iter()
            .any(|n| n.contains("no agent definitions")),
        "{:?}",
        plan.notices
    );
}

#[test]
fn a_finding_about_the_installed_text_names_its_file_and_line() {
    let kit = kit();
    let p = Project::new(Grok);
    let plan = Grok.prepare(&request(&kit, &p.scope, &[], &[])).unwrap();
    for n in plan
        .notices
        .iter()
        .filter(|n| n.starts_with("denied") || n.starts_with("dangling"))
    {
        assert!(
            n.contains(" at .grok/") || n.contains(" at AGENTS.md:"),
            "a finding names an installed file and line: {n}"
        );
    }
}

#[test]
fn a_user_level_install_is_refused() {
    let kit = kit();
    let home = tempfile::tempdir().unwrap();
    let scope = Scope::global(home.path(), |_| None).unwrap();
    let err = Grok.prepare(&request(&kit, &scope, &[], &[])).unwrap_err();
    assert!(matches!(err, EmitError::Unsupported { .. }), "{err}");
}
