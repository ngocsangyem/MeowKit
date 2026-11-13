//! The minimist flag table the Rust CLI carries must be the npm CLI's.
//!
//! `src/minimist_flags.rs` decides which unknown tokens swallow a value, so a
//! flag added to `CLI_CATALOGUE` and not to that file would make the two CLIs
//! read the same argv differently. This reads both and compares them.
use std::collections::BTreeSet;
use std::process::Command;

use crate::parity;

/// The quoted names inside `pub const <name>: &[&str] = &[ ... ];`.
fn rust_list(source: &str, name: &str) -> BTreeSet<String> {
    let start = source
        .find(&format!("pub const {name}"))
        .unwrap_or_else(|| panic!("{name} not found in minimist_flags.rs"));
    let body = &source[start..];
    let body = &body[body.find("&[").expect("list start") + 2..body.find("];").expect("list end")];
    body.split('"')
        .skip(1)
        .step_by(2)
        .map(str::to_string)
        .collect()
}

fn ts_list(dump: &str, line: usize) -> BTreeSet<String> {
    let text = dump.lines().nth(line).expect("node printed both lists");
    text.split(',')
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .collect()
}

#[test]
#[ignore = "needs node and the TS build"]
fn the_flag_table_matches_the_npm_catalogue() {
    let Some(pre) = parity::check("argv-table") else {
        return;
    };
    let catalogue = pre
        .ts_cli
        .with_file_name("cli")
        .join("command-catalogue.js");
    let script = "import(process.argv[1]).then(({ CLI_CATALOGUE: c }) => {\
        const of = (b) => [...new Set(c.flags.filter((f) => (f.type === 'boolean') === b)\
        .map((f) => f.name))].sort().join(',');\
        console.log(of(true)); console.log(of(false));\
        console.log(Object.entries(c.aliases).map(([s, l]) => s + '=' + l).sort().join(','));\
    })";
    let out = Command::new("node")
        .args(["-e", script, &catalogue.to_string_lossy()])
        .output()
        .expect("spawn node");
    assert!(
        out.status.success(),
        "{}",
        String::from_utf8_lossy(&out.stderr)
    );
    let dump = String::from_utf8_lossy(&out.stdout).into_owned();
    let source = std::fs::read_to_string(
        parity::repo_root().join("crates/mewkit-cli/src/minimist_flags.rs"),
    )
    .expect("read minimist_flags.rs");

    assert_eq!(rust_list(&source, "GLOBAL_BOOLEANS"), ts_list(&dump, 0));
    assert_eq!(rust_list(&source, "GLOBAL_STRINGS"), ts_list(&dump, 1));
    let aliases: BTreeSet<String> = ["h=help", "v=version", "y=yes"].map(String::from).into();
    assert_eq!(
        ts_list(&dump, 2),
        aliases,
        "update ALIASES in minimist_flags.rs"
    );
    assert!(source.contains("('h', \"help\"), ('v', \"version\"), ('y', \"yes\")"));
}
