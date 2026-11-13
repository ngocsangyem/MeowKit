use std::path::Path;

use super::*;

fn created(cwd: &Path) -> Vec<String> {
    let mut names: Vec<String> = std::fs::read_dir(cwd.join("tasks").join("active"))
        .unwrap()
        .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
        .collect();
    names.sort();
    names
}

#[test]
fn the_slug_keeps_only_slug_characters_and_collapses_runs() {
    assert_eq!(
        to_kebab("Add  user   authentication!"),
        "add-user-authentication"
    );
    assert_eq!(
        to_kebab("  Fix: null — session crash  "),
        "fix-null-session-crash"
    );
    assert_eq!(to_kebab("a - b"), "a-b");
    assert_eq!(to_kebab("日本語"), "");
    assert_eq!(to_kebab(&"x".repeat(80)).len(), 60);
}

/// The filename stamp is LOCAL and the frontmatter stamp is UTC — the npm CLI's
/// own split, reproduced here. The instant below is 2025-11-12T12:20Z, which is
/// still the 12th in UTC and already the 13th in Kiribati, so a stamp that
/// ignored the zone would be caught.
#[test]
fn the_two_stamps_are_the_shapes_the_file_name_and_the_frontmatter_use() {
    let instant = 1_762_950_000_000;
    assert_eq!(stamp_yymmdd(instant, "UTC"), "251112");
    assert_eq!(stamp_yymmdd(instant, "Asia/Ho_Chi_Minh"), "251112");
    assert_eq!(stamp_yymmdd(instant, "Pacific/Kiritimati"), "251113");
    assert_eq!(stamp_yymmdd(instant, "America/Los_Angeles"), "251112");
    // An unreadable zone is UTC, never a failure: a task must still be creatable.
    assert_eq!(stamp_yymmdd(instant, "Not/AZone"), "251112");
    assert_eq!(stamp_iso(instant), "2025-11-12");
}

/// The stamp the command actually uses is the SYSTEM zone's, which is what ties
/// `today_yymmdd` to the zone-taking function the case above pins.
///
/// A system whose zone has no IANA name (`/etc/localtime` as a hard link, say)
/// cannot be compared by name, so the shape is checked instead — the zone
/// behaviour is already proved above.
#[test]
fn the_filename_stamp_follows_the_system_zone() {
    let stamp = today_yymmdd();
    assert!(
        stamp.len() == 6 && stamp.bytes().all(|b| b.is_ascii_digit()),
        "the filename stamp must stay six digits: {stamp}"
    );
    if let Some(name) = jiff::tz::TimeZone::system().iana_name() {
        assert_eq!(stamp, stamp_yymmdd(crate::time_utc::now_millis(), name));
    }
}

#[test]
fn a_new_task_file_carries_the_filled_in_frontmatter() {
    let dir = tempfile::tempdir().unwrap();
    let out = new_task(
        dir.path(),
        &NewTask {
            task_type: Some("bug-fix"),
            priority: Some("high"),
            description: "Fix null session crash",
            ..NewTask::default()
        },
    );
    let name = format!("{}-fix-null-session-crash.bug.md", today_yymmdd());
    assert!(!out.failed, "{out:?}");
    let out = out.stdout;
    assert!(out.starts_with("\n  ✓ Created: "), "{out}");
    assert!(out.ends_with(&format!("{name}\n\n")), "{out}");
    assert_eq!(created(dir.path()), [name.as_str()]);

    let body =
        std::fs::read_to_string(dir.path().join("tasks").join("active").join(&name)).unwrap();
    assert!(body.starts_with("---\ntitle: \"Fix null session crash\"\ntype: bug-fix\n"));
    assert!(body.contains("\npriority: high\n"));
    assert!(body.contains(&format!("\ncreated: {}\n", today_iso())));
    assert!(body.contains("\nbranch: bug/fix-null-session-crash\n"));
    // No project template: the built-in stub body.
    assert!(body.contains("\n# Fix null session crash\n"));
    assert!(body.ends_with("Decisions made: none yet\n"));
}

#[test]
fn an_unknown_type_and_an_empty_description_are_refused() {
    let dir = tempfile::tempdir().unwrap();
    assert_eq!(
        new_task(
            dir.path(),
            &NewTask {
                task_type: Some("chore"),
                description: "x",
                ..NewTask::default()
            }
        ),
        TaskOutput::refused(
            "Invalid --type \"chore\". Must be one of: feature, bug-fix, refactor, security\n"
                .to_string()
        )
    );
    assert_eq!(
        new_task(
            dir.path(),
            &NewTask {
                description: "   ",
                ..NewTask::default()
            }
        ),
        TaskOutput::refused(
            "Description is required. Usage: meowkit task new [--type feature] \"description\"\n"
                .to_string()
        )
    );
    assert!(!dir.path().join("tasks").exists());
}

#[test]
fn an_existing_file_is_never_overwritten() {
    let dir = tempfile::tempdir().unwrap();
    let args = NewTask {
        description: "Add user authentication",
        ..NewTask::default()
    };
    assert!(!new_task(dir.path(), &args).failed);
    let again = new_task(dir.path(), &args);
    assert!(again.failed);
    let err = again.stderr;
    assert!(err.starts_with("File already exists: "), "{err}");
    assert_eq!(created(dir.path()).len(), 1);
}

#[test]
fn a_project_template_replaces_the_stub_body_without_its_own_frontmatter() {
    let dir = tempfile::tempdir().unwrap();
    let templates = dir.path().join("tasks").join("templates");
    std::fs::create_dir_all(&templates).unwrap();
    std::fs::write(
        templates.join("feature-implementation.md"),
        "---\ntitle: TEMPLATE\n---\n## Our Sections\n",
    )
    .unwrap();
    new_task(
        dir.path(),
        &NewTask {
            description: "Add user authentication",
            ..NewTask::default()
        },
    );
    let body = std::fs::read_to_string(dir.path().join("tasks").join("active").join(format!(
        "{}-add-user-authentication.feature.md",
        today_yymmdd()
    )))
    .unwrap();
    assert!(body.ends_with("---\n## Our Sections\n"), "{body}");
    assert!(!body.contains("TEMPLATE"), "{body}");
}

#[test]
fn activation_records_durable_state_beside_the_scaffolded_file() {
    let dir = tempfile::tempdir().unwrap();
    let out = new_task(
        dir.path(),
        &NewTask {
            description: "Add user authentication",
            activate: true,
            cli_version: Some("0.1.0"),
            ..NewTask::default()
        },
    );
    assert!(!out.failed, "{out:?}");
    assert!(
        out.stdout.contains(
            "  ✓ Activated task add-user-authentication (no-plan) → \
             tasks/active/add-user-authentication.json\n"
        ),
        "{out:?}"
    );
    let record = crate::task_store::read_task_record(dir.path(), "add-user-authentication")
        .unwrap()
        .unwrap();
    assert_eq!(record.next_action, "begin work");
    assert!(
        dir.path()
            .join(".meowkit")
            .join("state")
            .join("active-plan.json")
            .exists()
    );
}

#[test]
fn the_listing_answers_rather_than_fails_when_there_is_nothing_to_list() {
    let dir = tempfile::tempdir().unwrap();
    // A temp dir has no `tasks/` and no ancestor with one.
    assert_eq!(
        list_tasks(dir.path(), false, None).stdout,
        "\n  No tasks/ directory found. Run from a MeowKit project.\n\n"
    );
    std::fs::create_dir_all(dir.path().join("tasks").join("active")).unwrap();
    let empty = list_tasks(dir.path(), false, None).stdout;
    assert!(empty.starts_with("\n  No task files found in "), "{empty}");
}

/// The walk goes UP, so the verb works from a subdirectory the way `git` does,
/// and the printed path is relative to where the user actually is. The parity
/// cases cannot cover this — the harness runs both CLIs in the project root.
#[test]
fn a_subdirectory_finds_the_tree_above_it_and_prints_a_relative_path() {
    let dir = tempfile::tempdir().unwrap();
    let active = dir.path().join("tasks").join("active");
    std::fs::create_dir_all(&active).unwrap();
    std::fs::write(active.join("one.md"), "---\nstatus: draft\n---\n").unwrap();
    let sub = dir.path().join("packages").join("inner");
    std::fs::create_dir_all(&sub).unwrap();

    assert_eq!(find_tasks_dir(&sub), Some(active.clone()));
    assert_eq!(find_project_root(&sub), dir.path());
    let text = list_tasks(&sub, false, None).stdout;
    assert!(
        text.contains(&format!(
            "  ..{sep}..{sep}tasks{sep}active{sep}one.md",
            sep = std::path::MAIN_SEPARATOR
        )),
        "{text:?}"
    );
}

#[test]
fn the_table_pads_every_column_and_counts_the_rows() {
    let dir = tempfile::tempdir().unwrap();
    let active = dir.path().join("tasks").join("active");
    std::fs::create_dir_all(&active).unwrap();
    std::fs::write(
        active.join("one.md"),
        "---\ntitle: \"Port note\"\ntype: feature\nstatus: in-progress\npriority: high\n---\nbody",
    )
    .unwrap();
    let text = list_tasks(dir.path(), false, None).stdout;
    assert!(
        text.contains(
            "  Status      Type          Priority  Title                                     Path\n"
        ),
        "{text:?}"
    );
    assert!(
        text.contains(
            "  in-progress feature       high      Port note                                 "
        ),
        "{text:?}"
    );
    assert!(text.ends_with("\n  1 task found\n\n"), "{text:?}");

    // A filter that matches nothing says which status it looked for.
    assert_eq!(
        list_tasks(dir.path(), false, Some("done")).stdout,
        "\n  No tasks with status \"done\"\n\n"
    );
    // A file with no frontmatter falls back to unknown/medium and its basename.
    std::fs::write(active.join("bare.md"), "no frontmatter").unwrap();
    let text = list_tasks(dir.path(), false, Some("unknown")).stdout;
    assert!(
        text.contains("  unknown     unknown       medium    bare"),
        "{text:?}"
    );
    assert!(text.ends_with("\n  1 task found\n\n"), "{text:?}");
}

#[test]
fn the_all_scan_reaches_outside_the_active_directory() {
    let dir = tempfile::tempdir().unwrap();
    let done = dir.path().join("tasks").join("done");
    std::fs::create_dir_all(dir.path().join("tasks").join("active")).unwrap();
    std::fs::create_dir_all(&done).unwrap();
    std::fs::write(done.join("old.md"), "---\nstatus: done\n---\n").unwrap();
    assert!(
        list_tasks(dir.path(), false, None)
            .stdout
            .starts_with("\n  No task files found in ")
    );
    let all = list_tasks(dir.path(), true, None).stdout;
    assert!(all.contains("  done "), "{all:?}");
}

#[test]
fn frontmatter_is_read_line_wise_with_one_pair_of_quotes_stripped() {
    let front = parse_frontmatter("---\ntitle: \"A: colon\"\nstatus: draft\nnoise\n---\nbody");
    assert_eq!(front.title.as_deref(), Some("A: colon"));
    assert_eq!(front.status.as_deref(), Some("draft"));
    assert_eq!(front.priority, None);
    // No fence, no frontmatter — and a fence that never closes is not one.
    assert_eq!(parse_frontmatter("# plain"), TaskFrontmatter::default());
    assert_eq!(
        parse_frontmatter("---\ntitle: x\n"),
        TaskFrontmatter::default()
    );
}
