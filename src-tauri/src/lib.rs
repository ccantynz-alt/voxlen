mod audio;
mod commands;
mod license;
mod secrets;
mod stt;
mod text_injection;

use tauri::{
    Emitter,
    Manager,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
};
use tauri_plugin_autostart::MacosLauncher;

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

            // Initialize the audio engine
            let audio_engine = audio::AudioEngine::new(app_handle.clone());
            app.manage(audio::AudioState::new(audio_engine));

            // Initialize the STT engine
            let stt_engine = stt::SttEngine::new(app_handle.clone());
            app.manage(stt::SttState::new(stt_engine));

            // Initialize the text injection engine
            let injector = text_injection::TextInjector::new();
            app.manage(text_injection::InjectorState::new(injector));

            // Build system tray menu
            let show_item = MenuItem::with_id(app, "show", "Show Marco Reid Voice", true, None::<&str>)?;
            let dictate_item = MenuItem::with_id(app, "dictate", "Start Dictation", true, None::<&str>)?;
            let grammar_item = MenuItem::with_id(app, "grammar", "Grammar Panel", true, None::<&str>)?;
            let separator = MenuItem::with_id(app, "sep", "────────────", false, None::<&str>)?;
            let settings_item = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Marco Reid Voice", true, None::<&str>)?;

            let menu = Menu::with_items(
                app,
                &[
                    &show_item,
                    &separator,
                    &dictate_item,
                    &grammar_item,
                    &settings_item,
                    &MenuItem::with_id(app, "sep2", "────────────", false, None::<&str>)?,
                    &quit_item,
                ],
            )?;

            let _tray = TrayIconBuilder::new()
                .tooltip("Marco Reid Voice - platform input layer for legal and accounting")
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

            log::info!("Marco Reid Voice initialized successfully");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Audio commands
            commands::audio::list_audio_devices,
            commands::audio::get_selected_device,
            commands::audio::set_audio_device,
            commands::audio::get_input_level,
            // Dictation commands
            commands::dictation::start_dictation,
            commands::dictation::stop_dictation,
            commands::dictation::pause_dictation,
            commands::dictation::get_dictation_status,
            // STT commands
            commands::stt::get_stt_engines,
            commands::stt::set_stt_engine,
            commands::stt::get_stt_config,
            commands::stt::set_stt_config,
            // Grammar commands
            commands::grammar::correct_grammar,
            commands::grammar::get_grammar_config,
            commands::grammar::set_grammar_config,
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
            // Permission commands
            commands::permissions::check_permissions,
            commands::permissions::request_admin_permissions,
            // License commands
            commands::license::get_license_status,
            commands::license::activate_license,
            commands::license::clear_license,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Minimize to tray instead of closing
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Marco Reid Voice");
}
