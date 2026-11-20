//! `runtime-surface-table.md` beside this crate is the table as the binary holds it.
//! Re-render with `MEWKIT_BLESS=1 cargo test -p mewkit-adapters --test surface_table_doc`.
use std::path::Path;

use mewkit_adapters::surface_doc::render;
use mewkit_adapters::surface_table::table;

#[test]
fn the_maintainer_page_matches_the_data() {
    let page = Path::new(env!("CARGO_MANIFEST_DIR")).join("runtime-surface-table.md");
    let rendered = render(table());
    if std::env::var_os("MEWKIT_BLESS").is_some() {
        std::fs::write(&page, &rendered).unwrap();
    }
    let on_disk = std::fs::read_to_string(&page).unwrap_or_default();
    assert!(
        on_disk == rendered,
        "{} is stale; re-render it with MEWKIT_BLESS=1",
        page.display()
    );
}
