//! Global scope for every emitter against this checkout's kit, in a temp home.
mod support;

use std::path::Path;

use mewkit_adapters::claude_code::{ClaudeCode, SETTINGS};
use mewkit_adapters::codex::{Codex, HOOKS_JSON as CODEX_HOOKS};
use mewkit_adapters::contract::{Op, Plan};
use mewkit_adapters::cursor::{Cursor, HOOKS_JSON as CURSOR_HOOKS};
use mewkit_adapters::{EmitRequest, Emitter};
use serde_json::Value;
use support::{Project, kit, request, sha_tree};

/// Global install then strip leaves the home byte-identical, user files included.
fn round_trip<E: Emitter>(p: &Project<E>, user_file: &str, user_text: &str) -> Plan {
    let kit = kit();
    p.write(user_file, user_text);
    let before = sha_tree(p.root());
    let plan = p.emitter_prepare(&kit);
    let report = p.execute(&plan, &kit);
    assert!(report.preserved.is_empty(), "{:?}", report.preserved);
    let strip = p.strip_plan();
    let report = p.execute(&strip, &kit);
    assert!(report.preserved.is_empty(), "{:?}", report.preserved);
    assert_eq!(sha_tree(p.root()), before);
    plan
}

/// The script each merged hook runs: Claude Code's first `args` entry, or
/// the command's second word.
fn scripts(plan: &Plan) -> Vec<String> {
    let mut out = Vec::new();
    for op in &plan.ops {
        if let Op::MergeHooks { handlers, .. } = op {
            for h in handlers {
                out.push(match h.handler["args"].get(0) {
                    Some(a) => a.as_str().unwrap().to_owned(),
                    None => h.handler["command"]
                        .as_str()
                        .unwrap()
                        .split(' ')
                        .nth(1)
                        .unwrap()
                        .to_owned(),
                });
            }
        }
    }
    out
}

/// Every hook command line a plan merges.
fn commands(plan: &Plan) -> Vec<String> {
    let mut out = Vec::new();
    for op in &plan.ops {
        if let Op::MergeHooks { handlers, .. } = op {
            for h in handlers {
                let mut words = vec![h.handler["command"].as_str().unwrap_or("").to_owned()];
                for a in h.handler["args"].as_array().into_iter().flatten() {
                    words.push(a.as_str().unwrap().to_owned());
                }
                out.push(words.join(" "));
            }
        }
    }
    out
}

fn no_gates_and_no_home_agents_md(plan: &Plan) {
    for c in commands(plan) {
        for gate in [
            "gate-enforcement",
            "pre-ship",
            "pre-implement",
            "shell-gate",
            "tool-gate",
        ] {
            assert!(!c.contains(gate), "global plan registers `{c}`");
        }
    }
    assert!(plan.ops.iter().all(|o| o.path().as_str() != "AGENTS.md"));
}

#[test]
fn claude_code_global_round_trips_and_registers_privacy_and_session_only() {
    let p = Project::global(ClaudeCode, &[]);
    let user = "{\n  \"model\": \"opus\",\n  \"hooks\": {\n    \"Stop\": [\n      {\n        \"hooks\": [\n          {\n            \"type\": \"command\",\n            \"command\": \"say done\"\n          }\n        ]\n      }\n    ]\n  }\n}\n";
    let plan = round_trip(&p, SETTINGS, user);
    no_gates_and_no_home_agents_md(&plan);
    let cmds = commands(&plan);
    assert!(
        cmds.iter().any(|c| c.ends_with("privacy-block.cjs")),
        "{cmds:?}"
    );
    assert!(
        cmds.iter().any(|c| c.contains("dispatch.cjs SessionStart")),
        "{cmds:?}"
    );
    assert!(
        cmds.iter().all(|c| !c.contains("CLAUDE_PROJECT_DIR")),
        "{cmds:?}"
    );
    for script in scripts(&plan) {
        assert!(Path::new(&script).is_absolute(), "{script}");
    }
    let written: Vec<&str> = plan
        .ops
        .iter()
        .filter(|o| matches!(o, Op::WriteFile { .. }))
        .map(|o| o.path().as_str())
        .collect();
    assert!(written.iter().any(|w| w.starts_with(".claude/rules/")));
    assert!(
        written.iter().all(|w| [
            ".claude/agents/",
            ".claude/skills/",
            ".claude/rules/",
            ".claude/hooks/"
        ]
        .iter()
        .any(|d| w.starts_with(d))),
        "only agents, skills, rules, hooks"
    );
    assert!(
        plan.ops
            .iter()
            .all(|o| !matches!(o, Op::MergeEntries { .. })),
        "no env or statusLine"
    );
}

#[test]
fn claude_hook_paths_point_at_the_installed_scripts_under_claude_config_dir() {
    let elsewhere = tempfile::tempdir().unwrap();
    let config = elsewhere.path().join("claude config");
    let p = Project::global(ClaudeCode, &[("CLAUDE_CONFIG_DIR", &config)]);
    let kit = kit();
    let plan = p.emitter_prepare(&kit);
    p.execute(&plan, &kit);
    assert!(!p.root().join(".claude").exists(), "nothing at ~/.claude");
    for script in scripts(&plan) {
        assert!(Path::new(&script).is_file(), "{script} installed");
        assert!(script.contains("claude config"), "{script}");
    }
    let settings: Value =
        serde_json::from_str(&std::fs::read_to_string(config.join("settings.json")).unwrap())
            .unwrap();
    assert!(settings["hooks"]["PreToolUse"].is_array());
}

#[test]
fn codex_global_goes_to_codex_home_with_quoted_absolute_hooks() {
    let elsewhere = tempfile::tempdir().unwrap();
    let codex_home = elsewhere.path().join("codex home");
    let p = Project::global(Codex, &[("CODEX_HOME", &codex_home)]);
    let kit = kit();
    let user_agents = "# Mine\n";
    std::fs::create_dir_all(&codex_home).unwrap();
    std::fs::write(codex_home.join("AGENTS.md"), user_agents).unwrap();
    let before = sha_tree(&codex_home);

    let plan = p.emitter_prepare(&kit);
    no_gates_and_no_home_agents_md(&plan);
    assert!(
        plan.ops
            .iter()
            .all(|o| o.path().as_str() != ".codex/config.toml")
    );
    p.execute(&plan, &kit);
    let agents = std::fs::read_to_string(codex_home.join("AGENTS.md")).unwrap();
    assert!(agents.starts_with(user_agents) && agents.contains("<!-- mewkit:begin meowkit -->"));
    assert!(
        p.root().join(".agents/skills").is_dir(),
        "skills stay in ~/.agents"
    );
    let hooks: Value =
        serde_json::from_str(&std::fs::read_to_string(codex_home.join("hooks.json")).unwrap())
            .unwrap();
    let cmd = hooks["hooks"]["PreToolUse"][0]["hooks"][0]["command"]
        .as_str()
        .unwrap();
    assert!(
        cmd.contains("codex home") && cmd.contains("privacy-block.cjs\""),
        "{cmd}"
    );
    assert_eq!(commands(&plan).len(), 1, "privacy hook only");

    p.execute(&p.strip_plan(), &kit);
    assert_eq!(sha_tree(&codex_home), before);
    assert!(!p.root().join(".agents").exists());
}

#[test]
fn codex_global_round_trips_a_user_hooks_json() {
    let p = Project::global(Codex, &[]);
    let user = "{\n  \"hooks\": {\n    \"Stop\": [\n      {\n        \"hooks\": [\n          {\n            \"type\": \"command\",\n            \"command\": \"say done\"\n          }\n        ]\n      }\n    ]\n  }\n}\n";
    round_trip(&p, CODEX_HOOKS, user);
}

#[test]
fn cursor_global_round_trips_without_rules() {
    let p = Project::global(Cursor, &[]);
    let user = "{\n  \"version\": 1,\n  \"hooks\": {\n    \"stop\": [\n      {\n        \"command\": \"say done\"\n      }\n    ]\n  }\n}\n";
    let plan = round_trip(&p, CURSOR_HOOKS, user);
    no_gates_and_no_home_agents_md(&plan);
    assert!(
        plan.ops
            .iter()
            .all(|o| !o.path().as_str().starts_with(".cursor/rules/"))
    );
    assert!(plan.notices.iter().any(|n| n.contains("no rules")));
    let cmds = commands(&plan);
    assert_eq!(cmds.len(), 2, "{cmds:?}");
    assert!(
        cmds.iter().all(|c| c.starts_with("node ./hooks/")),
        "{cmds:?}"
    );
}

#[test]
fn a_privacy_hook_owned_at_the_other_scope_is_reported() {
    let kit = kit();
    let project = Project::new(Codex);
    project.execute(&project.emitter_prepare(&kit), &kit);
    let home = Project::global(Codex, &[]);
    let owned = project.index();
    let req = EmitRequest {
        other_scope: Some(&owned),
        ..request(&kit, &home.scope, &[], &[])
    };
    let plan = Codex.prepare(&req).unwrap();
    assert!(
        plan.notices
            .iter()
            .any(|n| n.contains("project install also registers the privacy hook")),
        "{:?}",
        plan.notices
    );
    let alone = Codex
        .prepare(&request(&kit, &home.scope, &[], &[]))
        .unwrap();
    assert!(!alone.notices.iter().any(|n| n.contains("privacy hook")));
}

#[test]
fn a_moved_runtime_dir_inside_home_survives_uninstall() {
    let kit = kit();
    let probe = Project::global(Codex, &[]);
    let codex_home = probe.root().join("work").join("codex");
    let p = Project::global(Codex, &[("CODEX_HOME", &codex_home)]);
    // CODEX_HOME names a dir in `probe`'s home; install there through `p`.
    p.execute(&p.emitter_prepare(&kit), &kit);
    assert!(codex_home.join("AGENTS.md").is_file());
    p.execute(&p.strip_plan(), &kit);
    assert!(codex_home.is_dir(), "the user's CODEX_HOME is never pruned");
    assert!(sha_tree(&codex_home).is_empty());
}

#[cfg(unix)]
#[test]
fn a_symlinked_claude_dir_keeps_its_link_and_target_after_uninstall() {
    let kit = kit();
    let dotfiles = tempfile::tempdir().unwrap();
    let target = dotfiles.path().join("claude");
    std::fs::create_dir(&target).unwrap();
    let p = Project::new_home_with(ClaudeCode, |home| {
        std::os::unix::fs::symlink(&target, home.join(".claude")).unwrap();
    });
    p.execute(&p.emitter_prepare(&kit), &kit);
    assert!(
        target.join("settings.json").is_file(),
        "written through the link"
    );
    p.execute(&p.strip_plan(), &kit);
    assert!(target.is_dir(), "the link's target stays");
    assert!(p.root().join(".claude").is_symlink(), "the link stays");
    assert!(sha_tree(&target).is_empty());
}
