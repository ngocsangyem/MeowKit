//! `task new` — scaffold one task FILE, and optionally activate durable state.
//!
//! The two halves are deliberately independent: the scaffolded file is a human
//! document, while `--activate` commits a durable record plus the canonical
//! pointer. A failed activation is reported as a failure of ACTIVATION and
//! exits non-zero — it never leaves the caller believing a task is active.
use std::path::{Path, PathBuf};

use crate::schema::task_record::normalize_task_id;
use crate::task_store::{ActivateTask, ActivationFailure, activate_task, now_iso_millis};
use crate::trace::{TraceRecord, append_trace_record};

use super::discovery::{find_project_root, find_tasks_dir, read_template};
use super::naming::{TASK_TYPES, TaskType, to_kebab, today_iso, today_yymmdd};
use super::output::TaskOutput;

/// What `task new` was asked to create.
#[derive(Debug, Default)]
pub struct NewTask<'a> {
    pub task_type: Option<&'a str>,
    pub priority: Option<&'a str>,
    pub description: &'a str,
    /// Durably activate no-plan work: an active record plus a canonical
    /// pointer keyed by task id.
    pub activate: bool,
    pub cli_version: Option<&'a str>,
}

/// Create the file, and the durable record when asked.
///
/// The return type carries BOTH streams because the two halves can disagree: a
/// scaffolded file is reported on stdout the moment it exists, and a failed
/// activation afterwards is a refusal on stderr with a non-zero exit. Collapsing
/// that into one `Result` swallowed the "Created" line the npm CLI had already
/// printed, which is a difference a user would see.
pub fn new_task(cwd: &Path, args: &NewTask<'_>) -> TaskOutput {
    let type_name = args.task_type.unwrap_or("feature");
    let Some(task_type) = TaskType::from_name(type_name) else {
        return TaskOutput::refused(format!(
            "Invalid --type \"{type_name}\". Must be one of: {}\n",
            TASK_TYPES.join(", ")
        ));
    };
    let description = args.description.trim();
    if description.is_empty() {
        return TaskOutput::refused(
            "Description is required. Usage: meowkit task new [--type feature] \"description\"\n"
                .to_string(),
        );
    }

    // `tasks/active/` is created under the working directory when no ancestor
    // has one: the first task in a project should not need a scaffold step.
    let active_dir = match find_tasks_dir(cwd) {
        Some(dir) => dir,
        None => {
            let dir = cwd.join("tasks").join("active");
            if let Err(e) = std::fs::create_dir_all(&dir) {
                return TaskOutput::refused(format!("Fatal: {e}\n"));
            }
            dir
        }
    };

    let slug = to_kebab(description);
    let suffix = task_type.suffix();
    let dest = active_dir.join(format!("{}-{slug}.{suffix}.md", today_yymmdd()));
    if dest.exists() {
        return TaskOutput::refused(format!("File already exists: {}\n", dest.display()));
    }

    let body = template_body(task_type, cwd, description);
    let document = format!(
        "{}{body}",
        frontmatter(
            description,
            task_type,
            args.priority.unwrap_or("medium"),
            &slug
        )
    );
    if let Err(e) = std::fs::write(&dest, document) {
        return TaskOutput::refused(format!("Fatal: {e}\n"));
    }

    let mut out = TaskOutput::ok(format!("\n  ✓ Created: {}\n\n", dest.display()));
    if args.activate {
        match activate(cwd, &slug, args.cli_version) {
            Ok(text) => out.stdout.push_str(&text),
            Err(refusal) => {
                out.stderr = refusal;
                out.failed = true;
            }
        }
    }
    out
}

/// The frontmatter block, with the values filled in.
fn frontmatter(description: &str, task_type: TaskType, priority: &str, slug: &str) -> String {
    [
        "---".to_string(),
        format!("title: \"{description}\""),
        format!("type: {}", task_type.as_str()),
        "status: draft".to_string(),
        "phase: 1".to_string(),
        format!("priority: {priority}"),
        "effort: medium".to_string(),
        format!("created: {}", today_iso()),
        format!("branch: {}/{slug}", task_type.suffix()),
        "agent: \"\"".to_string(),
        "---".to_string(),
        String::new(),
    ]
    .join("\n")
}

/// A project template's body when it has one, else the built-in stub.
fn template_body(task_type: TaskType, cwd: &Path, description: &str) -> String {
    let project_root: PathBuf = find_project_root(cwd);
    match read_template(task_type, &project_root) {
        // Strip the template's own frontmatter and keep its body, so the filled
        // values above are the only ones in the file.
        Some(template) => strip_frontmatter(&template),
        None => format!(
            "\n# {description}\n\n<!-- Fill in sections from the template -->\n\n\
             ## Agent State\n\nCurrent phase: 1 — Planning\nLast action: Task file created\n\
             Next action: Get Gate 1 approval before writing any tests or code\n\
             Blockers: none\nDecisions made: none yet\n"
        ),
    }
}

/// Everything after a leading `---` fenced block, or the whole text when it has
/// none. Mirrors `/^---\n[\s\S]*?\n---\n([\s\S]*)/`.
fn strip_frontmatter(template: &str) -> String {
    let after = template
        .strip_prefix("---\n")
        .and_then(|rest| rest.find("\n---\n").map(|end| &rest[end + 5..]));
    after.unwrap_or(template).to_string()
}

/// Durable no-plan activation: the record and the canonical pointer, committed
/// as one operation from the caller's view.
fn activate(cwd: &Path, slug: &str, cli_version: Option<&str>) -> Result<String, String> {
    let task_id = normalize_task_id(slug);
    let outcome = activate_task(
        cwd,
        &ActivateTask {
            task_id: &task_id,
            now: &now_iso_millis(),
            cli_version,
            next_action: Some("begin work"),
            ..ActivateTask::default()
        },
    );
    match outcome {
        Ok(_) => {}
        // A record that was never written is a plain failure of the command:
        // the activation report below would send the operator looking for a
        // partial record that does not exist.
        Err(ActivationFailure::Record(e)) => return Err(format!("Fatal: {e}\n")),
        Err(ActivationFailure::Pointer(err)) => {
            let recovery = if err.rolled_back {
                "    The partial record was rolled back.".to_string()
            } else {
                format!(
                    "    A partial record may remain at tasks/active/{}.json — \
                     inspect before retrying.",
                    err.task_id
                )
            };
            return Err(format!(
                "  ✗ Activation FAILED for task {} — NOT active.\n{recovery}\n    cause: {}\n",
                err.task_id, err.message
            ));
        }
    }

    let mut out =
        format!("  ✓ Activated task {task_id} (no-plan) → tasks/active/{task_id}.json\n\n");
    // Advisory: the durable state is already committed, so a failed trace
    // append is reported and the command still succeeds.
    let mut data = serde_json::Map::new();
    data.insert("status".into(), "active".into());
    data.insert("trigger".into(), "task-new".into());
    if let Err(e) = append_trace_record(
        cwd,
        &TraceRecord {
            event: "task_transition".to_string(),
            data,
            task_id: Some(task_id.clone()),
            ..TraceRecord::default()
        },
    ) {
        out.push_str(&format!(
            "  ⚠ activated, but transition trace emission failed: {e}\n"
        ));
    }
    Ok(out)
}
