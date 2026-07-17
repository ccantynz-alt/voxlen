mod audio;
mod commands;
mod grammar;
mod meeting;
mod models;
mod stt;
mod text_injection;

use tauri::{
    Emitter,
    Manager,
    menu::{CheckMenuItem, Menu, MenuItem},
    tray::TrayIconBuilder,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_store::StoreExt;

/// Id of the main tray icon so backend code (gate, arm/disarm) can update
/// its tooltip via `app.tray_by_id(TRAY_ID)`.
pub const TRAY_ID: &str = "main-tray";

/// Handles to tray menu items that backend code needs to keep in sync.
pub struct TrayState {
    pub always_ready_item: CheckMenuItem<tauri::Wry>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Hydrate settings from disk before the window opens so the
            // frontend sees the persisted values on first query.
            if let Err(e) = commands::settings::load_settings_from_disk(app_handle.clone()) {
                log::warn!("Failed to load settings from disk: {}", e);
            }

            // Initialize the audio engine.
            let audio_engine = audio::AudioEngine::new(app_handle.clone());
            app.manage(audio::AudioState::new(audio_engine));

            // Initialize the STT engine and session state.
            // The audio→STT pipeline is wired per-session in start_dictation.
            let stt_engine = stt::SttEngine::new(app_handle.clone());
            app.manage(stt::SttState::new(stt_engine));
            app.manage(stt::SttSessionState::new());
            app.manage(meeting::MeetingState::default());

            // Push the just-loaded settings into the STT + grammar engines so
            // API keys flow all the way through before the user's first hotkey.
            commands::settings::apply_loaded_settings_to_engines(&app_handle);

            // Initialize the text injection engine
            let injector = text_injection::TextInjector::new();
            app.manage(text_injection::InjectorState::new(injector));

            // Read the frontend-owned settings store READ-ONLY (camelCase keys)
            // for the two boot-time flags Rust must act on before the frontend
            // pushes settings. Fail-visible: any error behaves as defaults.
            let (start_minimized, always_ready_enabled) = app
                .store("settings.json")
                .ok()
                .and_then(|store| store.get("settings"))
                .map(|v| {
                    (
                        v.get("startMinimized").and_then(|b| b.as_bool()).unwrap_or(false),
                        v.get("alwaysReadyMode").and_then(|b| b.as_bool()).unwrap_or(false),
                    )
                })
                .unwrap_or((false, false));

            // Build system tray menu
            let show_item = MenuItem::with_id(app, "show", "Show Voxlen", true, None::<&str>)?;
            let dictate_item = MenuItem::with_id(app, "dictate", "Start Dictation", true, None::<&str>)?;
            let always_ready_item = CheckMenuItem::with_id(
                app,
                "always_ready",
                "Always-Ready Dictation",
                true,
                always_ready_enabled,
                None::<&str>,
            )?;
            let grammar_item = MenuItem::with_id(app, "grammar", "Grammar Panel", true, None::<&str>)?;
            let separator = MenuItem::with_id(app, "sep", "────────────", false, None::<&str>)?;
            let settings_item = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Voxlen", true, None::<&str>)?;

            let menu = Menu::with_items(
                app,
                &[
                    &show_item,
                    &separator,
                    &dictate_item,
                    &always_ready_item,
                    &grammar_item,
                    &settings_item,
                    &MenuItem::with_id(app, "sep2", "────────────", false, None::<&str>)?,
                    &quit_item,
                ],
            )?;

            app.manage(TrayState {
                always_ready_item: always_ready_item.clone(),
            });

            let always_ready_for_menu = always_ready_item.clone();
            let _tray = TrayIconBuilder::with_id(TRAY_ID)
                .tooltip("Voxlen — AI voice dictation for legal and accounting professionals")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "dictate" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = window.emit("navigate", "dictation");
                            }
                        }
                        "always_ready" => {
                            // CheckMenuItem toggles itself; forward the new
                            // state to the frontend, which flips the setting —
                            // persistence + engine arming all flow through the
                            // single update_settings path.
                            let checked = always_ready_for_menu.is_checked().unwrap_or(false);
                            let _ = app.emit("always-ready-toggle", checked);
                        }
                        "grammar" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = window.emit("navigate", "grammar");
                            }
                        }
                        "settings" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = window.emit("navigate", "settings");
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::DoubleClick { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Honor start_minimized: hide the main window after everything is
            // wired. The webview still loads (it drives settings push and the
            // Always-Ready arming), the window just isn't shown.
            if start_minimized {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }

            log::info!("Voxlen initialized successfully");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Audio commands
            commands::audio::list_audio_devices,
            commands::audio::get_selected_device,
            commands::audio::set_audio_device,
            commands::audio::get_input_level,
            commands::audio::get_active_device,
            // Dictation commands
            commands::dictation::start_dictation,
            commands::dictation::stop_dictation,
            commands::dictation::pause_dictation,
            commands::dictation::resume_dictation,
            commands::dictation::get_dictation_status,
            commands::dictation::get_always_ready_state,
            commands::documents::save_document,
            // Whisper Local model manager
            commands::whisper::list_whisper_models,
            commands::whisper::download_whisper_model,
            commands::whisper::delete_whisper_model,
            commands::whisper::has_whisper_model,
            // STT commands
            commands::stt::get_stt_engines,
            commands::stt::set_stt_engine,
            commands::stt::get_stt_config,
            commands::stt::set_stt_config,
            // Grammar commands
            commands::grammar::correct_grammar,
            commands::grammar::get_grammar_config,
            commands::grammar::set_grammar_config,
            // Translation
            commands::translate::translate_text,
            // Text injection commands
            commands::text_injection::inject_text,
            commands::text_injection::get_injection_mode,
            commands::text_injection::set_injection_mode,
            // Settings commands
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::settings::reset_settings,
            commands::settings::load_settings_from_disk,
            // History commands
            commands::history::save_session,
            commands::history::get_history,
            commands::history::get_session,
            commands::history::delete_session,
            commands::history::clear_history,
            commands::history::search_history,
            // Window commands
            commands::window::minimize_to_tray,
            commands::window::toggle_window,
            commands::window::open_url,
            // Permission commands
            commands::permissions::check_permissions,
            commands::permissions::request_admin_permissions,
            // Secure keyring commands
            commands::keyring::keyring_get,
            commands::keyring::keyring_set,
            commands::keyring::keyring_delete,
            // Grammar LLM model manager (on-device Tier-2 polish)
            grammar::llm_models::list_grammar_models,
            grammar::llm_models::download_grammar_model,
            grammar::llm_models::delete_grammar_model,
            grammar::llm_models::has_grammar_model,
            // Meeting capture (bot-free, on-device, consent-gated)
            commands::meeting::meeting_capture_supported,
            commands::meeting::meeting_capture_active,
            commands::meeting::start_meeting_capture,
            commands::meeting::stop_meeting_capture,
            meeting::extract::extract_meeting_items,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Minimize to tray instead of closing
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Voxlen");
}
