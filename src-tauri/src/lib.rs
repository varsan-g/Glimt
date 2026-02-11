use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

fn log_err<T>(context: &str, result: Result<T, impl std::fmt::Display>) {
    if let Err(e) = result {
        eprintln!("[Glimt] {context}: {e}");
    }
}

fn toggle_capture_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("capture") {
        if window.is_visible().unwrap_or(false) {
            log_err("hide capture", window.hide());
        } else {
            log_err("show capture", window.show());
            log_err("focus capture", window.set_focus());
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // ── System tray ──────────────────────────────────────
            let open_i = MenuItem::with_id(app, "open", "Open Glimt", true, None::<&str>)?;
            let capture_i = MenuItem::with_id(app, "capture", "Quick Capture", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_i, &capture_i, &quit_i])?;

            let icon = app
                .default_window_icon()
                .expect("App icon must be set in tauri.conf.json")
                .clone();
            let _tray = TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app: &AppHandle, event: tauri::menu::MenuEvent| {
                    match event.id.as_ref() {
                        "open" => {
                            if let Some(window) = app.get_webview_window("main") {
                                log_err("show window", window.show());
                                log_err("focus window", window.set_focus());
                            }
                        }
                        "capture" => {
                            toggle_capture_window(app);
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray: &tauri::tray::TrayIcon, event: TrayIconEvent| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            log_err("unminimize window", window.unminimize());
                            log_err("show window", window.show());
                            log_err("focus window", window.set_focus());
                        }
                    }
                })
                .build(app)?;

            // ── Hide main window on close (stays in tray) ────────
            if let Some(main_window) = app.get_webview_window("main") {
                let main = main_window.clone();
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        log_err("hide main on close", main.hide());
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Failed to start Glimt — is WebView2 installed?");
}
