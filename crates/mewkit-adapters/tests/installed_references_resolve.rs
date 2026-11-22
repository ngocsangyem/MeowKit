//! Text an emitter installs names a file under the runtime's own folders only
//! when the install puts that file there, against this checkout's own kit.
mod support;

use mewkit_adapters::contract::Scope;
use mewkit_adapters::registry::{emitted, emitter};
use support::{kit, request};

#[test]
fn no_installed_text_names_a_path_the_install_lacks() {
    let dir = tempfile::tempdir().unwrap();
    let scope = Scope::project(dir.path());
    let kit = kit();
    let mut dangling = Vec::new();
    for runtime in emitted() {
        let plan = emitter(runtime)
            .unwrap()
            .prepare(&request(&kit, &scope, &[], &[]))
            .unwrap();
        for notice in plan.notices {
            if notice.contains("dangling reference") {
                dangling.push(format!("{}: {notice}", runtime.name()));
            }
        }
    }
    assert!(
        dangling.is_empty(),
        "reword the source so it holds on every runtime, or map the path in projection:\n{}",
        dangling.join("\n")
    );
}
