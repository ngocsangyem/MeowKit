//! `mewkit-next self-update`: replace this binary with the newest release on
//! its channel. Verification is by SHA-256 and size from the release's
//! `binary-manifest.json`, fetched over TLS from this repository; there is no
//! signature. The previous binary is kept beside the new one as `.old`.
use clap::{Args, ValueEnum};
use mewkit_core::kit::http::UreqHttp;
use mewkit_core::update::{self, Channel};

use crate::failure::{Failure, OK, PENDING};

#[derive(Clone, Copy, Debug, ValueEnum)]
#[value(rename_all = "lower")]
pub enum ChannelArg {
    Stable,
    Beta,
}

#[derive(Args, Debug)]
pub struct SelfUpdateArgs {
    /// Only report whether a newer binary exists (exit 3 when one does).
    #[arg(long)]
    pub check: bool,
    /// Release channel: stable, or beta to include prereleases.
    #[arg(long, value_enum, default_value_t = ChannelArg::Stable)]
    pub channel: ChannelArg,
}

pub fn run(args: &SelfUpdateArgs) -> Result<u8, Failure> {
    let channel = match args.channel {
        ChannelArg::Stable => Channel::Stable,
        ChannelArg::Beta => Channel::Beta,
    };
    let http = UreqHttp::default();
    let offer = update::check(&http, mewkit_core::VERSION, channel)?;
    if offer.withdrawn {
        eprintln!(
            "note: {} has been withdrawn; update to {}",
            offer.running, offer.latest
        );
    }
    if offer.is_ahead() {
        println!(
            "mewkit-next {} is newer than the newest {} release ({})",
            offer.running,
            if channel == Channel::Beta {
                "beta"
            } else {
                "stable"
            },
            offer.latest
        );
        return Ok(OK);
    }
    if !offer.is_newer() {
        println!("mewkit-next {} is up to date", offer.running);
        return Ok(OK);
    }
    if args.check {
        println!(
            "mewkit-next {} is available ({} running, {})",
            offer.latest, offer.running, offer.target
        );
        return Ok(PENDING);
    }
    let exe = std::env::current_exe()
        .and_then(|p| p.canonicalize())
        .map_err(|e| Failure::failed(format!("cannot locate the running binary: {e}")))?;
    let old = update::apply(&http, &offer, &exe)?;
    println!(
        "updated mewkit-next {} -> {} ({}); the previous binary is kept at {}",
        offer.running,
        offer.latest,
        exe.display(),
        old.display()
    );
    Ok(OK)
}
