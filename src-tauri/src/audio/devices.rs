use cpal::traits::{DeviceTrait, HostTrait};
use super::AudioDevice;

pub fn enumerate_devices() -> Vec<AudioDevice> {
    let host = cpal::default_host();
    let default_device_name = host
        .default_input_device()
        .and_then(|d| d.name().ok())
        .unwrap_or_default();

    let mut devices = Vec::new();

    if let Ok(input_devices) = host.input_devices() {
        for device in input_devices {
            let name = match device.name() {
                Ok(n) => n,
                Err(_) => continue,
            };

            let config = device
                .default_input_config()
                .unwrap_or_else(|_| {
                    cpal::SupportedStreamConfig::new(
                        1,
                        cpal::SampleRate(44100),
                        cpal::SupportedBufferSize::Unknown,
                        cpal::SampleFormat::F32,
                    )
                });

            let is_default = name == default_device_name;
            let is_external = detect_external_mic(&name);

            devices.push(AudioDevice {
                id: name.clone(),
                name: format_device_name(&name),
                is_default,
                is_external,
                sample_rate: config.sample_rate().0,
                channels: config.channels(),
            });
        }
    }

    // Sort: external mics first, then default, then others
    devices.sort_by(|a, b| {
        b.is_external
            .cmp(&a.is_external)
            .then(b.is_default.cmp(&a.is_default))
    });

    devices
}

fn detect_external_mic(name: &str) -> bool {
    let lower = name.to_lowercase();
    let external_keywords = [
        "usb", "razor", "razer", "blue", "yeti", "snowball", "hyperx",
        "rode", "shure", "audio-technica", "at2020", "at2035",
        "samson", "fifine", "elgato", "wave", "scarlett", "focusrite",
        "behringer", "presonus", "universal audio", "apogee",
        "neumann", "akg", "sennheiser", "beyerdynamic",
        "zoom", "tascam", "m-audio", "motu", "steinberg",
        "external", "microphone", "headset",
    ];

    external_keywords.iter().any(|kw| lower.contains(kw))
}

fn format_device_name(name: &str) -> String {
    // Clean up device names for display
    let name = name.trim();

    // Remove common prefixes
    let prefixes = ["Input - ", "Microphone - ", "Mic - "];
    let mut cleaned = name.to_string();
    for prefix in prefixes {
        if let Some(stripped) = cleaned.strip_prefix(prefix) {
            cleaned = stripped.to_string();
            break;
        }
    }

    // Truncate very long names on a char boundary. String::truncate panics if
    // the cut lands mid-UTF-8-codepoint, which crashes device enumeration for
    // localized device names (accented / non-Latin characters).
    if cleaned.chars().count() > 50 {
        cleaned = cleaned.chars().take(47).collect::<String>();
        cleaned.push_str("...");
    }

    cleaned
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_device_name_truncates_unicode_without_panic() {
        // Regression: String::truncate on a non-char-boundary used to panic and
        // crash device enumeration for localized device names.
        let name = "é".repeat(60); // 60 chars, 120 bytes, multi-byte
        let out = format_device_name(&name);
        assert!(out.ends_with("..."));
        assert_eq!(out.chars().count(), 50); // 47 chars + "..."
    }

    #[test]
    fn format_device_name_strips_prefix_and_keeps_short_names() {
        assert_eq!(format_device_name("Microphone - Blue Yeti"), "Blue Yeti");
        assert_eq!(format_device_name("  Built-in Mic  "), "Built-in Mic");
    }
}

pub fn get_device_by_id(device_id: &str) -> Option<cpal::Device> {
    let host = cpal::default_host();

    if let Ok(devices) = host.input_devices() {
        for device in devices {
            if let Ok(name) = device.name() {
                if name == device_id {
                    return Some(device);
                }
            }
        }
    }

    None
}

pub fn get_default_device() -> Option<cpal::Device> {
    let host = cpal::default_host();
    host.default_input_device()
}

/// Returns whether a device with this id (name) is currently enumerable.
/// Used by the capture watchdog to detect unplug / power-off without relying
/// on cpal's stream-error callback, which some drivers never fire.
pub fn device_exists(id: &str) -> bool {
    get_device_by_id(id).is_some()
}

/// Best device to use when there is no preference, or the preferred device
/// has gone away: external mics win over the OS default (`enumerate_devices`
/// already sorts external-first), so a professional's USB mic is always
/// preferred over a built-in laptop mic without the user having to say so.
pub fn get_best_device_id() -> Option<String> {
    enumerate_devices().into_iter().next().map(|d| d.id)
}

/// Resolve the device to actually capture from. Returns the device, its id,
/// and whether this was a fallback away from the caller's preference (either
/// because none was set, or because the preferred device is no longer
/// connected — e.g. unplugged or its power/mute button was toggled off).
pub fn resolve_input_device(preferred: Option<&str>) -> Option<(cpal::Device, String, bool)> {
    if let Some(id) = preferred {
        if let Some(device) = get_device_by_id(id) {
            return Some((device, id.to_string(), false));
        }
    }
    let best_id = get_best_device_id()?;
    let device = get_device_by_id(&best_id)?;
    Some((device, best_id, true))
}
