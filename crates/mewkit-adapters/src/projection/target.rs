//! Per-runtime projection settings. Every value is what that runtime's
//! documentation or installed layout names; see
//! `docs/maintainer/host-probe-log.md` for the rows behind them.
use super::{Invocation, Target};

/// Codex as the only reader of `.agents/skills`.
pub const CODEX: Target = Target {
    skills_root: ".agents/skills",
    skill_prefix: "mk-",
    invocation: Invocation::Sigil("$"),
    host_dir: ".codex",
    host_name: "Codex",
    host_word: "codex",
    context_file: "AGENTS.md",
    agent_ext: "toml",
    plugin_data_var: "PLUGIN_DATA",
    project_root_expr: "$(git rev-parse --show-toplevel)",
    rule_sections: &[
        ("injection-rules.md", "Data & injection boundary"),
        ("security-rules.md", "Security"),
        ("core-behaviors.md", "Core behaviors"),
        ("development-rules.md", "Development"),
        ("meowkit-core.md", "Planning, review and the ship check"),
        ("agent-conduct.md", "Subagent status protocol"),
    ],
    paths: &[
        (
            ".claude/hooks/lib/skill-python.cjs",
            ".codex/scripts/skill-python.cjs",
        ),
        (".claude/hooks/lib/setup-workflow", "mewkit setup"),
        // Libraries the hooks also load stay beside the hooks.
        (
            ".claude/hooks/lib/project-root.cjs",
            ".codex/hooks/lib/project-root.cjs",
        ),
        (
            ".claude/hooks/lib/validate-content.cjs",
            ".codex/hooks/lib/validate-content.cjs",
        ),
        (".claude/hooks/lib/", ".codex/scripts/bin/"),
    ],
    // The tier mapping in `docs/maintainer/model-pins.md`.
    model_pins: &[
        ("haiku", "gpt-6-luna"),
        ("sonnet", "gpt-6.1-sol"),
        ("opus", "gpt-6-astra"),
        ("fable", "gpt-6-astra"),
    ],
    router: Some("main session"),
};

/// Cursor as the only reader of `.cursor/skills`.
pub const CURSOR: Target = Target {
    skills_root: ".cursor/skills",
    skill_prefix: "mk-",
    invocation: Invocation::Sigil("/"),
    host_dir: ".cursor",
    host_name: "Cursor",
    host_word: "cursor",
    context_file: "AGENTS.md",
    agent_ext: "md",
    plugin_data_var: "PLUGIN_DATA",
    project_root_expr: "$(git rev-parse --show-toplevel)",
    rule_sections: CODEX.rule_sections,
    paths: &[
        (
            ".claude/hooks/lib/skill-python.cjs",
            ".cursor/scripts/skill-python.cjs",
        ),
        (".claude/hooks/lib/setup-workflow", "mewkit setup"),
        // Libraries the hooks also load stay beside the hooks.
        (
            ".claude/hooks/lib/project-root.cjs",
            ".cursor/hooks/lib/project-root.cjs",
        ),
        (
            ".claude/hooks/lib/validate-content.cjs",
            ".cursor/hooks/lib/validate-content.cjs",
        ),
        (".claude/hooks/lib/", ".cursor/scripts/bin/"),
    ],
    model_pins: &[
        ("haiku", "composer-2.5[fast=true]"),
        ("sonnet", "composer-2.5[fast=true]"),
        ("opus", "claude-opus-5[effort=high]"),
        ("fable", "claude-fable-5"),
    ],
    router: CODEX.router,
};
