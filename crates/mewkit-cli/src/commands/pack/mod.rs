//! `pack list|add|remove`: manage the optional domains of a Claude Code install.
//!
//! `add` is a scoped install (it writes new files and deletes nothing);
//! `remove` is an exclusivity-checked delete that never touches base, a pack
//! that stays, a file `settings.json` names, or a file the user edited.
mod add;
mod envelope;
mod list;
mod remove;
mod state;

use clap::Args;
use mewkit_core::validate::{PackManifest, has_pack_manifest, load_pack_manifest};

use crate::failure::{FAILED, Failure, USAGE};
use crate::kit_args::KitArgs;
use crate::place::Place;

#[derive(Args, Debug)]
pub struct PackArgs {
    /// `list`, `add` or `remove`.
    pub subcommand: Option<String>,
    /// Packs to add or remove.
    pub packs: Vec<String>,
    /// Print JSON instead of text.
    #[arg(long)]
    pub json: bool,
    /// Skip the confirmation before deleting.
    #[arg(long, short = 'y')]
    pub yes: bool,
    /// Print the plan; write and delete nothing.
    #[arg(long)]
    pub dry_run: bool,
    #[command(flatten)]
    pub kit: KitArgs,
}

const SUBCOMMANDS: [&str; 3] = ["list", "add", "remove"];

/// What every subcommand needs once the install is known to support packs.
pub(super) struct Context {
    pub place: Place,
    pub manifest: PackManifest,
    pub installed: state::Installed,
}

pub fn run(args: &PackArgs) -> Result<u8, Failure> {
    // Classified before anything runs, as the npm CLI's dispatcher does: a
    // missing or mistyped sub-verb is an invocation error (exit 2).
    let sub = match args.subcommand.as_deref() {
        Some(s) if SUBCOMMANDS.contains(&s) => s,
        other => {
            match other {
                Some(s) => eprintln!("Unknown `pack` subcommand: {s}"),
                None => eprintln!("`mewkit pack` needs a subcommand."),
            }
            eprintln!("Valid subcommands: {}", SUBCOMMANDS.join(", "));
            eprintln!("Run `mewkit pack --help` for usage.");
            return Ok(USAGE);
        }
    };
    let place = Place::project(&std::env::current_dir()?);
    let claude_dir = place.scope.root.join(".claude");
    if !has_pack_manifest(&claude_dir) {
        // Errors and their fixes go to stderr: a `--json` run leaves stdout
        // holding nothing but the envelope.
        eprintln!("Pack management requires meowkit with a pack-manifest.json.");
        eprintln!("Run `mewkit upgrade` first, then retry.");
        return Ok(FAILED);
    }
    let manifest = load_pack_manifest(&claude_dir).map_err(|e| Failure::failed(e.to_string()))?;
    let installed = match state::read(&place, &manifest) {
        Ok(installed) => installed,
        Err(detail) => {
            eprintln!("Installed metadata is corrupt: {detail}");
            eprintln!("Run `mewkit upgrade` to repair, then retry.");
            return Ok(FAILED);
        }
    };
    let ctx = Context {
        place,
        manifest,
        installed,
    };
    match sub {
        "list" => list::run(&ctx, args),
        "add" => add::run(&ctx, args),
        _ => remove::run(&ctx, args),
    }
}
