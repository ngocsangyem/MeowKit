//! The verdict every fixture in `tests/config/fixtures/` must get.
//!
//! The corpus itself lives at the root of this repository and is shared with the
//! hand reader and the TypeScript CLI; the tables below are the Rust side's copy
//! of the EXPECTED map in `tests/config/rejections.test.ts`. The two are written
//! out by hand on purpose: a verdict that differs between them is the divergence
//! a shared corpus exists to catch, and it would be invisible if one side
//! derived its expectation from the other.
use mewkit_core::config::ConfigValue;

/// Fixture → the rule that must fire, by identifier. The same table as
/// `tests/config/rejections.test.ts`: a verdict that differs between the two is
/// the divergence the corpus exists to catch.
pub const REJECTED: &[(&str, &str)] = &[
    ("reject-secret-key.yaml", "secret-in-config"),
    ("reject-secret-value.yaml", "secret-in-config"),
    ("reject-absolute-path-posix.yaml", "absolute-path"),
    ("reject-absolute-path-windows.yaml", "absolute-path"),
    ("reject-gates-namespace.yaml", "forbidden-namespace"),
    ("reject-paths-namespace.yaml", "forbidden-namespace"),
    ("reject-unknown-key.yaml", "unknown-key"),
    ("reject-wrong-type.yaml", "wrong-type"),
    ("reject-not-in-enum.yaml", "not-in-enum"),
    ("reject-user-scope-only.yaml", "user-scope-only"),
    ("reject-state-only-key.yaml", "state-only-key"),
    ("reject-protected-gate-enforcement.yaml", "protected-hook"),
    ("reject-protected-privacy-block.yaml", "protected-hook"),
    ("reject-protected-pre-ship.yaml", "protected-hook"),
    ("reject-protected-gate2-check.yaml", "protected-hook"),
    ("reject-protected-check-careful.yaml", "protected-hook"),
    ("reject-protected-check-freeze.yaml", "protected-hook"),
    ("reject-protected-check-report-path.yaml", "protected-hook"),
    ("grammar-duplicate-key.yaml", "duplicate-key"),
    ("grammar-tab.yaml", "tab-indentation"),
    ("grammar-three-levels.yaml", "nesting-too-deep"),
    ("grammar-anchor.yaml", "anchor-not-supported"),
    ("grammar-array-of-maps.yaml", "sequence-not-supported"),
    ("grammar-block-scalar.yaml", "block-scalar-not-supported"),
    ("grammar-flow-map.yaml", "flow-collection-not-supported"),
    ("grammar-null-value.yaml", "null-not-supported"),
    ("grammar-float.yaml", "float-not-supported"),
    // A spelling a full YAML parser resolves and a hand reader cannot. Each is
    // refused rather than resolved, so neither reader has to guess at the
    // other's answer — the divergence these cover is a value, not a construct.
    ("grammar-boolean-titlecase.yaml", "bad-boolean-spelling"),
    ("grammar-boolean-uppercase.yaml", "bad-boolean-spelling"),
    ("grammar-signed-integer.yaml", "non-decimal-integer"),
    ("grammar-hex-integer.yaml", "non-decimal-integer"),
    ("grammar-octal-integer.yaml", "non-decimal-integer"),
    ("grammar-double-quote-escape.yaml", "escape-not-supported"),
    ("grammar-unterminated-quote.yaml", "unterminated-quote"),
    (
        "grammar-trailing-after-quote.yaml",
        "trailing-content-after-quote",
    ),
    ("grammar-dotted-key.yaml", "dotted-key"),
    // A tag is the one construct a full parser resolves and a hand reader reads
    // as text, so the two sides disagreed on the TYPE rather than on the
    // spelling: `!!bool true` was a boolean to one and the string "!!bool true"
    // to the other. Every tag family is refused by its leading `!`, before any
    // type is guessed.
    ("grammar-tag.yaml", "tag-not-supported"),
    ("grammar-tag-boolean-false.yaml", "tag-not-supported"),
    ("grammar-verbatim-tag.yaml", "tag-not-supported"),
    ("grammar-tag-custom.yaml", "tag-not-supported"),
    ("grammar-tag-integer.yaml", "tag-not-supported"),
    ("grammar-tag-nested-integer.yaml", "tag-not-supported"),
    ("grammar-tag-nested-boolean.yaml", "tag-not-supported"),
    ("grammar-tag-string.yaml", "tag-not-supported"),
];

/// Fixture → the keys it applies. An accepted file is not merely accepted: the
/// values are what the gate and the hooks then read, and a type read differently
/// on either side of the kit is the failure this corpus exists for.
pub fn accepted() -> Vec<(&'static str, Vec<(&'static str, ConfigValue)>)> {
    vec![
        (
            "accept-blank-lines.yaml",
            vec![
                ("tdd", ConfigValue::Bool(true)),
                ("budget.cap", ConfigValue::Int(5)),
            ],
        ),
        ("accept-bom.yaml", vec![("tdd", ConfigValue::Bool(true))]),
        (
            "accept-boolean.yaml",
            vec![("tdd", ConfigValue::Bool(true))],
        ),
        ("accept-comments-only.yaml", vec![]),
        (
            "accept-crlf.yaml",
            vec![
                ("tdd", ConfigValue::Bool(true)),
                ("budget.cap", ConfigValue::Int(7)),
            ],
        ),
        ("accept-empty.yaml", vec![]),
        (
            "accept-hook-toggle.yaml",
            vec![("hooks.learning-observer", ConfigValue::Bool(false))],
        ),
        (
            "accept-integer.yaml",
            vec![("budget.cap", ConfigValue::Int(50))],
        ),
        (
            "accept-negative-integer.yaml",
            vec![("projectContext.maxBytes", ConfigValue::Int(-1))],
        ),
        (
            "accept-quoted-string.yaml",
            vec![("autobuild.mode", ConfigValue::Str("LEAN".into()))],
        ),
        (
            "accept-schema-pointer.yaml",
            vec![
                (
                    "$schema",
                    ConfigValue::Str("https://meowkit.dev/schemas/config-v1.json".into()),
                ),
                ("tdd", ConfigValue::Bool(true)),
            ],
        ),
        (
            "accept-string.yaml",
            vec![("autobuild.mode", ConfigValue::Str("FULL".into()))],
        ),
        (
            "accept-trailing-comment.yaml",
            vec![("tdd", ConfigValue::Bool(true))],
        ),
        (
            "accept-two-levels.yaml",
            vec![
                ("tdd", ConfigValue::Bool(false)),
                ("budget.cap", ConfigValue::Int(100)),
                ("budget.warn", ConfigValue::Int(30)),
                ("budget.block", ConfigValue::Int(90)),
                ("workflow.telemetry", ConfigValue::Str("off".into())),
                ("workflow.proactive", ConfigValue::Bool(true)),
            ],
        ),
    ]
}
