//! The only network access in mewkit: a bounded GET behind a trait, so the
//! fetcher is tested against in-memory releases.
use std::time::Duration;

use super::KitError;

pub trait Http {
    /// The body of `url`, refusing more than `limit` bytes.
    fn get(&self, url: &str, limit: u64) -> Result<Vec<u8>, KitError>;
}

pub struct UreqHttp {
    agent: ureq::Agent,
}

impl Default for UreqHttp {
    fn default() -> Self {
        let config = ureq::Agent::config_builder()
            .timeout_global(Some(Duration::from_secs(300)))
            .https_only(true)
            .build();
        Self {
            agent: ureq::Agent::new_with_config(config),
        }
    }
}

impl Http for UreqHttp {
    fn get(&self, url: &str, limit: u64) -> Result<Vec<u8>, KitError> {
        let fail = |e: ureq::Error| KitError::Http(format!("GET {url}: {e}"));
        let mut resp = self
            .agent
            .get(url)
            .header(
                "User-Agent",
                concat!("mewkit-next/", env!("CARGO_PKG_VERSION")),
            )
            .header(
                "Accept",
                "application/vnd.github+json, application/octet-stream",
            )
            .call()
            .map_err(fail)?;
        resp.body_mut()
            .with_config()
            .limit(limit)
            .read_to_vec()
            .map_err(fail)
    }
}
