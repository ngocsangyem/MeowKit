//! `doctor provenance [--explain]`: what can and cannot be proven, from local
//! evidence only, about the npm CLI's install baseline. Read-only: it never
//! fetches a release and never relabels a file.
//!
//! Three honest classes: verified (as-shipped identity provable),
//! known-modified (diverged from a KNOWN baseline) and unknown (no baseline).
//! No repair is proposed, because doctor holds no trusted release payload.
//! Plain text; colour is not ported.
use std::path::Path;

use mewkit_core::baseline::{Provenance, Source, classify_provenance, read_install_metadata};

use crate::failure::{Failure, OK};

/// First ten paths, then how many more.
fn sample(paths: &[&str]) -> String {
    if paths.is_empty() {
        return "(none)".into();
    }
    let shown = paths
        .iter()
        .take(10)
        .copied()
        .collect::<Vec<_>>()
        .join(", ");
    if paths.len() > 10 {
        format!("{shown}, …(+{})", paths.len() - 10)
    } else {
        shown
    }
}

pub fn run(root: Option<&Path>, explain: bool) -> Result<u8, Failure> {
    println!("MeowKit Provenance");
    println!("Read-only: reports what can and cannot be proven locally. No fetch, no relabel.\n");
    let Some(root) = root else {
        println!("  Project root not found — nothing to explain.");
        return Ok(OK);
    };
    let (source, meta) = match read_install_metadata(root) {
        Ok((Source::None, _)) | Ok((_, None)) => {
            println!("  No installed metadata found — provenance cannot be established.");
            println!(
                "  Run `mewkit upgrade` to write canonical metadata, then re-run this command."
            );
            return Ok(OK);
        }
        Ok((source, Some(meta))) => (source, meta),
        Err(detail) => {
            println!("  Canonical metadata.json is corrupt: {detail}");
            println!("  Provenance is unprovable until it is regenerated (`mewkit upgrade`).");
            return Ok(OK);
        }
    };
    // Only canonical metadata carries a trusted as-shipped baseline; a legacy
    // source rebuilds baselines from the disk, so its "matches" prove nothing.
    let trusted = source == Source::New;
    let (mut verified, mut modified, mut unknown) = (0, Vec::new(), Vec::new());
    for f in &meta.files {
        match classify_provenance(f, trusted) {
            Provenance::Verified => verified += 1,
            Provenance::KnownModified => modified.push(f.path.as_str()),
            Provenance::Unknown => unknown.push(f.path.as_str()),
        }
    }
    println!("  Metadata source: {}", source.name());
    if !trusted {
        println!(
            "  Baseline is reconstructed from disk (source={}), not a trusted release payload —\n  as-shipped identity is NOT provable for these files. Run `mewkit upgrade` to write\n  canonical metadata with real baselines.",
            source.name()
        );
    }
    if meta.files.is_empty() {
        println!(
            "  No file-level provenance recorded — nothing can be proven. Run `mewkit upgrade`."
        );
        return Ok(OK);
    }
    println!("  verified       {verified} — as-shipped identity provable");
    println!(
        "  known-modified {} — diverged from a known baseline",
        modified.len()
    );
    println!(
        "  unknown        {} — as-shipped identity not provable\n",
        unknown.len()
    );
    if explain {
        println!("  known-modified: {}", sample(&modified));
        println!("  unknown: {}\n", sample(&unknown));
    }
    let repairable = modified.len() + unknown.len();
    if repairable == 0 {
        println!("  All tracked files have provable provenance. No repair needed.");
    } else {
        println!(
            "  {repairable} file(s) are modified or lack a baseline. No repair is proposed here: doctor has no\n  trusted release payload on disk. Exact historical repair requires the matching release\n  payload and a separately-approved repair flow — it is never reconstructed silently."
        );
    }
    Ok(OK)
}
