//! One capability manifest entry, with the JSON key order the npm CLI prints.
//!
//! `explain --json` and `resolve --json` print these verbatim, so the field
//! order here is part of the contract: a consumer diffing the output sees the
//! same bytes from either CLI.
use serde_json::{Map, Value, json};

pub const KINDS: [&str; 8] = [
    "skill",
    "agent",
    "command",
    "workflow",
    "hook",
    "tool",
    "context-service",
    "state-service",
];
const REQUIREMENT_TYPES: [&str; 7] = [
    "host_tool",
    "mcp_or_app",
    "external_binary",
    "subagent_surface",
    "skill_script",
    "lifecycle_event",
    "file_or_config",
];
const INVOCATION_KINDS: [&str; 6] = ["skill", "agent", "command", "workflow", "hook", "none"];
const PROVENANCES: [&str; 4] = ["authored", "inferred", "adapter", "unknown"];
const VERIFICATION_KINDS: [&str; 5] = ["command", "file", "runtime", "none", "unknown"];

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Requirement {
    pub kind: String,
    pub id: String,
    pub provenance: String,
}

impl Requirement {
    pub fn to_json(&self) -> Value {
        json!({"type": self.kind, "id": self.id, "provenance": self.provenance})
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Entry {
    pub id: String,
    pub kind: String,
    pub description: String,
    pub aliases: Vec<String>,
    pub source_path: Option<String>,
    pub inventory_id: Option<String>,
    pub owner: String,
    pub installed_state: String,
    pub intents: Vec<String>,
    pub when_to_use: Option<String>,
    pub invocation_kind: String,
    pub invocation_id: String,
    pub requirements: Vec<Requirement>,
    /// The reason a task-scoped repo-context envelope is needed first.
    pub context_requirement: Option<String>,
    pub support: Map<String, Value>,
    pub verification_kind: String,
    pub verification_id: Option<String>,
    pub upstream: Vec<String>,
    pub downstream: Vec<String>,
    pub provenance: Map<String, Value>,
    /// An authored entry is built by spreading defaults first, so the npm CLI
    /// prints `id`, `kind`, `description` and `intents` LAST for it.
    pub authored_layout: bool,
}

impl Entry {
    pub fn authored_intents(&self) -> bool {
        self.provenance.get("intents").and_then(Value::as_str) == Some("authored")
    }

    pub fn context_requirement_json(&self) -> Value {
        self.context_requirement
            .as_ref()
            .map_or(Value::Null, |r| json!({"scope": "task-repo", "reason": r}))
    }

    pub fn verification_json(&self) -> Value {
        let mut m = Map::new();
        m.insert("kind".into(), self.verification_kind.clone().into());
        if let Some(id) = &self.verification_id {
            m.insert("id".into(), id.clone().into());
        }
        Value::Object(m)
    }

    pub fn to_json(&self) -> Value {
        let mut fields: Vec<(&str, Value)> = vec![
            ("id", json!(self.id)),
            ("kind", json!(self.kind)),
            ("description", json!(self.description)),
            ("aliases", json!(self.aliases)),
            ("sourcePath", json!(self.source_path)),
            ("inventoryId", json!(self.inventory_id)),
            ("owner", json!(self.owner)),
            ("installedState", json!(self.installed_state)),
            ("intents", json!(self.intents)),
            ("whenToUse", json!(self.when_to_use)),
            (
                "invocation",
                json!({"kind": self.invocation_kind, "id": self.invocation_id}),
            ),
            (
                "requirements",
                json!(
                    self.requirements
                        .iter()
                        .map(Requirement::to_json)
                        .collect::<Vec<_>>()
                ),
            ),
            ("contextRequirement", self.context_requirement_json()),
            ("support", Value::Object(self.support.clone())),
            ("verification", self.verification_json()),
            (
                "dependencies",
                json!({"upstream": self.upstream, "downstream": self.downstream}),
            ),
            ("provenance", Value::Object(self.provenance.clone())),
        ];
        if self.authored_layout {
            let late = ["id", "kind", "description", "intents"];
            let (tail, head): (Vec<_>, Vec<_>) =
                fields.into_iter().partition(|(k, _)| late.contains(k));
            fields = head.into_iter().chain(tail).collect();
        }
        Value::Object(
            fields
                .into_iter()
                .map(|(k, v)| (k.to_string(), v))
                .collect(),
        )
    }

    /// Read one entry of a Codex snapshot, applying the schema's defaults.
    /// The error names the first thing wrong.
    pub fn from_snapshot(value: &Value) -> Result<Entry, String> {
        let obj = value.as_object().ok_or("Expected object")?;
        let text = |key: &str, default: &str| -> Result<String, String> {
            match obj.get(key) {
                None | Some(Value::Null) if key != "id" => Ok(default.to_string()),
                Some(Value::String(s)) => Ok(s.clone()),
                _ => Err(format!("{key}: Expected string")),
            }
        };
        let optional = |key: &str| -> Result<Option<String>, String> {
            match obj.get(key) {
                None | Some(Value::Null) => Ok(None),
                Some(Value::String(s)) => Ok(Some(s.clone())),
                _ => Err(format!("{key}: Expected string")),
            }
        };
        let list = |v: Option<&Value>, key: &str| -> Result<Vec<String>, String> {
            match v {
                None => Ok(Vec::new()),
                Some(Value::Array(a)) => a
                    .iter()
                    .map(|i| {
                        i.as_str()
                            .map(String::from)
                            .ok_or(format!("{key}: Expected string"))
                    })
                    .collect(),
                _ => Err(format!("{key}: Expected array")),
            }
        };
        let one_of = |what: &str, got: &str, allowed: &[&str]| -> Result<(), String> {
            allowed
                .contains(&got)
                .then_some(())
                .ok_or(format!("{what}: Invalid enum value. Received '{got}'"))
        };
        let id = text("id", "")?;
        let kind = text("kind", "")?;
        one_of("kind", &kind, &KINDS)?;
        let invocation = obj
            .get("invocation")
            .and_then(Value::as_object)
            .ok_or("invocation: Required")?;
        let invocation_kind = invocation.get("kind").and_then(Value::as_str).unwrap_or("");
        one_of("invocation.kind", invocation_kind, &INVOCATION_KINDS)?;
        let invocation_id = invocation
            .get("id")
            .and_then(Value::as_str)
            .ok_or("invocation.id: Required")?;
        let mut requirements = Vec::new();
        for r in obj
            .get("requirements")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            let ty = r.get("type").and_then(Value::as_str).unwrap_or("");
            one_of("requirements.type", ty, &REQUIREMENT_TYPES)?;
            let prov = r
                .get("provenance")
                .and_then(Value::as_str)
                .unwrap_or("inferred");
            one_of("requirements.provenance", prov, &PROVENANCES)?;
            requirements.push(Requirement {
                kind: ty.to_string(),
                id: r
                    .get("id")
                    .and_then(Value::as_str)
                    .ok_or("requirements.id: Required")?
                    .to_string(),
                provenance: prov.to_string(),
            });
        }
        let context_requirement = match obj.get("contextRequirement") {
            Some(Value::Object(c)) => Some(
                c.get("reason")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string(),
            ),
            _ => None,
        };
        let verification = obj.get("verification").and_then(Value::as_object);
        let verification_kind = verification
            .and_then(|v| v.get("kind"))
            .and_then(Value::as_str)
            .unwrap_or("unknown");
        one_of("verification.kind", verification_kind, &VERIFICATION_KINDS)?;
        let deps = obj.get("dependencies").and_then(Value::as_object);
        Ok(Entry {
            id,
            kind,
            description: text("description", "")?,
            aliases: list(obj.get("aliases"), "aliases")?,
            source_path: optional("sourcePath")?,
            inventory_id: optional("inventoryId")?,
            owner: text("owner", "")?,
            installed_state: text("installedState", "unknown")?,
            intents: list(obj.get("intents"), "intents")?,
            when_to_use: optional("whenToUse")?,
            invocation_kind: invocation_kind.to_string(),
            invocation_id: invocation_id.to_string(),
            requirements,
            context_requirement,
            support: obj
                .get("support")
                .and_then(Value::as_object)
                .cloned()
                .unwrap_or_default(),
            verification_kind: verification_kind.to_string(),
            verification_id: verification
                .and_then(|v| v.get("id"))
                .and_then(Value::as_str)
                .map(String::from),
            upstream: list(
                deps.and_then(|d| d.get("upstream")),
                "dependencies.upstream",
            )?,
            downstream: list(
                deps.and_then(|d| d.get("downstream")),
                "dependencies.downstream",
            )?,
            provenance: obj
                .get("provenance")
                .and_then(Value::as_object)
                .cloned()
                .unwrap_or_default(),
            authored_layout: false,
        })
    }
}
