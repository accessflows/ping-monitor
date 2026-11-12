#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ping_monitor_lib::run()
}
