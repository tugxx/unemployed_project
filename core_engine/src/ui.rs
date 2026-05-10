use crate::vision::VisionBox;
use crate::{BridgePayload, BridgeResponse};
use eframe::egui;
use std::sync::mpsc::Receiver;

// ==========================================
// CẤU TRÚC APP (Chứa Trạng Thái & Đường Ống)
// ==========================================
pub struct CheatMenuApp {
    scan_value: String,
    current_box: Option<VisionBox>,
    log_msg: String,

    // Đường ống nhận dữ liệu từ Chrome đập xuống
    rx: Receiver<BridgePayload>,

    // Trạng thái cho bảng Training AI
    show_training_ui: bool,
    unknowns_data: String,
}

impl CheatMenuApp {
    // Hàm khởi tạo, nhận đầu ra của đường ống `rx` từ main.rs
    pub fn new(rx: Receiver<BridgePayload>) -> Self {
        Self {
            scan_value: String::new(),
            current_box: None,
            log_msg: "Waiting for command...".to_string(),
            rx,
            show_training_ui: false,
            unknowns_data: String::new(),
        }
    }
}

// ==========================================
// VÒNG LẶP VẼ UI (60 FPS)
// ==========================================
impl eframe::App for CheatMenuApp {
    fn clear_color(&self, _visuals: &egui::Visuals) -> [f32; 4] {
        [0.0, 0.0, 0.0, 0.8]
    }

    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        // 1. LIẾC NHÌN ĐƯỜNG ỐNG (NON-BLOCKING)
        // try_recv() sẽ lấy tin nhắn nếu có, không có thì chạy tiếp ngay lập tức
        while let Ok(payload) = self.rx.try_recv() {
            match payload.action.as_str() {
                "AREA_SELECTED" => {
                    // Chrome gửi tọa độ về
                    self.current_box = Some(VisionBox {
                        x: payload.x.unwrap_or(0.0) as i32,
                        y: payload.y.unwrap_or(0.0) as i32,
                        w: payload.w.unwrap_or(0.0) as i32,
                        h: payload.h.unwrap_or(0.0) as i32,
                    });
                    self.log_msg = "✅ Tọa độ đã được cập nhật từ Chrome!".to_string();
                }
                "CROP_RESULT" => {
                    // Chrome gửi mảng pixels về
                    self.log_msg = "✅ Đã nhận ảnh từ Chrome! Đang xử lý AI...".to_string();

                    let w = payload.w.unwrap_or(0.0) as usize;
                    let h = payload.h.unwrap_or(0.0) as usize;
                    let pixel_data = payload.pixels.unwrap_or_default();

                    let (result_text, unknowns_json) =
                        crate::ocr::recognize_sequence(&pixel_data, w, h);

                    if unknowns_json != "[]" {
                        self.log_msg = "⚠️ Thấy font chữ lạ! Mở bảng Training...".to_string();
                        self.unknowns_data = unknowns_json.to_string();
                        self.show_training_ui = true; // Bật cờ hiện popup
                    } else {
                        self.log_msg = format!("✅ OCR Xong! Kết quả: {}", result_text);
                    }
                }
                _ => {}
            }
        }

        let ctx = ui.ctx().clone();

        // Vẽ một cái Window nổi trên màn hình
        egui::Window::new("WASM Hacker 9000")
            .default_pos([20.0, 20.0])
            .default_size([320.0, 350.0])
            .resizable(true)
            .show(&ctx, |ui| {
                // --- Tương đương getHeaderUI() ---
                ui.heading("Memory Engine");
                ui.separator(); // Dòng kẻ ngang

                // --- Tương đương getScanSelectorsUI() ---
                ui.label("Scan Selectors (Coming soon)");

                // --- Tương đương getExactScanAreaUI() ---
                ui.horizontal(|ui| {
                    ui.label("Value:");
                    ui.text_edit_singleline(&mut self.scan_value);
                });

                // --- Tương đương getWriteAndFreezeUI() ---
                if ui.button("First Scan").clicked() {
                    self.log_msg = "Scan initiated (Native Memory)...".to_string();
                }

                ui.separator();

                ui.heading("Vision & OCR Engine");
                ui.separator();

                if let Some(vbox) = &self.current_box {
                    ui.label(format!(
                        "📍 Area: [x:{}, y:{}] Size: {}x{}",
                        vbox.x, vbox.y, vbox.w, vbox.h
                    ));
                } else {
                    ui.label("📍 Area: Not selected");
                }

                // ----------------------------------------------------
                // NÚT CHỌN VÙNG: BẮN LỆNH LÊN CHROME THAY VÌ TỰ LÀM
                // ----------------------------------------------------
                if ui.button("🎯 Select Scan Area").clicked() {
                    self.log_msg = "📡 Đang yêu cầu Chrome mở lớp Overlay...".to_string();

                    // Gửi qua stdout cho background.ts xử lý
                    crate::send_to_chrome(&BridgeResponse {
                        reqId: "cmd_select_area".to_string(), // ID cố định hoặc random
                        action: Some("REQUEST_SELECT_AREA".to_string()),
                        success: true,
                        error: None,
                        x: None,
                        y: None,
                        w: None,
                        h: None,
                    });
                }

                // ----------------------------------------------------
                // NÚT CHỤP ẢNH: YÊU CẦU CHROME CẮT ẢNH VÀ TRẢ VỀ RUST
                // ----------------------------------------------------
                if ui.button("Capture & Crop").clicked() {
                    if let Some(vbox) = self.current_box {
                        self.log_msg = "⏳ Yêu cầu Chrome gửi mảng Pixel...".to_string();

                        crate::send_to_chrome(&BridgeResponse {
                            reqId: "cmd_capture_crop".to_string(),
                            action: Some("REQUEST_CROP".to_string()),
                            success: true,
                            error: None,
                            x: Some(vbox.x),
                            y: Some(vbox.y),
                            w: Some(vbox.w),
                            h: Some(vbox.h),
                        });
                    } else {
                        self.log_msg = "⚠️ Hãy chọn vùng trước khi chụp!".to_string();
                    }
                }

                ui.separator();
                ui.label(format!("Status: {}", self.log_msg));
            });

        if self.show_training_ui {
            egui::Window::new("🎓 Huấn luyện AI Model")
                .collapsible(false)
                .resizable(false)
                .show(&ctx, |ui| {
                    ui.label("Đã phát hiện Hash mới chưa có trong từ điển.");
                    ui.label(format!("Dữ liệu thô: {}", self.unknowns_data));

                    ui.horizontal(|ui| {
                        if ui.button("Lưu vào Dict nội bộ").clicked() {
                            // Gọi crate::vision::save_to_local_dict()
                            self.show_training_ui = false;
                            self.log_msg = "🎓 Đã học thuộc bài! Hãy Capture lại.".to_string();
                        }
                        if ui.button("Hủy").clicked() {
                            self.show_training_ui = false;
                        }
                    });
                });
        }
    }
}
