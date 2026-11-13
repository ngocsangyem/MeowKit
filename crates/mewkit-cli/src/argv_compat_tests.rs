use clap::{Arg, ArgAction, Command};

use super::normalise;

/// A stand-in for the real CLI: `orient` with booleans and a `--no-record`
/// pair, `note` with one positional and a value flag, `plan` with sub-verbs.
fn cli() -> Command {
    let flag = |name: &'static str| Arg::new(name).long(name).action(ArgAction::SetTrue);
    Command::new("mewkit-next")
        .subcommand(
            Command::new("orient")
                .arg(flag("json"))
                .arg(flag("record"))
                .arg(flag("no-record")),
        )
        .subcommand(
            Command::new("note")
                .arg(Arg::new("store"))
                .arg(Arg::new("type").long("type").action(ArgAction::Append))
                .arg(flag("yes")),
        )
        .subcommand(
            Command::new("plan")
                .subcommand(Command::new("approve").arg(Arg::new("dir")))
                .subcommand(Command::new("status")),
        )
        .subcommand(Command::new("upgrade").arg(flag("json")))
}

fn run(args: &[&str]) -> Vec<String> {
    let mut argv = vec!["mewkit-next".to_string()];
    argv.extend(args.iter().map(|a| a.to_string()));
    normalise(argv, &cli())[1..].to_vec()
}

#[test]
fn a_verb_that_is_not_ported_passes_through_untouched() {
    assert_eq!(
        run(&["upgrade", "--bogus", "x"]),
        ["upgrade", "--bogus", "x"]
    );
}

#[test]
fn an_unknown_flag_and_the_value_minimist_gives_it_are_dropped() {
    assert_eq!(
        run(&["orient", "--bogus", "x", "--json"]),
        ["orient", "--json"]
    );
    // A following flag is not a value, so only the unknown flag goes.
    assert_eq!(run(&["orient", "--bogus", "--json"]), ["orient", "--json"]);
}

#[test]
fn a_global_string_flag_swallows_its_value_even_on_a_verb_that_ignores_it() {
    assert_eq!(
        run(&["orient", "--target", "json", "--json"]),
        ["orient", "--json"]
    );
}

#[test]
fn booleans_are_last_wins_and_read_typed_values() {
    assert_eq!(run(&["orient", "--json=yes"]), ["orient", "--json"]);
    assert_eq!(run(&["orient", "--json=false"]), ["orient"]);
    assert_eq!(run(&["orient", "--json", "--json=false"]), ["orient"]);
    assert_eq!(run(&["orient", "--json", "false"]), ["orient"]);
}

#[test]
fn no_prefix_turns_a_boolean_off_and_reaches_an_explicit_no_flag() {
    assert_eq!(
        run(&["orient", "--record", "--no-record"]),
        ["orient", "--no-record"]
    );
    assert_eq!(
        run(&["orient", "--no-record", "--record"]),
        ["orient", "--record"]
    );
    assert_eq!(
        run(&["orient", "--no-json", "--json"]),
        ["orient", "--json"]
    );
}

#[test]
fn extra_positionals_are_dropped_and_wanted_ones_kept() {
    assert_eq!(run(&["orient", "stray"]), ["orient"]);
    assert_eq!(run(&["note", "gotchas", "extra"]), ["note", "gotchas"]);
}

#[test]
fn a_repeated_value_flag_keeps_every_occurrence() {
    assert_eq!(
        run(&["note", "--type", "a", "--type=b"]),
        ["note", "--type=a", "--type=b"]
    );
}

#[test]
fn sub_verbs_are_followed_and_an_unknown_one_is_left_for_clap_to_name() {
    assert_eq!(
        run(&["plan", "approve", "dir", "more"]),
        ["plan", "approve", "dir"]
    );
    assert_eq!(run(&["plan", "nope"]), ["plan", "nope"]);
}

#[test]
fn short_aliases_map_through_the_catalogue_and_help_survives() {
    assert_eq!(run(&["note", "-y"]), ["note", "--yes"]);
    assert_eq!(run(&["orient", "-y"]), ["orient"]);
    assert_eq!(run(&["orient", "-h"]), ["orient", "--help"]);
    assert_eq!(run(&["orient", "--help"]), ["orient", "--help"]);
}

#[test]
fn everything_after_a_double_dash_is_kept_verbatim() {
    assert_eq!(run(&["note", "--", "--bogus"]), ["note", "--", "--bogus"]);
}

/// A `global = true` flag reaches its sub-verbs only once clap builds the
/// command, which is why `main.rs` builds the root before rewriting argv.
#[test]
fn a_global_flag_on_the_verb_is_kept_after_a_sub_verb() {
    let mut root = Command::new("mewkit-next").subcommand(
        Command::new("task-state")
            .arg(
                Arg::new("json")
                    .long("json")
                    .global(true)
                    .action(ArgAction::SetTrue),
            )
            .subcommand(Command::new("show").arg(Arg::new("id"))),
    );
    root.build();
    let argv = ["mewkit-next", "task-state", "show", "--json"]
        .map(String::from)
        .to_vec();
    assert_eq!(
        normalise(argv, &root)[1..],
        ["task-state", "show", "--json"]
    );
}

/// minimist does not care where a flag sits, so a flag written before its
/// sub-verb must reach that sub-verb, value and all.
#[test]
fn a_flag_before_its_sub_verb_still_reaches_it() {
    let mut root = Command::new("mewkit-next").subcommand(
        Command::new("plan").subcommand(
            Command::new("approve")
                .arg(Arg::new("dir"))
                .arg(Arg::new("by").long("by"))
                .arg(Arg::new("json").long("json").action(ArgAction::SetTrue)),
        ),
    );
    root.build();
    let argv = [
        "mewkit-next",
        "plan",
        "--by",
        "me",
        "--json",
        "approve",
        "d",
    ]
    .map(String::from)
    .to_vec();
    assert_eq!(
        normalise(argv, &root)[1..],
        ["plan", "approve", "d", "--by=me", "--json"]
    );
}
