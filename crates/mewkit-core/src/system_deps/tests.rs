use super::*;

#[test]
fn inline_and_block_declarations_are_read() {
    let inline = "# t\n<!--\nMEOWKIT METADATA v1:\n  optional_system_deps: [playwright-chromium, ffmpeg]\n-->\n";
    assert_eq!(
        parse_optional_system_deps_from_skill_md(inline),
        ["playwright-chromium", "ffmpeg"]
    );
    let block = "<!--\n MEOWKIT METADATA\n  optional_system_deps:\n    - a\n    - b\n-->";
    // The block form also picks up the comment's own `-->` as an entry; the npm
    // CLI's pattern does the same, and the unknown key is dropped on validation.
    assert_eq!(
        parse_optional_system_deps_from_skill_md(block),
        ["a", "b", "->"]
    );
    assert!(parse_optional_system_deps_from_skill_md("no comment").is_empty());
    assert!(parse_optional_system_deps_from_skill_md("<!--\nMEOWKIT METADATA\n-->").is_empty());
}

#[test]
fn unknown_keys_are_warned_about_and_dropped() {
    let mut warnings = Vec::new();
    let (valid, invalid) = validate_skill_declared_keys(
        &["ffmpeg".to_string(), "rm-rf".to_string()],
        "demo",
        &mut |w| warnings.push(w.to_string()),
    );
    assert_eq!(
        (valid, invalid),
        (vec!["ffmpeg".to_string()], vec!["rm-rf".to_string()])
    );
    assert!(
        warnings[0].starts_with("[mewkit] Skill \"demo\" declares unknown system dep \"rm-rf\"")
    );
}

#[test]
fn imagemagick_counts_as_present_under_either_binary_name() {
    let dep = get_dep("imagemagick").unwrap();
    assert!(is_dep_command_present(dep, &|c| c == "magick"));
    assert!(!is_dep_command_present(dep, &|c| c == "ffmpeg"));
}

#[test]
fn only_windows_uses_backslash_paths() {
    let dep = get_dep("playwright-chromium").unwrap();
    assert!(dep.install_commands("win32")[0].contains('\\'));
    assert!(!dep.install_commands("linux")[0].contains('\\'));
    assert!(dep.install_commands("freebsd").is_empty());
}
