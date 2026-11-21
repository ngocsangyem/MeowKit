use super::*;

// Shapes recorded from `claude -p --output-format stream-json --verbose`
// (Claude Code 2.1.329) and `codex exec --json` (codex-cli 0.167.0).
const CLAUDE_ON: &str = r#"{"type":"system","subtype":"init","model":"claude-opus-5-5","skills":["probe-colour","mk:cook"]}
{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Skill","input":{"skill":"probe-colour"}}]}}
{"type":"result","subtype":"success","is_error":false,"result":"VERMILION-42"}"#;

const CODEX_ON: &str = r#"{"type":"thread.started","thread_id":"x"}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"I'll use the skill."}}
{"type":"item.completed","item":{"id":"item_1","type":"command_execution","command":"/bin/zsh -lc \"pwd && sed -n '1,240p' .agents/skills/probe-colour/SKILL.md\"","exit_code":0}}
{"type":"item.completed","item":{"id":"item_2","type":"agent_message","text":"VERMILION-42"}}
{"type":"turn.completed","usage":{"input_tokens":1}}"#;

#[test]
fn claude_skill_call_is_a_load_and_listing_is_kept() {
    let t = parse(Runtime::ClaudeCode, CLAUDE_ON).expect("parses");
    assert_eq!(t.events, vec![Event::SkillLoad("probe-colour".into())]);
    assert_eq!(t.final_text, "VERMILION-42");
    assert_eq!(
        t.listed_skills,
        Some(vec!["probe-colour".into(), "cook".into()])
    );
}

#[test]
fn claude_other_tools_are_tool_events() {
    let out = r#"{"type":"assistant","message":{"content":[{"type":"text","text":"hi"},{"type":"tool_use","name":"Bash","input":{"command":"ls"}}]}}
{"type":"result","is_error":false,"result":"none"}"#;
    let t = parse(Runtime::ClaudeCode, out).expect("parses");
    assert_eq!(t.events, vec![tool("Bash", r#"{"command":"ls"}"#)]);
}

#[test]
fn claude_error_result_is_a_runtime_error() {
    let out = r#"{"type":"result","is_error":true,"result":"Failed to authenticate"}"#;
    assert_eq!(
        parse(Runtime::ClaudeCode, out),
        Err(TranscriptError::Runtime("Failed to authenticate".into()))
    );
}

#[test]
fn codex_skill_read_is_a_load_and_last_message_is_final() {
    let t = parse(Runtime::Codex, CODEX_ON).expect("parses");
    assert_eq!(t.events, vec![Event::SkillLoad("probe-colour".into())]);
    assert_eq!(t.final_text, "VERMILION-42");
    assert_eq!(t.listed_skills, None);
}

#[test]
fn codex_plain_command_is_a_shell_tool_and_installed_names_normalise() {
    let out = r#"{"type":"item.completed","item":{"type":"command_execution","command":"rg -n colour ."}}
{"type":"item.completed","item":{"type":"command_execution","command":"cat /home/u/.codex/skills/mk-cook/SKILL.md"}}
{"type":"item.completed","item":{"type":"file_change","changes":[]}}
{"type":"turn.completed"}"#;
    let t = parse(Runtime::Codex, out).expect("parses");
    assert_eq!(
        t.events,
        vec![
            tool("shell", "rg -n colour ."),
            Event::SkillLoad("cook".into()),
            tool("file_change", "")
        ]
    );
}

#[test]
fn codex_failed_turn_is_a_runtime_error() {
    let out = r#"{"type":"turn.failed","error":{"message":"rate limited"}}"#;
    assert_eq!(
        parse(Runtime::Codex, out),
        Err(TranscriptError::Runtime("rate limited".into()))
    );
}

#[test]
fn output_without_a_final_result_is_an_error_not_a_failure() {
    let cut = CLAUDE_ON.lines().take(2).collect::<Vec<_>>().join("\n");
    assert_eq!(
        parse(Runtime::ClaudeCode, &cut),
        Err(TranscriptError::NoResult)
    );
    assert_eq!(parse(Runtime::Codex, ""), Err(TranscriptError::NoResult));
}

#[test]
fn non_json_line_is_reported_by_number() {
    let out = "{\"type\":\"turn.started\"}\nAuthentication required\n";
    assert_eq!(
        parse(Runtime::Codex, out),
        Err(TranscriptError::NotJson { line: 2 })
    );
}

#[test]
fn skill_names_normalise_across_runtimes() {
    for raw in ["cook", "mk:cook", "mk-cook", "meowkit:cook"] {
        assert_eq!(normalize_skill(raw), "cook", "{raw}");
    }
}

#[test]
fn claude_unfinished_subtype_is_an_error_even_without_is_error() {
    let out = r#"{"type":"result","subtype":"error_max_turns","is_error":false}"#;
    assert_eq!(
        parse(Runtime::ClaudeCode, out),
        Err(TranscriptError::Runtime("error_max_turns".into()))
    );
}

#[test]
fn claude_subagent_tool_calls_are_not_main_agent_events() {
    let out = r#"{"type":"assistant","parent_tool_use_id":"toolu_1","message":{"content":[{"type":"tool_use","name":"Skill","input":{"skill":"cook"}}]}}
{"type":"assistant","parent_tool_use_id":null,"message":{"content":[{"type":"tool_use","name":"Bash","input":{}}]}}
{"type":"result","subtype":"success","is_error":false,"result":"ok"}"#;
    let t = parse(Runtime::ClaudeCode, out).expect("parses");
    assert_eq!(t.events, vec![tool("Bash", "{}")]);
}

#[test]
fn codex_commands_that_only_mention_a_skill_path_are_not_loads() {
    let item = |cmd: &str, exit: i64| {
        format!(
            "{{\"type\":\"item.completed\",\"item\":{{\"type\":\"command_execution\",\"command\":{},\"exit_code\":{exit}}}}}\n{{\"type\":\"turn.completed\"}}",
            serde_json::to_string(cmd).expect("json")
        )
    };
    for (cmd, exit) in [
        ("rg foo .agents/skills/*/SKILL.md", 0),
        ("find . -path 'my-skills/cook/SKILL.md'", 0),
        ("cat .agents/skills/cook/SKILL.md", 1),
    ] {
        let t = parse(Runtime::Codex, &item(cmd, exit)).expect("parses");
        assert_eq!(t.events, vec![tool("shell", cmd)], "{cmd}");
    }
    let t = parse(Runtime::Codex, &item("cat 'skills/cook/SKILL.md'", 0)).expect("parses");
    assert_eq!(t.events, vec![Event::SkillLoad("cook".into())]);
}

fn tool(name: &str, input: &str) -> Event {
    Event::Tool {
        name: name.into(),
        input: input.into(),
    }
}
