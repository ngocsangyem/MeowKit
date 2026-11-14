//! Reading the `optional_system_deps` a skill declares in its `SKILL.md`.
use std::path::Path;
use std::sync::LazyLock;

use regex::Regex;

use super::get_dep;
use crate::js_regex::{self, is_js_whitespace};

static COMMENT: LazyLock<Regex> = LazyLock::new(|| {
    js_regex::compile(r"<!--\s*\n\s*MEOWKIT METADATA(?s:.*?)-->").expect("a valid pattern")
});
static INLINE: LazyLock<Regex> = LazyLock::new(|| {
    js_regex::compile(r"optional_system_deps:\s*\[([^\]]*)\]").expect("a valid pattern")
});
static BLOCK: LazyLock<Regex> = LazyLock::new(|| {
    js_regex::compile(r"optional_system_deps:\s*\n((?:\s*-\s*\S+\s*\n?)+)")
        .expect("a valid pattern")
});
static BULLET: LazyLock<Regex> =
    LazyLock::new(|| js_regex::compile(r"^\s*-\s*").expect("a valid pattern"));

fn trimmed(text: &str) -> &str {
    text.trim_matches(is_js_whitespace)
}

/// The keys listed in a `MEOWKIT METADATA` comment, inline (`[a, b]`) or as a
/// block of `- key` lines; empty when the comment or field is absent.
pub fn parse_optional_system_deps_from_skill_md(content: &str) -> Vec<String> {
    let Some(block) = COMMENT.find(content).map(|m| m.as_str()) else {
        return Vec::new();
    };
    if let Some(caps) = INLINE.captures(block) {
        return caps[1]
            .split(',')
            .map(trimmed)
            .filter(|s| !s.is_empty())
            .map(str::to_string)
            .collect();
    }
    if let Some(caps) = BLOCK.captures(block) {
        return caps[1]
            .split('\n')
            .map(|line| trimmed(&BULLET.replace(line, "")).to_string())
            .filter(|s| !s.is_empty())
            .collect();
    }
    Vec::new()
}

/// Split declared keys into registered ones and unknown ones; each unknown key
/// is reported through `warn`.
pub fn validate_skill_declared_keys(
    declared: &[String],
    skill: &str,
    warn: &mut dyn FnMut(&str),
) -> (Vec<String>, Vec<String>) {
    let (mut valid, mut invalid) = (Vec::new(), Vec::new());
    for key in declared {
        if get_dep(key).is_some() {
            valid.push(key.clone());
        } else {
            warn(&format!(
                "[mewkit] Skill \"{skill}\" declares unknown system dep \"{key}\" \u{2014} ignored. \
                 Register it in lib/system-deps-registry.ts to allow installation."
            ));
            invalid.push(key.clone());
        }
    }
    (valid, invalid)
}

/// Every valid key declared by any skill under `.claude/skills/`.
pub fn skill_declared_deps(project: &Path, warn: &mut dyn FnMut(&str)) -> Vec<String> {
    let skills = project.join(".claude").join("skills");
    let Ok(read) = std::fs::read_dir(&skills) else {
        return Vec::new();
    };
    let mut names: Vec<String> = read
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_ok_and(|t| t.is_dir()))
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .filter(|name| !name.starts_with('.') && skills.join(name).join("SKILL.md").exists())
        .collect();
    names.sort();
    let mut keys: Vec<String> = Vec::new();
    for name in names {
        let Ok(content) = std::fs::read_to_string(skills.join(&name).join("SKILL.md")) else {
            continue;
        };
        let declared = parse_optional_system_deps_from_skill_md(&content);
        if declared.is_empty() {
            continue;
        }
        let (valid, _) = validate_skill_declared_keys(&declared, &name, warn);
        for key in valid {
            if !keys.contains(&key) {
                keys.push(key);
            }
        }
    }
    keys
}
