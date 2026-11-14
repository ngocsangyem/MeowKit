//! `.claude/kit-contract.json`: which installer binaries can read this kit.
use std::ops::RangeInclusive;
use std::path::Path;

use serde::Deserialize;

use super::KitError;
use super::select::Version;

pub const CONTRACT_FILE: &str = ".claude/kit-contract.json";
/// The kit contract versions this binary understands.
pub const SUPPORTED: RangeInclusive<u64> = 1..=1;

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct KitContract {
    pub kit_contract: u64,
    pub requires: Requires,
    pub kit_version: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Requires {
    pub mewkit_min: String,
}

/// Read the contract from an extracted kit; `None` if the kit predates it.
pub fn read(kit_dir: &Path) -> Result<Option<KitContract>, KitError> {
    let file = kit_dir.join(CONTRACT_FILE);
    let text = match std::fs::read_to_string(&file) {
        Ok(t) => t,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(source) => {
            return Err(KitError::Io {
                action: format!("reading {CONTRACT_FILE}"),
                source,
            });
        }
    };
    serde_json::from_str(&text)
        .map(Some)
        .map_err(|e| KitError::Contract(format!("{CONTRACT_FILE} is invalid: {e}")))
}

/// Refuse a kit this binary (version `binary`) cannot install.
pub fn check(c: &KitContract, binary: &str) -> Result<(), KitError> {
    if !SUPPORTED.contains(&c.kit_contract) {
        let (lo, hi) = (SUPPORTED.start(), SUPPORTED.end());
        let hint = if c.kit_contract > *hi {
            "; run `mewkit self-update`"
        } else {
            "; install an older mewkit or a newer kit"
        };
        return Err(KitError::Contract(format!(
            "kit {} uses kit contract {}, and this mewkit reads {lo}–{hi}{hint}",
            c.kit_version, c.kit_contract
        )));
    }
    let min = Version::parse(&format!("v{}", c.requires.mewkit_min)).ok_or_else(|| {
        KitError::Contract(format!(
            "mewkitMin {:?} is not a version",
            c.requires.mewkit_min
        ))
    })?;
    let have = Version::parse(&format!("v{binary}"))
        .ok_or_else(|| KitError::Contract(format!("binary version {binary:?} is not a version")))?;
    if min > have {
        return Err(KitError::Contract(format!(
            "kit {} needs mewkit ≥ {}; this is {binary}. Run `mewkit self-update`",
            c.kit_version, c.requires.mewkit_min
        )));
    }
    Ok(())
}

/// The contract gate for any source: check it, or allow its absence only for
/// unverified installs.
pub fn accept(
    c: Option<&KitContract>,
    allow_unverified: bool,
    binary: &str,
) -> Result<(), KitError> {
    match c {
        Some(c) => check(c, binary),
        None if allow_unverified => Ok(()),
        None => Err(KitError::Contract(format!(
            "the kit has no {CONTRACT_FILE}; it was built for the npm mewkit CLI. \
             Pass --allow-unverified-kit to install it anyway"
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn c(contract: u64, min: &str) -> KitContract {
        KitContract {
            kit_contract: contract,
            requires: Requires {
                mewkit_min: min.into(),
            },
            kit_version: "2.16.0".into(),
        }
    }

    #[test]
    fn in_range_and_old_enough_passes() {
        assert!(check(&c(1, "0.1.0"), "0.1.0").is_ok());
        assert!(check(&c(1, "0.1.0"), "1.2.3").is_ok());
    }

    #[test]
    fn out_of_range_or_too_new_is_refused_by_name() {
        let e = check(&c(2, "0.1.0"), "0.1.0").unwrap_err().to_string();
        assert!(
            e.contains("kit contract 2") && e.contains("self-update"),
            "{e}"
        );
        assert!(check(&c(0, "0.1.0"), "0.1.0").is_err());
        let e = check(&c(1, "0.2.0"), "0.1.0").unwrap_err().to_string();
        assert!(e.contains("kit 2.16.0 needs mewkit ≥ 0.2.0"), "{e}");
        assert!(check(&c(1, "latest"), "0.1.0").is_err());
    }
}
