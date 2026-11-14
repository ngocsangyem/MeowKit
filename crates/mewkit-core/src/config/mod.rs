//! The committed project config: one grammar, one key surface, one precedence
//! order.
//!
//! `.meowkit/config.yaml` is read by two things that must never disagree: this
//! crate, and a hook that has no dependencies at all and parses the file by hand
//! (`.claude/hooks/lib/yaml-subset.cjs`). So the file's grammar is a small
//! subset of YAML, parsed here by hand too, with the same error identifiers the
//! hook reports — and the fixture corpus in `tests/config/fixtures/` holds the
//! two readers to the same verdict, fixture by fixture.
//!
//! The order of the layers is the order of the modules below:
//!
//! 1. [`yaml_grammar`] walks the file line by line and [`config_scalar`] reads
//!    one value, together parsing the subset into a flat `path -> scalar` map or
//!    refusing the file by line.
//! 2. [`config_rules`] refuses a file that parses but says something a committed
//!    file must not say — a secret, an absolute path, a protected hook, a gate.
//! 3. [`shape_check`] re-refuses the file against the declared key surface,
//!    independently of the rules — the deliberate redundancy `load-config.ts`
//!    keeps so that a shape the rules let through is not applied.
//! 4. [`load_config`] turns any of those refusals into one failure naming the
//!    file, the scope and the fix.
//! 5. [`precedence`] merges the levels: environment override, CLI flag, project
//!    config, user config, default — and reports which one answered.
pub mod config_rules;
pub mod config_scalar;
pub mod config_values;
pub mod json_schema;
pub mod key_surface;
pub mod load_config;
pub mod observer_names;
pub mod precedence;
pub mod removed_env_names;
pub mod scalar_spelling;
pub mod schema;
pub mod shape_check;
pub mod write_stub;
pub mod yaml_grammar;

pub use config_rules::{ConfigScope, RuleError, apply_rules};
pub use config_values::{ConfigValue, ConfigValues};
pub use json_schema::{config_json_schema, render_config_json_schema};
pub use load_config::{
    CONFIG_REL, ConfigFailure, LoadedConfig, load_config_file, project_config_path,
    user_config_path,
};
pub use observer_names::{REGISTRY_REL, observer_names};
pub use precedence::{
    ENV_OVERRIDES, Level, ResolveOptions, Resolved, config_value, env_boolean, home_dir,
    process_env, resolve_config,
};
pub use removed_env_names::{REMOVED_ENV_NAMES, replacement_for};
pub use schema::{
    AUTOBUILD_MODES, KEY_DOC, KeySpec, SCALAR_KEYS, SCHEMA_URL, TELEMETRY_MODES,
    USER_SCOPE_ONLY_KEY, ValueKind, known_keys,
};
pub use shape_check::{ShapeViolation, check_shape};
pub use write_stub::render_config_stub;
pub use yaml_grammar::{GrammarError, SCHEMA_KEY, check_grammar, parse_config_subset};
