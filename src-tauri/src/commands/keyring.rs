use keyring::Entry;

const SERVICE_NAME: &str = "com.marcoreid.voice";

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
