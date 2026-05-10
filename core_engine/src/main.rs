use eframe::egui;
use serde::{Deserialize, Serialize};
use std::io::{self, Read, Write};
use std::sync::mpsc;
use std::thread;

mod inference;
mod ocr;
mod ui;
mod vision;

#[allow(non_snake_case)]
#[derive(Deserialize, Debug)]
pub struct BridgePayload {
    pub reqId: String,
    pub action: String,
    pub x: Option<f32>,
    pub y: Option<f32>,
    pub w: Option<f32>,
    pub h: Option<f32>,
    pub pixels: Option<Vec<u8>>,
}

#[allow(non_snake_case)]
#[derive(Serialize, Debug)]
pub struct BridgeResponse {
    pub reqId: String,
    pub action: Option<String>,
    pub success: bool,
    pub error: Option<String>,
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub w: Option<i32>,
    pub h: Option<i32>,
}

// ==========================================
// HÀM GỬI DỮ LIỆU NGƯỢC LẠI CHROME
// ==========================================
pub fn send_to_chrome(response: &BridgeResponse) {
    let json_str = serde_json::to_string(response).unwrap();
    let msg_bytes = json_str.as_bytes();
    let len_bytes = (msg_bytes.len() as u32).to_ne_bytes(); // Header 4-byte

    let mut stdout = io::stdout();
    // Gửi Header trước
    stdout.write_all(&len_bytes).unwrap();
    // Gửi JSON Payload sau
    stdout.write_all(msg_bytes).unwrap();
    stdout.flush().unwrap();
}

// ==========================================
// HÀM MAIN: KHỞI ĐỘNG HỆ THỐNG
// ==========================================
fn main() -> eframe::Result<()> {
    // 3. THIẾT LẬP CỬA SỔ DESKTOP (MAIN THREAD)
    // Tạm biệt thẻ Canvas, giờ là cửa sổ System chuẩn chỉ!
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([400.0, 300.0])
            .with_title("System Hacker Engine")
            .with_always_on_top(), // Luôn nổi trên game
        ..Default::default()
    };

    // Khởi chạy eframe. Chú ý: Ta phải truyền `rx` (Đầu ra của đường ống) vào UI
    eframe::run_native(
        "Cheat Engine Core",
        options,
        Box::new(|cc| {
            // 1. Lấy "Chuông báo thức" của UI
            let ctx_clone = cc.egui_ctx.clone();

            let (tx, rx) = mpsc::channel::<BridgePayload>();

            // 2. Tạo luồng đọc stdin
            thread::spawn(move || {
                loop {
                    let mut len_bytes = [0u8; 4];
                    if io::stdin().read_exact(&mut len_bytes).is_err() {
                        break;
                    }
                    let len = u32::from_ne_bytes(len_bytes) as usize;
                    let mut buffer = vec![0u8; len];
                    if io::stdin().read_exact(&mut buffer).is_err() {
                        break;
                    }

                    if let Ok(payload) = serde_json::from_slice::<BridgePayload>(&buffer) {
                        tx.send(payload).unwrap(); // Bỏ vào đường ống

                        // 3. RUNG CHUÔNG BÁO THỨC! Đánh thức luồng UI dậy ngay lập tức
                        ctx_clone.request_repaint();
                    }
                }
            });

            // 4. Trả UI về cho eframe
            Ok(Box::new(crate::ui::CheatMenuApp::new(rx)))
        }),
    )
}
