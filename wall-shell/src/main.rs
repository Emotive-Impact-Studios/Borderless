#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // The shared front end owns every visible surface. No filesystem, process,
    // shell or room-authority commands are exposed to the remote room page.
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("Borderless Wall could not start");
}
