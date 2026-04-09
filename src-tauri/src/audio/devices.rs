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

    // Truncate very long names
    if cleaned.len() > 50 {
        cleaned.truncate(47);
        cleaned.push_str("...");
    }

    cleaned
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
