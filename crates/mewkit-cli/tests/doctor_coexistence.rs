//! `mewkit doctor`'s coexistence, weakened-check and guard-integrity rows.
//!
//! Every fixture here is a redirected home (see `support::temp_home`): the rows
//! read the user's agents, rules, skills and settings, so a test that inherited
//! the developer's real `HOME` would both report their machine and risk writing
//! into it.
//!
//! The rows are also the first in `doctor --json` whose `detail` anyone asserts,
//! so the shape of a row is checked here too: `name`, `status`, `detail`, and
//! never the status `fail`.
mod support;

use std::path::Path;
use std::time::{Duration, Instant};

use serde_json::Value;
use support::temp_home::{TempHome, installed};
use support::{code, text, write};

const OUTWARD: [&str; 5] = [
    "coexistence: agent names",
    "coexistence: foreign hooks",
    "coexistence: instruction files",
    "coexistence: skill listing",
    "coexistence: cross-runtime load",
];
const WEAKENED: &str = "checks: weakened";
const INTEGRITY: &str = "guards: integrity";
/// A secret shaped like one, placed where another toolkit would leave it.
const TOKEN: &str = "sk-live-DOCTOR-MUST-NOT-PRINT-THIS";
/// Long enough for a `doctor` run on a slow machine, short enough that a hook
/// file this command is blocked on fails the test instead of the suite.
const PROMPTLY: Duration = Duration::from_secs(90);

fn rows(out: &std::process::Output) -> Vec<Value> {
    assert_eq!(code(out), 0, "doctor exits 0 on warnings: {}", text(out));
    serde_json::from_slice::<Value>(&out.stdout)
        .unwrap_or_else(|e| panic!("{e}: {}", text(out)))
        .as_array()
        .expect("an array of rows")
        .clone()
}

fn row<'a>(rows: &'a [Value], name: &str) -> &'a Value {
    rows.iter()
        .find(|r| r["name"] == name)
        .unwrap_or_else(|| panic!("no row {name}: {rows:#?}"))
}

fn status(rows: &[Value], name: &str) -> String {
    row(rows, name)["status"]
        .as_str()
        .expect("a status string")
        .to_owned()
}

fn detail(rows: &[Value], name: &str) -> String {
    row(rows, name)["detail"]
        .as_str()
        .expect("a detail string")
        .to_owned()
}

/// Every row carries exactly the three documented keys, and none of the rows
/// this file owns can fail a run.
fn assert_shape(rows: &[Value]) {
    for r in rows {
        let keys: Vec<&str> = r
            .as_object()
            .expect("an object")
            .keys()
            .map(String::as_str)
            .collect();
        assert_eq!(keys, ["name", "status", "detail"], "row shape: {r}");
    }
    for name in OUTWARD.iter().chain([&WEAKENED, &INTEGRITY]) {
        assert_ne!(status(rows, name), "fail", "{name} never fails");
    }
}

/// A skill directory whose frontmatter costs `padding` characters of description.
fn skill(root: &Path, rel: &str, name: &str, padding: usize) {
    write(
        root,
        &format!("{rel}/SKILL.md"),
        &format!(
            "---\nname: {name}\ndescription: {}\n---\nbody\n",
            "d".repeat(padding)
        ),
    );
}

/// `doctor`'s rows, failing rather than hanging when it does not come back.
///
/// Every other helper here would wait forever: a named pipe or an endless file
/// where a settings file belongs used to block the command with no output, and
/// a test that waits on that is indistinguishable from a slow suite. This one
/// kills the process and says what it was blocked on.
fn rows_within(env: &TempHome, args: &[&str], cwd: Option<&Path>) -> Vec<Value> {
    let captured = tempfile::NamedTempFile::new().expect("a capture file");
    let mut command = env.command(env!("CARGO_BIN_EXE_mewkit"));
    command.args(args).stdout(
        captured
            .as_file()
            .try_clone()
            .expect("a handle on the capture file"),
    );
    if let Some(cwd) = cwd {
        command.current_dir(cwd);
    }
    let mut child = command.spawn().expect("spawn mewkit");
    let deadline = Instant::now() + PROMPTLY;
    loop {
        match child.try_wait().expect("wait for mewkit") {
            Some(status) => {
                assert!(status.success(), "doctor exited {status}");
                break;
            }
            None if Instant::now() >= deadline => {
                let _ = child.kill();
                panic!("doctor did not finish within {PROMPTLY:?}: it is blocked on a host file");
            }
            None => std::thread::sleep(Duration::from_millis(50)),
        }
    }
    let text = std::fs::read_to_string(captured.path()).expect("doctor's output");
    serde_json::from_str::<Value>(&text)
        .unwrap_or_else(|e| panic!("{e}: {text}"))
        .as_array()
        .expect("an array of rows")
        .clone()
}

#[test]
fn a_clean_install_alone_on_the_machine_has_nothing_to_report() {
    let env = installed("claude-code");
    let found = rows(&env.mewkit(&["doctor", "--json", "--target", "claude-code"]));
    assert_shape(&found);
    for name in OUTWARD.iter().chain([&WEAKENED, &INTEGRITY]) {
        assert_eq!(status(&found, name), "ok", "{name}: {found:#?}");
    }
    assert!(
        detail(&found, INTEGRITY).contains("match the bytes recorded at install"),
        "{found:#?}"
    );
}

/// A second toolkit in the user-global tree: colliding agent names, its own
/// rules and instruction file, its own skills in the shared listing, and a hook
/// of its own on an event MeowKit uses. Its settings carry a token, which the
/// report must not carry.
#[test]
fn a_second_toolkit_in_the_home_directory_shows_up_in_every_outward_row() {
    let env = installed("claude-code");
    let (home, project) = (env.home(), env.project());
    let mine: Vec<String> = std::fs::read_dir(project.join(".claude/agents"))
        .expect("the kit's agents")
        .flatten()
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().into_owned();
            name.ends_with(".md").then_some(name)
        })
        .take(2)
        .collect();
    assert_eq!(mine.len(), 2, "the kit ships agents to collide with");
    for name in &mine {
        write(&home, &format!(".claude/agents/{name}"), "theirs\n");
    }
    write(&home, ".claude/CLAUDE.md", "their standing instructions\n");
    write(&home, ".claude/rules/core-behaviors.md", "their rule\n");
    // Enough skills to pass the shared listing's threshold on their own.
    for n in 0..100 {
        skill(&home, &format!(".claude/skills/theirs-{n}"), "theirs", 400);
    }
    // The command puts the secret in an inline assignment ahead of the program,
    // which is where one is actually found and the one shape a "first word that
    // looks like a file" rule picks up and prints.
    write(
        &home,
        ".claude/settings.json",
        &format!(
            r#"{{"env": {{"THEIR_TOKEN": "{TOKEN}"}},
              "hooks": {{"PreToolUse": [{{"matcher": "Bash", "hooks": [
                {{"type": "command",
                  "command": "env JIRA_TOKEN={TOKEN}.v2.9 node /opt/theirs/hooks/their-guard.js"}}]}}]}}}}"#
        ),
    );

    let out = env.mewkit(&["doctor", "--json", "--target", "claude-code"]);
    let found = rows(&out);
    assert_shape(&found);
    for name in OUTWARD.iter().take(4) {
        assert_eq!(status(&found, name), "warn", "{name}: {found:#?}");
    }
    let names = detail(&found, "coexistence: agent names");
    let stem = mine[0].trim_end_matches(".md");
    assert!(names.contains(stem), "{names}");
    assert!(
        detail(&found, "coexistence: foreign hooks").contains("PreToolUse their-guard.js"),
        "{found:#?}"
    );
    assert!(
        detail(&found, "coexistence: instruction files").contains("core-behaviors.md"),
        "{found:#?}"
    );

    let printed = text(&out);
    assert!(
        !printed.contains(TOKEN),
        "a token another toolkit left in its settings reached the report"
    );
    assert!(
        !printed.contains("their standing instructions"),
        "no file body beyond frontmatter is read"
    );
}

/// The ways a check can be installed and still not run. Each is set on its own,
/// because the row has to name the one that is responsible.
#[test]
fn an_observer_toggle_a_hook_profile_and_a_host_setting_each_weaken_the_checks() {
    let env = installed("claude-code");
    let project = env.project();
    let args = ["doctor", "--json", "--target", "claude-code"];

    write(
        &project,
        ".meowkit/config.yaml",
        "hooks:\n  post-write: false\n",
    );
    let found = rows(&env.mewkit(&args));
    assert_shape(&found);
    assert_eq!(status(&found, WEAKENED), "warn", "{found:#?}");
    assert!(
        detail(&found, WEAKENED).contains("hooks.post-write is off in the project config"),
        "{found:#?}"
    );

    std::fs::remove_file(project.join(".meowkit/config.yaml")).expect("remove the config");
    let out = env
        .command(env!("CARGO_BIN_EXE_mewkit"))
        .args(args)
        .env("MEOWKIT_HOOK_PROFILE", "fast")
        .output()
        .expect("spawn mewkit");
    let found = rows(&out);
    assert_eq!(status(&found, WEAKENED), "warn", "{found:#?}");
    assert!(
        detail(&found, WEAKENED).contains("MEOWKIT_HOOK_PROFILE=fast"),
        "{found:#?}"
    );

    let out = env
        .command(env!("CARGO_BIN_EXE_mewkit"))
        .args(args)
        .env("MEWKIT_CURSOR_HOOKS_KILL_SWITCH", "1")
        .output()
        .expect("spawn mewkit");
    assert!(
        detail(&rows(&out), WEAKENED).contains("MEWKIT_CURSOR_HOOKS_KILL_SWITCH"),
        "the Cursor kill switch is read from the environment"
    );

    let settings = project.join(".claude/settings.json");
    let mut doc: Value =
        serde_json::from_str(&std::fs::read_to_string(&settings).expect("settings")).expect("json");
    doc["disableAllHooks"] = Value::Bool(true);
    std::fs::write(&settings, doc.to_string()).expect("write settings");
    let found = rows(&env.mewkit(&args));
    assert_eq!(status(&found, WEAKENED), "warn", "{found:#?}");
    assert!(
        detail(&found, WEAKENED).contains("disableAllHooks"),
        "{found:#?}"
    );
}

/// One project carrying the kit for Cursor and for Claude Code: Cursor loads
/// both trees, so the install collides with itself.
#[test]
fn a_project_installed_for_two_runtimes_loads_one_of_them_twice() {
    let env = installed("claude-code,cursor");
    let found = rows(&env.mewkit(&["doctor", "--json"]));
    assert_shape(&found);
    let cross = "coexistence: cross-runtime load";
    assert_eq!(status(&found, cross), "warn", "{found:#?}");
    let said = detail(&found, cross);
    assert!(said.contains("cursor: "), "{said}");
    assert!(said.contains("skills also from .claude/skills"), "{said}");
    assert!(
        said.contains("hooks also from .claude/settings.json"),
        "{said}"
    );
    assert_eq!(status(&found, "kit copies: unrecorded"), "ok", "{found:#?}");
}

/// All six runtimes installed cleanly is not a failure: what loads twice is
/// reported with the setting that stops it, OMP's import of `.claude/` is
/// switched off by the install and so is not listed, and a name the user put
/// under two roots is information. A copy of a kit skill that no install
/// recorded, under a second root a runtime reads, fails the run.
#[test]
fn an_unrecorded_copy_of_a_kit_skill_fails_and_a_clean_full_set_does_not() {
    let env = installed("all");
    let project = env.project();
    skill(&project, ".agents/skills/mine", "mine", 4);
    skill(&project, ".pi/skills/mine", "mine", 4);
    let found = rows(&env.mewkit(&["doctor", "--json"]));
    assert_shape(&found);
    let cross = "coexistence: cross-runtime load";
    let said = detail(&found, cross);
    assert_eq!(status(&found, cross), "warn", "{said}");
    assert!(said.contains("GROK_CLAUDE_HOOKS_ENABLED=false"), "{said}");
    assert!(!said.contains("omp: "), "{said}");
    assert!(said.contains("one name under two roots"), "{said}");
    assert!(said.contains("mine (skills)"), "{said}");
    assert_eq!(status(&found, "kit copies: unrecorded"), "ok", "{found:#?}");

    // A second root that is a link to the first shows the same skills, not copies.
    #[cfg(unix)]
    {
        std::fs::remove_dir_all(project.join(".pi/skills")).expect("remove");
        std::os::unix::fs::symlink("../.agents/skills", project.join(".pi/skills")).expect("link");
        let found = rows(&env.mewkit(&["doctor", "--json"]));
        assert_eq!(status(&found, "kit copies: unrecorded"), "ok", "{found:#?}");
        std::fs::remove_file(project.join(".pi/skills")).expect("unlink");
    }

    let copy = std::fs::read_to_string(project.join(".agents/skills/mk-cook/SKILL.md"))
        .expect("an installed skill");
    write(&project, ".pi/skills/mk-cook/SKILL.md", &copy);
    let out = env.mewkit(&["doctor", "--json"]);
    assert_eq!(code(&out), 1, "{}", text(&out));
    let found: Vec<Value> = serde_json::from_slice::<Value>(&out.stdout)
        .expect("json")
        .as_array()
        .expect("rows")
        .clone();
    assert_eq!(status(&found, "kit copies: unrecorded"), "fail");
    assert!(
        detail(&found, "kit copies: unrecorded").contains(".pi/skills/mk-cook"),
        "{found:#?}"
    );
}

/// No home directory is one scope fewer to read, not a failure; and a guard file
/// edited after install is a warning on its own row.
#[test]
fn an_unreadable_home_is_reported_and_an_edited_guard_is_flagged() {
    let env = installed("claude-code");
    let args = ["doctor", "--json", "--target", "claude-code"];
    let out = env
        .command(env!("CARGO_BIN_EXE_mewkit"))
        .args(args)
        .env_remove("HOME")
        .env_remove("USERPROFILE")
        .output()
        .expect("spawn mewkit");
    let found = rows(&out);
    assert_shape(&found);
    assert_eq!(status(&found, "coexistence: agent names"), "ok");
    assert!(
        detail(&found, "coexistence: agent names").contains("only one scope could be read"),
        "{found:#?}"
    );

    let guard = env.project().join(".claude/hooks/privacy-block.cjs");
    let mut bytes = std::fs::read(&guard).expect("the privacy guard");
    bytes.extend_from_slice(b"\n// changed after install\n");
    std::fs::write(&guard, bytes).expect("write the guard");
    let found = rows(&env.mewkit(&args));
    assert_eq!(status(&found, INTEGRITY), "warn", "{found:#?}");
    assert!(
        detail(&found, INTEGRITY).contains(".claude/hooks/privacy-block.cjs"),
        "{found:#?}"
    );
}

/// The caps, on a project with no install at all: a symlink is not followed out
/// of the directory it sits in, and a frontmatter block too long to reach counts
/// as unread rather than as free.
#[test]
fn a_symlink_is_not_followed_and_an_unreachable_frontmatter_block_is_counted_as_unread() {
    let env = TempHome::new();
    let (home, project) = (env.home(), env.project());
    let outside = project.join("outside");
    write(&outside, "borrowed.md", "theirs\n");
    write(&project, ".claude/agents/shared.md", "mine\n");
    write(&home, ".claude/agents/shared.md", "theirs\n");
    write(&home, ".claude/agents/borrowed.md", "theirs\n");
    #[cfg(unix)]
    std::os::unix::fs::symlink(
        outside.join("borrowed.md"),
        project.join(".claude/agents/borrowed.md"),
    )
    .expect("a symlinked agent");

    skill(&project, ".claude/skills/small", "small", 10);
    skill(&project, ".claude/skills/big", "big", 8 * 1024);

    let found = rows(&env.mewkit(&["doctor", "--json", "--target", "claude-code"]));
    assert_shape(&found);
    let names = detail(&found, "coexistence: agent names");
    assert!(names.contains("shared"), "{names}");
    #[cfg(unix)]
    assert!(
        !names.contains("borrowed"),
        "a symlinked entry is not read through: {names}"
    );
    let listing = detail(&found, "coexistence: skill listing");
    assert!(listing.contains("2 skills"), "{listing}");
    assert!(
        listing.contains("1 with no frontmatter block this read could reach"),
        "{listing}"
    );
    assert!(
        listing.contains("offering 15 characters"),
        "only the block that fits is counted: {listing}"
    );
}

/// A host configuration file that cannot be read as one must not be read as
/// one. A named pipe at `~/.claude/settings.json` blocks the first process that
/// opens it, forever and silently; a symlink to an endless file is the same bug
/// wearing a shape that fools a size check made on the link.
#[test]
fn a_named_pipe_or_an_oversized_settings_file_is_reported_rather_than_opened() {
    let env = TempHome::new();
    let home = env.home();
    std::fs::create_dir_all(home.join(".claude")).expect("the claude dir");
    std::fs::create_dir_all(home.join(".codex")).expect("the codex dir");

    #[cfg(unix)]
    {
        let fifo = home.join(".claude/settings.json");
        let made = std::process::Command::new("mkfifo")
            .arg(&fifo)
            .status()
            .expect("run mkfifo");
        assert!(made.success(), "mkfifo failed");
    }
    // A symlink IS followed for a host config file, because a settings file in
    // a dotfile repository normally is one — so the cap has to hold on the
    // target's bytes, not on the link's.
    let huge = home.join("endless.toml");
    std::fs::write(&huge, vec![b'#'; 2 * 1024 * 1024]).expect("a file past the cap");
    #[cfg(unix)]
    std::os::unix::fs::symlink(&huge, home.join(".codex/config.toml")).expect("a symlinked config");
    #[cfg(not(unix))]
    std::fs::copy(&huge, home.join(".codex/config.toml")).expect("a config past the cap");

    let found = rows_within(&env, &["doctor", "--json"], None);
    assert_shape(&found);
    let said = detail(&found, WEAKENED);
    assert!(
        said.contains("could not read") && said.contains("past the size cap"),
        "the row says it looked and could not tell: {found:#?}"
    );
    assert!(
        said.contains(".codex/config.toml"),
        "a symlink to a file past the cap is named: {said}"
    );
    #[cfg(unix)]
    assert!(
        said.contains(".claude/settings.json"),
        "the named pipe is named: {said}"
    );
}

/// A project opened in the home directory is one tree, not two scopes. Reading
/// it as two makes every name collide with itself, which is a warning about
/// nothing.
#[test]
fn a_project_that_is_the_home_directory_is_one_scope_not_two() {
    let env = TempHome::new();
    let home = env.home();
    write(&home, ".claude/agents/alpha.md", "mine\n");
    write(&home, ".claude/rules/core-behaviors.md", "mine\n");
    skill(&home, ".claude/skills/alpha", "alpha", 10);

    let found = rows_within(
        &env,
        &["doctor", "--json", "--target", "claude-code"],
        Some(&home),
    );
    assert_shape(&found);
    let names = detail(&found, "coexistence: agent names");
    assert_eq!(status(&found, "coexistence: agent names"), "ok", "{names}");
    assert!(
        names.starts_with("1 agent definitions"),
        "the one tree is counted once: {names}"
    );
    let listing = detail(&found, "coexistence: skill listing");
    assert!(listing.contains("1 skill,"), "{listing}");
    assert_eq!(
        status(&found, "coexistence: instruction files"),
        "warn",
        "a rule nothing installed is still a second source: {found:#?}"
    );
    assert!(
        !detail(&found, "coexistence: instruction files").contains("both scopes"),
        "one tree has no two scopes to share a name across: {found:#?}"
    );
}

/// Past the directory cap the counts are a floor, and a row that printed them
/// as a total would be wrong in the one case where the number is the point.
#[test]
fn a_skills_directory_past_the_cap_says_its_counts_are_a_floor() {
    let env = TempHome::new();
    let project = env.project();
    for n in 0..205 {
        skill(&project, &format!(".claude/skills/many-{n:04}"), "many", 10);
    }
    let found = rows(&env.mewkit(&["doctor", "--json", "--target", "claude-code"]));
    assert_shape(&found);
    let listing = detail(&found, "coexistence: skill listing");
    assert!(listing.contains("200 skills"), "the cap holds: {listing}");
    assert!(
        listing.contains("these counts are a floor"),
        "the row admits the cap: {listing}"
    );
}

/// The optional host profile parses and names every file a guard is made of.
#[test]
fn the_host_guard_profile_example_parses_and_names_the_guard_paths() {
    let repo = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join(".meowkit")
        .join("host-guard-profile.example.json");
    let text = std::fs::read_to_string(&repo).unwrap_or_else(|e| panic!("{}: {e}", repo.display()));
    let doc: Value = serde_json::from_str(&text).expect("the profile is JSON");
    let deny = doc["permissions"]["deny"].to_string();
    let sandbox = doc["sandbox"]["filesystem"]["denyWrite"].to_string();
    for path in [
        ".claude/hooks",
        ".claude/settings.json",
        ".codex/hooks",
        ".codex/hooks.json",
        ".codex/config.toml",
        ".cursor/hooks",
        ".cursor/hooks.json",
        ".meowkit/state/ownership",
    ] {
        assert!(deny.contains(path), "deny rules miss {path}");
        assert!(sandbox.contains(path), "sandbox write denies miss {path}");
    }
    assert_eq!(doc["sandbox"]["enabled"], Value::Bool(true));
    assert!(
        doc["_about"]["limits"]
            .to_string()
            .contains("not a security boundary"),
        "the profile says what a deny rule cannot do"
    );
}
