//! License verification for Marco Reid Voice.
//!
//! Licenses are Ed25519-signed JSON payloads. The signing key lives on the
//! Voxlen billing server (invoked by the Stripe webhook); the verification
//! key is embedded in the binary and is safe to publish. A valid license
//! string looks like:
//!
//! ```text
//! VOXLEN-<base64url(payload_json)>.<base64url(signature)>
//! ```
//!
//! The customer pastes this into the app once; verification is entirely
//! offline thereafter. No user content, license data, or identity ever
//! leaves the device as part of verification.

use anyhow::{anyhow, Result};
use base64::Engine;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};

/// Ed25519 verification key (32 bytes, hex-encoded).
///
/// Set at build time via the `VOXLEN_LICENSE_PUBKEY` env var. When unset, a
/// placeholder dev key is used — dev licenses will verify, but no production
/// license will. Before shipping paid builds, set the env var to the hex
/// of the public half of the Ed25519 keypair whose private half lives on
/// the billing server.
const EMBEDDED_PUBKEY_HEX: &str = match option_env!("VOXLEN_LICENSE_PUBKEY") {
    Some(k) => k,
    None => "0000000000000000000000000000000000000000000000000000000000000000",
};

const LICENSE_PREFIX: &str = "VOXLEN-";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Tier {
    Free,
    Pro,
    Professional,
    Lifetime,
}

impl Tier {
    pub fn is_paid(self) -> bool {
        !matches!(self, Tier::Free)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicensePayload {
    pub tier: Tier,
    pub email: String,
    /// Unix timestamp (seconds) when the license was issued.
    pub issued: i64,
    /// Unix timestamp (seconds) when the license expires. `None` = perpetual.
    pub expires: Option<i64>,
    /// License ID — used for revocation checks (future).
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseStatus {
    pub tier: Tier,
    pub email: Option<String>,
    pub expires: Option<i64>,
    pub valid: bool,
    pub reason: Option<String>,
}

impl LicenseStatus {
    pub fn free() -> Self {
        Self {
            tier: Tier::Free,
            email: None,
            expires: None,
            valid: true,
            reason: None,
        }
    }

    pub fn invalid(reason: impl Into<String>) -> Self {
        Self {
            tier: Tier::Free,
            email: None,
            expires: None,
            valid: false,
            reason: Some(reason.into()),
        }
    }
}

/// Verify a license string and return the parsed payload if valid.
pub fn verify(license: &str) -> Result<LicensePayload> {
    let body = license
        .trim()
        .strip_prefix(LICENSE_PREFIX)
        .ok_or_else(|| anyhow!("license must start with {}", LICENSE_PREFIX))?;

    let (payload_b64, sig_b64) = body
        .split_once('.')
        .ok_or_else(|| anyhow!("license format invalid: missing signature"))?;

    let engine = base64::engine::general_purpose::URL_SAFE_NO_PAD;
    let payload_bytes = engine
        .decode(payload_b64)
        .map_err(|_| anyhow!("license payload is not valid base64"))?;
    let sig_bytes = engine
        .decode(sig_b64)
        .map_err(|_| anyhow!("license signature is not valid base64"))?;

    let pubkey_bytes = hex::decode(EMBEDDED_PUBKEY_HEX)
        .map_err(|_| anyhow!("embedded license key is malformed"))?;
    let pubkey_arr: [u8; 32] = pubkey_bytes
        .try_into()
        .map_err(|_| anyhow!("embedded license key must be 32 bytes"))?;
    let verifying_key = VerifyingKey::from_bytes(&pubkey_arr)
        .map_err(|_| anyhow!("embedded license key is not a valid Ed25519 key"))?;

    let sig_arr: [u8; 64] = sig_bytes
        .as_slice()
        .try_into()
        .map_err(|_| anyhow!("license signature must be 64 bytes"))?;
    let signature = Signature::from_bytes(&sig_arr);

    verifying_key
        .verify(&payload_bytes, &signature)
        .map_err(|_| anyhow!("license signature does not verify — license may be forged or corrupted"))?;

    let payload: LicensePayload = serde_json::from_slice(&payload_bytes)
        .map_err(|e| anyhow!("license payload is not valid JSON: {e}"))?;

    if let Some(exp) = payload.expires {
        let now = chrono::Utc::now().timestamp();
        if now > exp {
            return Err(anyhow!("license expired"));
        }
    }

    Ok(payload)
}

/// Check a stored license string and produce a status suitable for the
/// frontend entitlement store. Never errors — an invalid license simply
/// downgrades the user to Free.
pub fn status(license: Option<&str>) -> LicenseStatus {
    match license {
        None => LicenseStatus::free(),
        Some(s) if s.trim().is_empty() => LicenseStatus::free(),
        Some(s) => match verify(s) {
            Ok(payload) => LicenseStatus {
                tier: payload.tier,
                email: Some(payload.email),
                expires: payload.expires,
                valid: true,
                reason: None,
            },
            Err(e) => LicenseStatus::invalid(e.to_string()),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_empty_license() {
        assert!(verify("").is_err());
    }

    #[test]
    fn rejects_missing_prefix() {
        assert!(verify("notalicense").is_err());
    }

    #[test]
    fn rejects_missing_signature() {
        assert!(verify("VOXLEN-abcdef").is_err());
    }

    #[test]
    fn status_of_none_is_free() {
        let s = status(None);
        assert!(s.valid);
        assert_eq!(s.tier, Tier::Free);
    }
}
