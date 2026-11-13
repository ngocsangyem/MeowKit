//! How the capability surface reaches each host provider, the four
//! independent support levels per provider, and how a provider acquires
//! repo-context evidence.
//!
//! Trusted constants backed by adapter evidence: `enforceable` is claimed only
//! where the host really guarantees the behaviour (a real gating hook), never
//! where only prompt compliance exists. A provider without a tested projection
//! is `report-only` with every level `unknown`.
use serde_json::{Value, json};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Projection {
    pub provider: String,
    pub status: &'static str,
    pub bootstrap_placement: &'static str,
    /// discoverable, selectable, invocable, enforceable — in that order.
    pub levels: [&'static str; 4],
    pub evidence: &'static str,
}

impl Projection {
    pub fn to_json(&self) -> Value {
        let [d, s, i, e] = self.levels;
        json!({
            "provider": self.provider,
            "status": self.status,
            "bootstrapPlacement": self.bootstrap_placement,
            "levels": {"discoverable": d, "selectable": s, "invocable": i, "enforceable": e},
            "evidence": self.evidence,
        })
    }
}

/// Providers the projection inspection can enumerate, in table order.
pub const PROJECTION_PROVIDERS: [&str; 4] = ["claude-code", "claude-plugin", "codex", "qwen"];

fn authored(provider: &str) -> Option<Projection> {
    let p = |status, placement, levels, evidence| Projection {
        provider: provider.to_string(),
        status,
        bootstrap_placement: placement,
        levels,
        evidence,
    };
    Some(match provider {
        "claude-code" => p(
            "supported",
            "sessionstart-hook",
            ["supported", "supported", "supported", "supported"],
            "Bootstrap on a SessionStart hook; host invokes skills/agents; real hooks gate behavior (enforceable).",
        ),
        "claude-plugin" => p(
            "supported",
            "sessionstart-hook-via-plugin-build",
            ["supported", "supported", "supported", "supported"],
            "Same SessionStart hook, propagated into the plugin payload at plugin generation; plugin hooks gate behavior.",
        ),
        "codex" => p(
            "partial",
            "instruction-file",
            ["supported", "supported", "advisory", "unsupported"],
            "Migration writes a bounded AGENTS bootstrap plus validated .codex/capabilities.json; skill/command projection is advisory and hook enforcement version-gated ⇒ not enforceable.",
        ),
        // Enumerable for inspection, but no capability behaviour is claimed.
        "qwen" => p(
            "report-only",
            "none",
            ["unknown", "unknown", "unknown", "unknown"],
            "No tested projection — report-only; no capability behavior is claimed until a qwen adapter is authored.",
        ),
        _ => return None,
    })
}

/// The projection for a provider, or a report-only fallback that claims nothing.
pub fn get_projection(provider: &str) -> Projection {
    authored(provider).unwrap_or_else(|| Projection {
        provider: provider.to_string(),
        status: "report-only",
        bootstrap_placement: "none",
        levels: ["unknown"; 4],
        evidence: "No tested projection for this provider — report-only; no capability behavior is claimed.",
    })
}

/// True when the provider has an authored bootstrap placement: present and
/// not report-only.
pub fn is_projected_provider(provider: &str) -> bool {
    authored(provider).is_some_and(|p| p.status != "report-only")
}

/// A host-native tool the agent invokes to acquire evidence.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AcquisitionTool {
    pub tool: &'static str,
    pub note: &'static str,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Acquisition {
    pub provider: String,
    pub status: &'static str,
    pub read: Option<AcquisitionTool>,
    pub search: Option<AcquisitionTool>,
    pub evidence: &'static str,
}

fn tool_json(tool: &Option<AcquisitionTool>) -> Value {
    tool.as_ref()
        .map_or(Value::Null, |t| json!({"tool": t.tool, "note": t.note}))
}

impl Acquisition {
    pub fn to_json(&self) -> Value {
        json!({
            "provider": self.provider,
            "status": self.status,
            "read": tool_json(&self.read),
            "search": tool_json(&self.search),
            "evidence": self.evidence,
        })
    }
}

/// The acquisition descriptor for a provider, or a report-only fallback.
pub fn get_acquisition(provider: &str) -> Acquisition {
    let t = |tool, note| Some(AcquisitionTool { tool, note });
    let mk = |status, read, search, evidence| Acquisition {
        provider: provider.to_string(),
        status,
        read,
        search,
        evidence,
    };
    match provider {
        "claude-code" => mk(
            "supported",
            t("Read", "typed host-native file read"),
            t(
                "Grep+Glob",
                "typed content search (Grep) + filename search (Glob)",
            ),
            "Claude Code exposes typed Read/Grep/Glob tools the agent invokes to acquire evidence; MeowKit records the resulting envelope.",
        ),
        "claude-plugin" => mk(
            "supported",
            t(
                "Read",
                "typed host-native file read (same Claude Code host)",
            ),
            t(
                "Grep+Glob",
                "typed content + filename search (same Claude Code host)",
            ),
            "The plugin runs in the Claude Code host — identical typed Read/Grep/Glob acquisition surface.",
        ),
        "codex" => mk(
            "partial",
            t(
                "shell:cat",
                "shell-mediated read — no typed read tool (advisory)",
            ),
            t(
                "shell:ripgrep",
                "shell-mediated search — no typed search tool (advisory)",
            ),
            "Codex acquires via its shell (cat/ripgrep), not a typed tool contract; acquisition works but is shell-mediated (advisory) ⇒ partial.",
        ),
        _ => mk(
            "report-only",
            None,
            None,
            "No tested acquisition surface for this provider — report-only; the orchestrator relies on host-provided paths only.",
        ),
    }
}
