use eframe::egui;
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::fs::OpenOptions;
use std::io::{self, Read, Write};
use std::panic;
use std::sync::mpsc;
use std::sync::{LazyLock, Mutex};
use std::thread;

pub mod ui;

mod inference;
mod ocr;
mod vision;

pub static GLOBAL_LOGS: LazyLock<Mutex<Vec<String>>> = LazyLock::new(|| Mutex::new(Vec::new()));
#[macro_export]
macro_rules! app_log {
    ($($arg:tt)*) => {{
        let msg = format!($($arg)*);
        // Khóa Mutex lại, nhét log vào, rồi tự động mở khóa
        if let Ok(mut logs) = $crate::GLOBAL_LOGS.lock() {
            logs.push(msg);
        }
    }};
}

#[allow(non_snake_case)]
#[derive(Deserialize, Debug)]
pub struct BridgePayload {
    pub action: String,
    pub reqId: Option<String>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub action: Option<String>,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub x: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub y: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub w: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub h: Option<i32>,
}

// ==========================================
// HÀM GỬI DỮ LIỆU NGƯỢC LẠI CHROME
// ==========================================
pub fn send_to_chrome(response: &BridgeResponse) -> Result<(), Box<dyn Error>> {
    let json_str = serde_json::to_string(response).unwrap();
    let msg_bytes = json_str.as_bytes();
    let len_bytes = (msg_bytes.len() as u32).to_ne_bytes(); // Header 4-byte

    let mut stdout = io::stdout();
    // Gửi Header trước
    stdout.write_all(&len_bytes)?;
    // Gửi JSON Payload sau
    stdout.write_all(msg_bytes)?;
    // Đẩy dữ liệu đi
    stdout.flush()?;

    // Báo cáo thành công
    Ok(())
}

pub fn setup_panic_logger() {
    // Chiếm quyền điều khiển hàm xử lý Panic mặc định của Rust
    panic::set_hook(Box::new(|panic_info| {
        // Mở file rust_crash_log.txt, nếu chưa có thì tạo mới, có rồi thì ghi nối tiếp
        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open("rust_crash_log.txt")
        {
            // Bóc tách thông báo lỗi
            let msg = match panic_info.payload().downcast_ref::<&'static str>() {
                Some(s) => *s,
                None => match panic_info.payload().downcast_ref::<String>() {
                    Some(s) => &s[..],
                    None => "Lỗi không xác định (Unknown Panic)",
                },
            };

            // Lấy vị trí dòng code gây ra lỗi
            let location = panic_info.location().unwrap();

            // Format thành đoạn text cho dễ đọc
            let log_msg = format!(
                "=========================================\n\
                 🔥 APP BỊ SẬP (PANIC)!\n\
                 📍 Vị trí lỗi: {}:{}\n\
                 💬 Lời nhắn: {}\n\
                 =========================================\n\n",
                location.file(),
                location.line(),
                msg
            );

            // Ghi ra file
            let _ = file.write_all(log_msg.as_bytes());
        }
    }));
}

// ==========================================
// HÀM MAIN: KHỞI ĐỘNG HỆ THỐNG
// ==========================================
fn main() -> eframe::Result<()> {
    setup_panic_logger();

    // 3. THIẾT LẬP CỬA SỔ DESKTOP (MAIN THREAD)
    // Tạm biệt thẻ Canvas, giờ là cửa sổ System chuẩn chỉ!
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([400.0, 300.0])
            .with_title("System Mod Engine")
            .with_always_on_top(), // Luôn nổi trên game
        ..Default::default()
    };

    // Khởi chạy eframe. Chú ý: Ta phải truyền `rx` (Đầu ra của đường ống) vào UI
    eframe::run_native(
        "System Mod Engine",
        options,
        Box::new(|cc| {
            // --- BẮT ĐẦU ĐOẠN FIX FONT TIẾNG VIỆT ---
            let mut fonts = egui::FontDefinitions::default();

            // Đọc file font từ ổ cứng lúc biên dịch và nạp vào bộ nhớ
            fonts.font_data.insert(
                "my_font".to_owned(),
                std::sync::Arc::new(egui::FontData::from_static(include_bytes!(
                    "../assets/Roboto-VariableFont_wdth,wght.ttf"
                ))),
            );

            // Ưu tiên dùng font này cho mọi loại text
            fonts
                .families
                .entry(egui::FontFamily::Proportional)
                .or_default()
                .insert(0, "my_font".to_owned());
            fonts
                .families
                .entry(egui::FontFamily::Monospace)
                .or_default()
                .insert(0, "my_font".to_owned());

            // Nạp font vào context của egui
            cc.egui_ctx.set_fonts(fonts);
            // --- KẾT THÚC ĐOẠN FIX FONT ---

            // 1. Lấy "Chuông báo thức" của UI
            let ctx_clone = cc.egui_ctx.clone();

            let (tx, rx) = mpsc::channel::<BridgePayload>();

            // 2. Tạo luồng đọc stdin
            thread::spawn(move || {
                loop {
                    let mut len_bytes = [0u8; 4];
                    if io::stdin().read_exact(&mut len_bytes).is_err() {
                        std::process::exit(0);
                    }
                    let len = u32::from_ne_bytes(len_bytes) as usize;
                    let mut buffer = vec![0u8; len];
                    if io::stdin().read_exact(&mut buffer).is_err() {
                        std::process::exit(0);
                    }

                    match serde_json::from_slice::<BridgePayload>(&buffer) {
                        Ok(payload) => {
                            tx.send(payload).unwrap(); // Bỏ vào đường ống
                            ctx_clone.request_repaint(); // Đánh thức UI
                        }
                        Err(e) => {
                            // NẾU PARSE LỖI, GHI NGAY RA FILE ĐỂ DEBUG
                            let raw_json = String::from_utf8_lossy(&buffer);
                            let error_msg =
                                format!("❌ LỖI SERDE: {}\n📦 RAW JSON: {}\n\n", e, raw_json);

                            // Mở (hoặc tạo) file log.txt nằm cùng thư mục với file .exe
                            use std::io::Write;
                            if let Ok(mut file) = std::fs::OpenOptions::new()
                                .create(true)
                                .append(true)
                                .open("native_error_log.txt")
                            {
                                file.write_all(error_msg.as_bytes()).ok();
                            }
                        }
                    }
                }
            });

            // 4. Trả UI về cho eframe
            Ok(Box::new(crate::ui::CheatMenuApp::new(rx)))
        }),
    )
}
