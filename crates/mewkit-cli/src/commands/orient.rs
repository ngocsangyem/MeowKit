//! `orient` — resume orientation from durable task state.
//!
//! Argument parsing only: the reconstruction, the envelope and the renderer live
//! in [`mewkit_core::orient`], which is also what the SessionStart hook consumes
//! through this binary's stdout.
use clap::Args;
use mewkit_core::orient::{OrientOptions, orient};

use crate::failure::{Failure, OK};

#[derive(Args, Debug)]
pub struct OrientArgs {
    /// Print the full envelope as JSON instead of the bounded text block.
    #[arg(long)]
    pub json: bool,
    /// Record the advisory `orient_run` measurement (the default).
    ///
    /// The npm CLI records only when `--record` is passed, because its parser
    /// pre-sets every declared boolean to false; its own help says recording is
    /// the default. This CLI does what the help says. The SessionStart hook
    /// passes `--no-record`, so it is unaffected.
    #[arg(long, overrides_with = "no_record")]
    pub record: bool,
    /// Skip the advisory measurement, leaving the run strictly read-only.
    #[arg(long = "no-record", overrides_with = "record")]
    pub no_record: bool,
}

pub fn run(args: &OrientArgs) -> Result<u8, Failure> {
    let project_root = std::env::current_dir()?;
    let text = orient(
        &project_root,
        &OrientOptions {
            json: args.json,
            record: !args.no_record,
        },
    )?;
    println!("{text}");
    Ok(OK)
}
