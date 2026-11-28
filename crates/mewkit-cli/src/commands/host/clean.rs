//! `host clean [--dry-run]`: remove mewkit's own stale host state now (the
//! watcher does this by itself on low free space). Never touches a project,
//! `target/` or `~/.cargo`; `host status --caches` reports those instead.
use clap::Args;
use mewkit_core::host::clean;
use mewkit_core::host::time_now_ms;

use crate::failure::{Failure, OK};

#[derive(Args, Debug)]
pub struct CleanArgs {
    /// List what would be removed and remove nothing.
    #[arg(long)]
    pub dry_run: bool,
}

pub fn run(args: &CleanArgs) -> Result<u8, Failure> {
    let paths = super::host_paths()?;
    let items = clean::plan(&paths, time_now_ms());
    if items.is_empty() {
        println!("nothing to clean under {}", paths.root.display());
        return Ok(OK);
    }
    clean::describe(&items, &mut std::io::stdout());
    let bytes: u64 = items.iter().map(|i| i.bytes).sum();
    if args.dry_run || !clean::REMOVES {
        if !clean::REMOVES {
            println!(
                "cleanup is report-only on this platform (beta): file owners cannot be checked yet"
            );
        }
        println!(
            "dry run: {} items, {bytes} bytes would be removed",
            items.len()
        );
    } else {
        let removed = clean::execute(&paths, &items);
        println!(
            "removed {removed} of {} items; see {}",
            items.len(),
            paths.dir("clean.log").display()
        );
    }
    Ok(OK)
}
