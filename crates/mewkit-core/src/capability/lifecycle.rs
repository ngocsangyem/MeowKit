//! Per-provider lifecycle-event mappings: for each of the nine portable
//! events, whether a provider fires it and, separately, whether a handler can
//! GATE (deny or block) on it.
//!
//! These are trusted constants and must never over-claim: `gate` is true only
//! where a runtime hook proof exists. A version-gated or observe-only event is
//! `advisory` / `gate: false`, never asserted as enforceable.
use serde_json::{Map, Value, json};

/// The nine portable lifecycle events, host-neutral names.
pub const LIFECYCLE_EVENTS: [&str; 9] = [
    "session_start",
    "pre_tool",
    "post_tool",
    "tool_failure",
    "prompt_submitted",
    "stop",
    "pre_compaction",
    "subagent_start",
    "subagent_stop",
];

/// The deny-capable events that carry security and privacy enforcement.
pub const SECURITY_ENFORCEMENT_EVENTS: [&str; 3] = ["pre_tool", "prompt_submitted", "stop"];

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LifecycleSupport {
    pub status: &'static str,
    pub gate: bool,
    pub evidence: String,
    /// In-repo artifact that demonstrates the deny; set wherever `gate` is true.
    pub proof: Option<&'static str>,
}

impl LifecycleSupport {
    pub fn to_json(&self) -> Value {
        let mut m = Map::new();
        m.insert("status".into(), self.status.into());
        m.insert("gate".into(), self.gate.into());
        m.insert("evidence".into(), self.evidence.clone().into());
        if let Some(proof) = self.proof {
            m.insert("proof".into(), proof.into());
        }
        Value::Object(m)
    }
}

/// An event with its support, in `LIFECYCLE_EVENTS` order.
pub type LifecycleMap = Vec<(&'static str, LifecycleSupport)>;

fn s(status: &'static str, gate: bool, evidence: &str) -> LifecycleSupport {
    LifecycleSupport {
        status,
        gate,
        evidence: evidence.to_string(),
        proof: None,
    }
}

fn gated(evidence: &str, proof: &'static str) -> LifecycleSupport {
    LifecycleSupport {
        proof: Some(proof),
        ..s("supported", true, evidence)
    }
}

fn claude_code() -> LifecycleMap {
    vec![
        (
            "session_start",
            s(
                "supported",
                false,
                "SessionStart hook in shipped settings.json (observe/inject)",
            ),
        ),
        (
            "pre_tool",
            gated(
                "PreToolUse hook denies a tool call via exit 2 / permissionDecision:deny",
                "src/__tests__/hooks/gate-enforcement.integration.test.ts",
            ),
        ),
        (
            "post_tool",
            s(
                "supported",
                false,
                "PostToolUse hook in shipped settings.json (observe)",
            ),
        ),
        (
            "tool_failure",
            s(
                "supported",
                false,
                "PostToolUseFailure hook in shipped settings.json (observe)",
            ),
        ),
        (
            "prompt_submitted",
            s(
                "supported",
                false,
                "UserPromptSubmit block is a documented host capability, but no shipped hook blocks there (handlers are inject-only) — no in-repo proof",
            ),
        ),
        (
            "stop",
            gated(
                "Stop hook can block the stop (pre-completion-check security-BLOCK, exit 2)",
                "tests/hooks/completion-gate.test.ts",
            ),
        ),
        (
            "pre_compaction",
            s(
                "supported",
                false,
                "PreCompact hook in shipped settings.json (observe)",
            ),
        ),
        (
            "subagent_start",
            s(
                "supported",
                false,
                "Host capability, documented in the Claude Code hooks reference (retrieved 2026-11-09): fires once per subagent spawn/resume, cannot block, context-injection only. This kit registers NO handler — settings.json's SubagentStart array is deliberately empty — so there is no in-repo proof and none is claimed",
            ),
        ),
        (
            "subagent_stop",
            s(
                "supported",
                false,
                "SubagentStop hook in shipped settings.json (observe)",
            ),
        ),
    ]
}

fn claude_plugin() -> LifecycleMap {
    let mut map = claude_code();
    map[0].1 = s(
        "supported",
        false,
        "SessionStart hook propagated into the plugin payload during plugin generation (observe/inject)",
    );
    map
}

const CODEX_VERSION_NOTE: &str = "codex hooks are version-gated (CODEX_MIN_SUPPORTED_VERSION 0.142); deny needs a runtime version probe";

fn codex() -> LifecycleMap {
    vec![
        (
            "session_start",
            s(
                "supported",
                false,
                "codex SessionStart (capability table 0.142)",
            ),
        ),
        (
            "pre_tool",
            s(
                "advisory",
                false,
                &format!("codex PreToolUse deny documented but {CODEX_VERSION_NOTE}"),
            ),
        ),
        (
            "post_tool",
            s(
                "supported",
                false,
                "codex PostToolUse (capability table 0.142, observe)",
            ),
        ),
        (
            "tool_failure",
            s("unsupported", false, "codex exposes no tool-failure event"),
        ),
        (
            "prompt_submitted",
            s(
                "supported",
                false,
                "codex UserPromptSubmit (capability table 0.142)",
            ),
        ),
        (
            "stop",
            s(
                "supported",
                false,
                "codex Stop (capability table 0.142, observe)",
            ),
        ),
        (
            "pre_compaction",
            s(
                "supported",
                false,
                "codex PreCompact (capability table 0.142)",
            ),
        ),
        (
            "subagent_start",
            s(
                "supported",
                false,
                "codex SubagentStart (capability table 0.142)",
            ),
        ),
        (
            "subagent_stop",
            s(
                "supported",
                false,
                "codex SubagentStop (capability table 0.142)",
            ),
        ),
    ]
}

/// The lifecycle map for a provider, or an all-`unknown` map that claims nothing.
pub fn lifecycle_map(provider: &str) -> LifecycleMap {
    match provider {
        "claude-code" => claude_code(),
        "claude-plugin" => claude_plugin(),
        "codex" => codex(),
        _ => LIFECYCLE_EVENTS
            .iter()
            .map(|e| {
                (
                    *e,
                    s(
                        "unknown",
                        false,
                        "no tested lifecycle projection for this provider",
                    ),
                )
            })
            .collect(),
    }
}

pub fn lifecycle_json(map: &LifecycleMap) -> Value {
    Value::Object(
        map.iter()
            .map(|(e, v)| ((*e).to_string(), v.to_json()))
            .collect(),
    )
}

/// The events on which a provider can actually gate: proven only.
pub fn gating_events(provider: &str) -> Vec<&'static str> {
    lifecycle_map(provider)
        .into_iter()
        .filter(|(_, v)| v.gate)
        .map(|(e, _)| e)
        .collect()
}

/// A safety-critical deny event this provider cannot guarantee a block on.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EnforcementGap {
    pub event: &'static str,
    pub status: &'static str,
    pub reason: String,
}

impl EnforcementGap {
    pub fn to_json(&self) -> Value {
        json!({"event": self.event, "status": self.status, "reason": self.reason})
    }
}

pub fn enforcement_gaps(provider: &str) -> Vec<EnforcementGap> {
    let map = lifecycle_map(provider);
    SECURITY_ENFORCEMENT_EVENTS
        .iter()
        .filter_map(|event| {
            let support = &map.iter().find(|(e, _)| e == event)?.1;
            if support.gate {
                return None;
            }
            let reason = match support.status {
                "unsupported" => {
                    format!("no {event} event — a safety hook here cannot run at all")
                }
                "unknown" => format!(
                    "{event} support unproven for this provider — enforcement cannot be assumed"
                ),
                _ => format!(
                    "{event} fires but cannot guarantee a block ({})",
                    support.evidence
                ),
            };
            Some(EnforcementGap {
                event,
                status: support.status,
                reason,
            })
        })
        .collect()
}
