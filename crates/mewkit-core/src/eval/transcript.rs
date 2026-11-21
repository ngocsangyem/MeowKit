//! Turn a runtime's headless JSON-lines output into the few events grading needs.
//!
//! Claude Code (`claude -p --output-format stream-json --verbose`) loads a
//! skill through a `Skill` tool call. Codex (`codex exec --json`) has no such
//! tool: it reads the skill's `SKILL.md` with a shell command, so a load is a
//! `command_execution` whose command names `skills/<name>/SKILL.md`.
//!
//! A transcript that never reached its final result is an error, not a failed
//! case: the runner retries it and keeps it out of every rate.

use std::sync::LazyLock;

use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Runtime {
    ClaudeCode,
    Codex,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Event {
    /// A skill was loaded; the name is normalised by [`normalize_skill`].
    SkillLoad(String),
    /// Any other tool call: the tool name (`shell` for a Codex command) and its
    /// input as a JSON string (the command text for a Codex command, empty when
    /// the runtime reports none).
    Tool { name: String, input: String },
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct Transcript {
    pub events: Vec<Event>,
    pub final_text: String,
    /// Skills the runtime listed at start, when it reports them (Claude Code).
    pub listed_skills: Option<Vec<String>>,
    /// What the run cost, when the runtime reports it (Claude Code).
    pub cost_usd: Option<f64>,
    /// Input plus output tokens, when the runtime reports them (Codex).
    pub tokens: Option<u64>,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum TranscriptError {
    #[error("line {line} is not JSON")]
    NotJson { line: usize },
    #[error("the run ended without a final result")]
    NoResult,
    #[error("the runtime reported an error: {0}")]
    Runtime(String),
}

/// `mk:cook`, `mk-cook` and `plugin:cook` all name the kit skill `cook`.
pub fn normalize_skill(raw: &str) -> String {
    let after_ns = raw.rsplit(':').next().unwrap_or(raw);
    after_ns.strip_prefix("mk-").unwrap_or(after_ns).to_owned()
}

/// `skills/<name>/SKILL.md` as a whole path component (`.agents/skills/…`,
/// not `my-skills/…`), with a literal name (no glob).
static CODEX_SKILL_READ: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"(?:^|[\s'"/])skills/([A-Za-z0-9._:-]+)/SKILL\.md"#).expect("static pattern")
});

pub fn parse(runtime: Runtime, output: &str) -> Result<Transcript, TranscriptError> {
    let mut t = Transcript::default();
    let mut finished = false;
    for (i, line) in output.lines().enumerate() {
        if line.trim().is_empty() {
            continue;
        }
        let v: Value =
            serde_json::from_str(line).map_err(|_| TranscriptError::NotJson { line: i + 1 })?;
        let done = match runtime {
            Runtime::ClaudeCode => claude_line(&v, &mut t)?,
            Runtime::Codex => codex_line(&v, &mut t)?,
        };
        finished |= done;
    }
    if finished {
        Ok(t)
    } else {
        Err(TranscriptError::NoResult)
    }
}

fn str_at<'a>(v: &'a Value, key: &str) -> &'a str {
    v.get(key).and_then(Value::as_str).unwrap_or("")
}

/// Returns true on the final `result` line.
fn claude_line(v: &Value, t: &mut Transcript) -> Result<bool, TranscriptError> {
    match str_at(v, "type") {
        "system" if str_at(v, "subtype") == "init" => {
            t.listed_skills = v.get("skills").and_then(Value::as_array).map(|a| {
                a.iter()
                    .filter_map(Value::as_str)
                    .map(normalize_skill)
                    .collect()
            });
        }
        // A subagent's messages carry `parent_tool_use_id`; grading is about
        // the main agent's own decisions, so they are left out.
        "assistant" if v.get("parent_tool_use_id").is_none_or(Value::is_null) => {
            let content = v.pointer("/message/content").and_then(Value::as_array);
            for block in content.into_iter().flatten() {
                if str_at(block, "type") != "tool_use" {
                    continue;
                }
                let name = str_at(block, "name");
                let skill = block.pointer("/input/skill").and_then(Value::as_str);
                t.events.push(match (name, skill) {
                    ("Skill", Some(s)) => Event::SkillLoad(normalize_skill(s)),
                    _ => Event::Tool {
                        name: name.to_owned(),
                        input: block.get("input").map(Value::to_string).unwrap_or_default(),
                    },
                });
            }
        }
        "result" => {
            t.final_text = str_at(v, "result").to_owned();
            t.cost_usd = v.get("total_cost_usd").and_then(Value::as_f64);
            // `error_max_turns` and friends are failures to finish, even when
            // `is_error` is false.
            let subtype = str_at(v, "subtype");
            let failed = v.get("is_error").and_then(Value::as_bool) == Some(true)
                || !(subtype.is_empty() || subtype == "success");
            if failed {
                let msg = if t.final_text.is_empty() {
                    subtype
                } else {
                    &t.final_text
                };
                return Err(TranscriptError::Runtime(msg.to_owned()));
            }
            return Ok(true);
        }
        _ => {}
    }
    Ok(false)
}

/// Returns true on `turn.completed`.
fn codex_line(v: &Value, t: &mut Transcript) -> Result<bool, TranscriptError> {
    match str_at(v, "type") {
        "item.completed" => {
            let item = v.get("item").unwrap_or(&Value::Null);
            match str_at(item, "type") {
                "agent_message" => t.final_text = str_at(item, "text").to_owned(),
                "command_execution" => {
                    // A command that failed read nothing, whatever it names.
                    let failed = item
                        .get("exit_code")
                        .and_then(Value::as_i64)
                        .is_some_and(|c| c != 0);
                    let command = str_at(item, "command");
                    let loads: Vec<Event> = if failed {
                        Vec::new()
                    } else {
                        CODEX_SKILL_READ
                            .captures_iter(command)
                            .map(|c| Event::SkillLoad(normalize_skill(&c[1])))
                            .collect()
                    };
                    if loads.is_empty() {
                        t.events.push(Event::Tool {
                            name: "shell".into(),
                            input: command.to_owned(),
                        });
                    } else {
                        t.events.extend(loads);
                    }
                }
                "reasoning" | "" => {}
                other => t.events.push(Event::Tool {
                    name: other.to_owned(),
                    input: String::new(),
                }),
            }
        }
        "turn.completed" => {
            let used = |k: &str| v.pointer(&format!("/usage/{k}")).and_then(Value::as_u64);
            t.tokens = match (used("input_tokens"), used("output_tokens")) {
                (None, None) => None,
                (i, o) => Some(i.unwrap_or(0) + o.unwrap_or(0)),
            };
            return Ok(true);
        }
        "turn.failed" | "error" => {
            let msg = v
                .pointer("/error/message")
                .or_else(|| v.get("message"))
                .and_then(Value::as_str)
                .unwrap_or("unknown error");
            return Err(TranscriptError::Runtime(msg.to_owned()));
        }
        _ => {}
    }
    Ok(false)
}
