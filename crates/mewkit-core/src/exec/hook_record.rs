//! The hook registrations an install of a plan records, without applying it.
use std::collections::BTreeMap;

use super::decide::hooks_section_id;
use crate::ownership::Section;
use crate::plan::{Format, Op, Plan};

/// What applying `plan` would record for the hook handlers it merges: file →
/// section id → record.
///
/// A handler's recorded name is its matcher plus its command, so the name
/// alone identifies a registration as the kit's. That lets an install record
/// be rebuilt for hooks from the plan of the kit that made them, and a later
/// merge then strips the ones a newer kit dropped. Nothing is recorded as
/// created by the kit, so a strip never removes the file or its `hooks` key.
pub fn hook_sections(plan: &Plan) -> BTreeMap<String, BTreeMap<String, Section>> {
    let mut out: BTreeMap<String, BTreeMap<String, Section>> = BTreeMap::new();
    for op in &plan.ops {
        let Op::MergeHooks {
            path,
            event,
            handlers,
            ..
        } = op
        else {
            continue;
        };
        let names: Vec<String> = handlers.iter().filter_map(|h| h.id().ok()).collect();
        if names.is_empty() {
            continue;
        }
        out.entry(path.to_string()).or_default().insert(
            hooks_section_id(event),
            Section {
                format: Format::Json,
                key: vec!["hooks".into(), event.clone()],
                names,
                created: 0,
                file_created: false,
            },
        );
    }
    out
}
