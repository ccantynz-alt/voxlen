use keyring::Entry;

const SERVICE_NAME: &str = "com.voxlen.app";

fn entry_for(key: &str) -> Result<Entry, String> {
    Entry::new(SERVICE_NAME, key).map_err(|e| format!("Keyring init error: {e}"))
}

#[tauri::command]
pub fn keyring_get(key: String) -> Result<Option<String>, String> {
    let entry = entry_for(&key)?;
    match entry.get_password() {
        Ok(val) => Ok(Some(val)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Keyring read error: {e}")),
    }
}

#[tauri::command]
pub fn keyring_set(key: String, value: String) -> Result<(), String> {
    let entry = entry_for(&key)?;
    entry.set_password(&value).map_err(|e| format!("Keyring write error: {e}"))
}

#[tauri::command]
pub fn keyring_delete(key: String) -> Result<(), String> {
    let entry = entry_for(&key)?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Keyring delete error: {e}")),
    }
}

/// Read a secret straight from the OS keychain for use by backend (non-command)
/// startup code. Returns `None` on a missing entry OR on any keychain backend
/// error (e.g. no Secret Service on a headless Linux box) so startup never
/// fails because of the keychain.
pub fn read_secret(key: &str) -> Option<String> {
    let entry = entry_for(key).ok()?;
    match entry.get_password() {
        Ok(val) => Some(val),
        Err(keyring::Error::NoEntry) => None,
        Err(e) => {
            log::warn!("Could not read '{key}' from keychain: {e}");
            None
        }
    }
}
