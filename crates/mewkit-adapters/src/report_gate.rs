//! Post-plan check of the text an emitter is about to install: Claude-only
//! tokens in another runtime's output, and installed paths that text names
//! but the plan does not write. Findings are reported as plan notices.
use std::collections::BTreeSet;

use crate::contract::{Op, Plan};

/// Scan the text of every `WriteFile` and `MergeBlock` in `plan`.
/// `denied`: tokens that must not appear. `prefixes`: path prefixes of the
/// installed layout (e.g. `.agents/skills/`) whose references must resolve.
pub fn check(plan: &Plan, denied: &[&str], prefixes: &[&str]) -> Vec<String> {
    let written: BTreeSet<&str> = plan
        .ops
        .iter()
        .filter_map(|op| match op {
            Op::WriteFile { path, .. } => Some(path.as_str()),
            _ => None,
        })
        .collect();
    let mut notices = Vec::new();
    for op in &plan.ops {
        let (path, text) = match op {
            Op::WriteFile { path, bytes, .. } => match std::str::from_utf8(bytes) {
                Ok(t) => (path.as_str(), t),
                Err(_) => continue,
            },
            Op::MergeBlock { path, content, .. } => (path.as_str(), content.as_str()),
            _ => continue,
        };
        for (n, line) in text.lines().enumerate() {
            for token in denied.iter().filter(|t| line.contains(**t)) {
                notices.push(format!("denied token `{token}` at {path}:{}", n + 1));
            }
            for reference in references(line, prefixes) {
                if !resolves(reference, &written) {
                    notices.push(format!(
                        "dangling reference `{reference}` at {path}:{}",
                        n + 1
                    ));
                }
            }
        }
    }
    notices
}

/// Path-like tokens in `line` that start with one of `prefixes`, skipping
/// placeholders (`<name>`, `*`, `{…}`, `$VAR`).
fn references<'a>(line: &'a str, prefixes: &[&str]) -> Vec<&'a str> {
    let mut out = Vec::new();
    for prefix in prefixes {
        let mut from = 0;
        while let Some(i) = line[from..].find(prefix) {
            let start = from + i;
            // Only at a token boundary: `x.codex/` is not a reference.
            let boundary = line[..start].chars().next_back().is_none_or(|c| {
                !(c.is_alphanumeric() || c == '_' || c == '-' || c == '.' || c == '/')
            });
            let end = line[start..]
                .find(|c: char| c.is_whitespace() || "`'\"()[]<>,;|".contains(c))
                .map_or(line.len(), |j| start + j);
            let token = line[start..end].trim_end_matches(['.', ':', '!', '?']);
            if boundary
                && token.len() > prefix.len()
                && !token.contains(['*', '{', '$', '<'])
                && !token.ends_with("...")
            {
                out.push(token);
            }
            from = end.max(start + prefix.len());
        }
    }
    out
}

fn resolves(reference: &str, written: &BTreeSet<&str>) -> bool {
    let r = reference.trim_end_matches('/');
    written.contains(r)
        || written
            .range(format!("{r}/").as_str()..)
            .next()
            .is_some_and(|w| w.starts_with(&format!("{r}/")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::kit_files::rel;

    fn write(path: &str, text: &str) -> Op {
        Op::WriteFile {
            path: rel(path).unwrap(),
            bytes: text.as_bytes().to_vec(),
            mode: None,
        }
    }

    #[test]
    fn reports_denied_tokens_and_dangling_references_with_lines() {
        let plan = Plan {
            ops: vec![
                write(
                    ".agents/skills/a/SKILL.md",
                    "ok\nrun `node .agents/skills/a/scripts/x.cjs`\nsee .agents/skills/b/SKILL.md.\nedit CLAUDE.md",
                ),
                write(".agents/skills/a/scripts/x.cjs", ""),
                write(
                    ".codex/hooks/lib/core/p.cjs",
                    "require('.codex/hooks/lib/')",
                ),
            ],
            ..Plan::default()
        };
        let notices = check(&plan, &["CLAUDE.md"], &[".agents/skills/", ".codex/"]);
        assert_eq!(
            notices,
            [
                "dangling reference `.agents/skills/b/SKILL.md` at .agents/skills/a/SKILL.md:3",
                "denied token `CLAUDE.md` at .agents/skills/a/SKILL.md:4",
            ]
        );
    }

    #[test]
    fn skips_placeholders_and_non_boundaries() {
        let refs = references(
            "`.agents/skills/<name>/x` .agents/skills/*/y a.codex/z $HOME/.codex/c .agents/skills/",
            &[".agents/skills/", ".codex/"],
        );
        assert!(refs.is_empty(), "{refs:?}");
    }
}
