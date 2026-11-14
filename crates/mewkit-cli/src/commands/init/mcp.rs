//! Cursor MCP profiles for `init`: opt-in, merged into `.cursor/mcp.json`.
//!
//! Additive and optional, so every problem here is reported and the install
//! carries on without MCP rather than failing: a bad profile name must not
//! undo a Cursor install that otherwise worked.
use std::path::Path;
use std::process::{Command, Stdio};

use mewkit_adapters::contract::{Format, Kit, Op, RelPath};
use mewkit_adapters::cursor::BUNDLE;
use mewkit_core::mcp_profiles::{self, Catalog, Selection};

use crate::prompt::{Ask, Choice, Flag, PromptError, default_prompt};

pub struct Request<'a> {
    /// `--mcp-profiles` as typed; `None` when absent.
    pub flag: Option<&'a str>,
    pub allow_cloud: bool,
    /// The run is already interactive (the toolkit picker ran), so asking is fine.
    pub may_ask: bool,
    pub dry_run: bool,
}

#[derive(Default)]
pub struct Outcome {
    pub op: Option<Op>,
    pub notes: Vec<String>,
}

/// A project may run as a Cursor Cloud Agent when it has a git remote; MCP
/// tool calls there have no local hook enforcement. Best effort: no git, or
/// no remote, is not exposed.
pub fn cloud_exposed(root: &Path) -> bool {
    Command::new("git")
        .arg("remote")
        .current_dir(root)
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .is_ok_and(|o| o.status.success() && !String::from_utf8_lossy(&o.stdout).trim().is_empty())
}

pub fn plan(kit: &Kit, root: &Path, req: &Request<'_>) -> Outcome {
    let mut out = Outcome::default();
    let skipped = |why: &str| format!("MCP profile selection skipped: {why}");
    if req.dry_run {
        if req.flag.is_some_and(|f| !f.trim().is_empty()) {
            out.notes.push(
                "Dry-run: MCP profiles are never applied or prompted for during a dry-run.".into(),
            );
        }
        return out;
    }
    let bundle = BUNDLE.base(&kit.dir);
    let catalog = match mcp_profiles::load(&bundle) {
        Ok(c) => c,
        Err(e) => {
            out.notes.push(skipped(&e));
            return out;
        }
    };
    let selection = match (req.flag, req.may_ask, &catalog) {
        (Some(f), _, _) => Selection::parse(f),
        (None, true, Some(c)) if !c.profiles.is_empty() => ask_profiles(c),
        _ => return out,
    };
    if selection.is_empty() {
        return out;
    }
    let Some(catalog) = catalog else {
        out.notes.push(skipped(
            "no mcp-profiles.json catalog shipped in this bundle",
        ));
        return out;
    };
    let chosen = match catalog.resolve(&selection) {
        Ok(c) => c,
        Err(e) => {
            out.notes.push(skipped(&e));
            return out;
        }
    };
    let issues: Vec<String> = chosen
        .iter()
        .flat_map(|(n, p)| mcp_profiles::lint(n, p))
        .collect();
    if !issues.is_empty() {
        out.notes.push(skipped(&format!(
            "refusing to apply MCP profile(s) — secret-safety lint failed:\n{}",
            issues.join("\n")
        )));
        return out;
    }
    if cloud_exposed(root) && !req.allow_cloud && !(req.may_ask && confirm_cloud()) {
        out.notes.push(
            "MCP profile selection BLOCKED: this project may run as a Cursor Cloud Agent (a git remote is configured) \
             and beforeMCPExecution has no cloud enforcement equivalent. Re-run with --allow-cloud-mcp to accept the residual risk."
                .into(),
        );
        return out;
    }
    let existing = std::fs::read_to_string(root.join(".cursor").join("mcp.json")).ok();
    let merge = match mcp_profiles::plan_merge(existing.as_deref(), &chosen) {
        Ok(m) => m,
        Err(e) => {
            out.notes.push(skipped(&e));
            return out;
        }
    };
    let conflicts = if merge.conflicts.is_empty() {
        String::new()
    } else {
        format!(
            ", {} conflict(s) left untouched (your existing server config wins): {}",
            merge.conflicts.len(),
            merge.conflicts.join(", ")
        )
    };
    out.notes.push(format!(
        "Cursor MCP profile(s) merged into .cursor/mcp.json: {} server(s) added{conflicts}.",
        merge.added.len()
    ));
    if !merge.added.is_empty() {
        out.op = RelPath::new(".cursor/mcp.json")
            .ok()
            .map(|path| Op::MergeEntries {
                path,
                format: Format::Json,
                key: vec!["mcpServers".into()],
                entries: merge.added,
            });
    }
    out
}

/// Opt-in multiselect, nothing selected by default.
fn ask_profiles(catalog: &Catalog) -> Selection {
    let choices: Vec<Choice> = catalog
        .profiles
        .iter()
        .map(|(name, p)| {
            let c = Choice::plain(name);
            if p.description.is_empty() {
                c
            } else {
                c.with_hint(&p.description)
            }
        })
        .collect();
    let ask = Ask::new(
        "Select Cursor MCP profile(s) to enable (opt-in — default: none)",
        Flag::with_value("--mcp-profiles", "name,…|all"),
    );
    match default_prompt().multi_select(&ask, &choices) {
        Ok(names) => Selection::Names(names),
        Err(PromptError::Cancelled { .. } | PromptError::NoTerminal { .. }) | Err(_) => {
            Selection::Names(Vec::new())
        }
    }
}

fn confirm_cloud() -> bool {
    let ask = Ask::new(
        "This project has a git remote and may run as a Cursor Cloud Agent, where MCP tool calls have NO local hook \
         enforcement (beforeMCPExecution is not supported in Cloud Agents). Apply the selected MCP profile(s) anyway?",
        Flag::new("--allow-cloud-mcp"),
    );
    default_prompt().confirm(&ask, false).unwrap_or(false)
}
