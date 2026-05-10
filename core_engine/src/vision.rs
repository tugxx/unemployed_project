use std::collections::HashMap;
use std::fs;

// Struct lưu trữ tọa độ thay cho globalThis.visionBox
#[derive(Clone, Copy)]
pub struct VisionBox {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

// ==========================================
// QUẢN LÝ TỪ ĐIỂN TẠI LOCAL (Thay cho Chrome Storage)
// ==========================================
#[allow(dead_code)]
const DICT_PATH: &str = "dictionary.json";

#[allow(dead_code)]
// Đọc từ điển từ file JSON trên ổ cứng
pub fn load_local_dict() -> HashMap<String, char> {
    fs::read_to_string(DICT_PATH)
        .ok()
        .and_then(|data| serde_json::from_str(&data).ok())
        .unwrap_or_default()
}

#[allow(dead_code)]
// Ghi đè từ điển mới xuống ổ cứng
pub fn save_local_dict(dict: &HashMap<String, char>) {
    if let Ok(data) = serde_json::to_string_pretty(dict) {
        let _ = fs::write(DICT_PATH, data);
    }
}
