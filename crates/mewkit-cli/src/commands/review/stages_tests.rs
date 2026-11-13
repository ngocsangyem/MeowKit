use super::minimist_number;

#[test]
fn minimist_reads_the_numeric_positionals_it_coerces() {
    // These arrive as JavaScript numbers, which is what makes a bare PR
    // number crash the npm CLI's target parser.
    for (token, expected) in [
        ("7", 7.0),
        ("007", 7.0),
        ("+7", 7.0),
        ("1.5", 1.5),
        (".5", 0.5),
        ("1e3", 1000.0),
        ("0x1f", 31.0),
        ("0X1F", 31.0),
    ] {
        assert_eq!(minimist_number(token), Some(expected), "{token}");
    }
}

#[test]
fn anything_a_path_or_url_could_be_stays_a_string() {
    for token in [
        "",
        "#7",
        "acme/widget#7",
        "https://github.com/acme/widget/pull/7",
        "diff.patch",
        "7a",
        "1E3",
        "0x",
        "1.2.3",
    ] {
        assert_eq!(minimist_number(token), None, "{token}");
    }
}
