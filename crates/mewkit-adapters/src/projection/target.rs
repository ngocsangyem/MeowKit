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

/// Grok as the only reader of `.grok/skills`.
///
/// Grok scans `.grok/hooks/*.json` for hook files and `.grok/agents/` for
/// subagent types, so the kit's own scripts, rubrics and agent prompts sit in
/// `.grok/meowkit/`, a folder Grok does not read
/// (https://docs.x.ai/build/features/hooks, https://docs.x.ai/build/features/subagents).
pub const GROK: Target = Target {
    skills_root: ".grok/skills",
    skill_prefix: "mk-",
    // "/<skill-name>": https://docs.x.ai/build/features/skills-plugins-marketplaces
    invocation: Invocation::Sigil("/"),
    host_dir: ".grok/meowkit",
    host_name: "Grok",
    host_word: "grok",
    context_file: "AGENTS.md",
    agent_ext: "md",
    plugin_data_var: "PLUGIN_DATA",
    project_root_expr: "$(git rev-parse --show-toplevel)",
    rule_sections: CODEX.rule_sections,
    paths: &[
        (
            ".claude/hooks/lib/skill-python.cjs",
            ".grok/meowkit/scripts/skill-python.cjs",
        ),
        (".claude/hooks/lib/setup-workflow", "mewkit setup"),
        // Libraries the hooks also load stay beside the hooks.
        (
            ".claude/hooks/lib/project-root.cjs",
            ".grok/meowkit/hooks/lib/project-root.cjs",
        ),
        (
            ".claude/hooks/lib/validate-content.cjs",
            ".grok/meowkit/hooks/lib/validate-content.cjs",
        ),
        (".claude/hooks/lib/", ".grok/meowkit/scripts/bin/"),
    ],
    // The vendor pages name no model per tier and no agent file format, so an
    // agent prompt is installed without a model.
    model_pins: &[],
    router: CODEX.router,
};

/// The skills root Codex, Pi and OMP all read, written once for whichever of
/// them are installed: no invocation sigil and no product name, and the files
/// the skill text names by path in `.agents/meowkit/`, a folder none of the
/// three loads.
pub const SHARED: Target = Target {
    skills_root: ".agents/skills",
    skill_prefix: "mk-",
    invocation: Invocation::Prose,
    host_dir: ".agents/meowkit",
    host_name: "this runtime",
    host_word: "agent",
    context_file: "AGENTS.md",
    agent_ext: "md",
    plugin_data_var: "PLUGIN_DATA",
    project_root_expr: "$(git rev-parse --show-toplevel)",
    rule_sections: CODEX.rule_sections,
    paths: &[
        (
            ".claude/hooks/lib/skill-python.cjs",
            ".agents/meowkit/scripts/skill-python.cjs",
        ),
        (".claude/hooks/lib/setup-workflow", "mewkit setup"),
        // Libraries the guard also loads stay beside it.
        (
            ".claude/hooks/lib/project-root.cjs",
            ".agents/meowkit/hooks/lib/project-root.cjs",
        ),
        (
            ".claude/hooks/lib/validate-content.cjs",
            ".agents/meowkit/hooks/lib/validate-content.cjs",
        ),
        (".claude/hooks/lib/", ".agents/meowkit/scripts/bin/"),
    ],
    // Agent prompts here are files a skill reads, not agent definitions.
    model_pins: &[],
    router: CODEX.router,
};

/// Pi as the only reader of `.agents/skills`.
pub const PI: Target = Target {
    // "`/skill:name` forces loading":
    // https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/docs/skills.md
    invocation: Invocation::Sigil("/skill:"),
    host_name: "Pi",
    host_word: "pi",
    ..SHARED
};

/// OMP as the only reader of `.agents/skills`.
pub const OMP: Target = Target {
    // "Parsed `/skill:<name>` invocation": @oh-my-pi/pi-coding-agent 18.13.3
    // src/extensibility/skills.ts:764
    invocation: Invocation::Sigil("/skill:"),
    host_name: "OMP",
    host_word: "omp",
    ..SHARED
};
