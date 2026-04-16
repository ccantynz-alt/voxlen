//! OS-native secret storage.
//!
//! Wraps the `keyring` crate so API keys and license strings live in
//! Keychain / Credential Manager / libsecret instead of the plain-text
//! settings store. Callers never see platform-specific error types —
//! failures downgrade to `Ok(None)` on read and return a descriptive
//! string on write.
//!
//! Entries are namespaced under the service `ai.voxlen.marco-reid-voice`
//! so they are easy to spot in system keychain viewers.

use keyring::Entry;

const SERVICE: &str = "ai.voxlen.marco-reid-voice";

/// Names of the secrets managed by this module. Kept as an enum so
/// callers can't typo the account name.
#[derive(Debug, Clone, Copy)]
pub enum Secret {
    LicenseKey,
    SttApiKey,
    GrammarApiKey,
}

impl Secret {
    fn account(self) -> &'static str {
        match self {
            Secret::LicenseKey => "license_key",
            Secret::SttApiKey => "stt_api_key",
            Secret::GrammarApiKey => "grammar_api_key",
        }
    }
}

fn entry(secret: Secret) -> Result<Entry, String> {
    Entry::new(SERVICE, secret.account()).map_err(|e| format!("keyring unavailable: {e}"))
}

/// Read a secret. Returns `Ok(None)` if the entry does not exist or the
/// platform keychain is unavailable (e.g. headless Linux CI). Never
/// returns `Err` so callers can treat absent secrets as "free tier" or
/// "not configured" without extra plumbing.
pub fn read(secret: Secret) -> Option<String> {
    let entry = entry(secret).ok()?;
    match entry.get_password() {
        Ok(v) => Some(v),
        Err(keyring::Error::NoEntry) => None,
        Err(e) => {
            log::debug!("keyring read for {:?} failed: {}", secret, e);
            None
        }
    }
}

/// Store a secret. Passing an empty string deletes the entry so callers
/// can use a single code path for "set to X or clear".
pub fn write(secret: Secret, value: Option<&str>) -> Result<(), String> {
    let entry = entry(secret)?;
    match value {
        Some(v) if !v.is_empty() => entry
            .set_password(v)
            .map_err(|e| format!("failed to store {} in keyring: {}", secret.account(), e)),
        _ => match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(format!(
                "failed to clear {} from keyring: {}",
                secret.account(),
                e
            )),
        },
    }
}
