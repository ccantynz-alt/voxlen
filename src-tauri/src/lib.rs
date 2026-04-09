mod audio;
mod commands;
mod stt;
mod text_injection;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Initialize the audio engine
            let audio_engine = audio::AudioEngine::new(app_handle.clone());
            app.manage(audio::AudioState::new(audio_engine));

            // Initialize the STT engine
            let stt_engine = stt::SttEngine::new(app_handle.clone());
            app.manage(stt::SttState::new(stt_engine));

            // Initialize the text injection engine
            let injector = text_injection::TextInjector::new();
            app.manage(text_injection::InjectorState::new(injector));

            log::info!("Vox initialized successfully");
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
            // Window commands
            commands::window::minimize_to_tray,
            commands::window::toggle_window,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Minimize to tray instead of closing
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Vox");
}
