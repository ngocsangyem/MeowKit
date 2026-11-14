//! The unified per-provider adapter view: discovery projection and the four
//! support levels, repo-context acquisition, lifecycle events, invocation
//! shapes, workflow operations and the task-state storage boundary.
//!
//! It composes the trusted adapter constants and introduces no provider
//! claim of its own, so `mewkit providers --lifecycle` and a capability
//! resolution can never state contradictory support.
use serde_json::{Value, json};

use super::invocation::{
    InvocationMap, OperationMap, invocation_json, invocation_shapes, operation_shapes,
    operations_json,
};
use super::lifecycle::{
    EnforcementGap, LifecycleMap, enforcement_gaps, gating_events, lifecycle_json, lifecycle_map,
};
use super::projection::{Acquisition, Projection, get_acquisition, get_projection};

/// The providers with an authored adapter, for matrix enumeration.
pub const ADAPTED_PROVIDERS: [&str; 3] = ["claude-code", "claude-plugin", "codex"];

/// Task records are the consumer project's state, never plugin-owned data.
const STORAGE_BOUNDARY: &str = "consumer project <cwd>/tasks/active (cwd-keyed; not plugin-owned)";

pub struct AdapterView {
    pub provider: String,
    pub projection: Projection,
    pub acquisition: Acquisition,
    pub lifecycle: LifecycleMap,
    pub gating_events: Vec<&'static str>,
    pub enforcement_gaps: Vec<EnforcementGap>,
    pub invocation: InvocationMap,
    pub operations: OperationMap,
}

impl AdapterView {
    pub fn storage_boundary(&self) -> &'static str {
        STORAGE_BOUNDARY
    }

    /// `enforced` for a proven deny, `advisory` where the event fires but
    /// cannot guarantee a block, else `unsupported`.
    fn enforcement(&self) -> &'static str {
        let pre = &self.lifecycle[1].1;
        if pre.gate {
            "enforced"
        } else if pre.status == "supported" || pre.status == "advisory" {
            "advisory"
        } else {
            "unsupported"
        }
    }

    pub fn to_json(&self) -> Value {
        let level = self.enforcement();
        let support_state = match self.projection.status {
            "supported" => "supported",
            "partial" => "partial",
            _ => "unsupported",
        };
        json!({
            "provider": self.provider,
            "status": self.projection.status,
            "projection": self.projection.to_json(),
            "acquisition": self.acquisition.to_json(),
            "lifecycle": lifecycle_json(&self.lifecycle),
            "gatingEvents": self.gating_events,
            "enforcementGaps": self.enforcement_gaps.iter().map(EnforcementGap::to_json).collect::<Vec<_>>(),
            "invocation": invocation_json(&self.invocation),
            "operations": operations_json(&self.operations),
            "storageBoundary": STORAGE_BOUNDARY,
            "summary": {
                "supportState": support_state,
                "enforcement": {"gate1": level, "gate2": level, "secretProtection": level},
                "gatesProven": self.lifecycle[1].1.gate,
            },
        })
    }
}

/// Compose the full adapter view; a report-only provider composes cleanly.
pub fn describe_provider(provider: &str) -> AdapterView {
    AdapterView {
        provider: provider.to_string(),
        projection: get_projection(provider),
        acquisition: get_acquisition(provider),
        lifecycle: lifecycle_map(provider),
        gating_events: gating_events(provider),
        enforcement_gaps: enforcement_gaps(provider),
        invocation: invocation_shapes(provider),
        operations: operation_shapes(provider),
    }
}
