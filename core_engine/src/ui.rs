use eframe::egui;
use crate::vision::{self, VisionBox};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_name = wasmShowTrainingUI)]
    async fn wasm_show_training_ui(json_str: String) -> wasm_bindgen::JsValue;
}

// Cấu trúc giữ trạng thái (State) của UI
#[derive(Default)]
pub struct CheatMenuApp {
    // Tạm thời để một biến test. Lát nữa có logic ta sẽ nhét thêm vào đây.
    scan_value: String, 
    current_box: Option<VisionBox>
}

impl eframe::App for CheatMenuApp {
    // Hàm update này được eframe gọi liên tục 60 lần/giây (60 FPS)
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        self.current_box = crate::CURRENT_VBOX.with(|v| *v.borrow());
        
        // Vẽ một cái Window nổi trên màn hình
        egui::Window::new("WASM Hacker 9000")
            .default_pos([20.0, 20.0]) // Thay thế cho top: 20px, left: 20px
            .default_size([320.0, 220.0]) // Thay thế cho width/height
            .resizable(true)
            .show(ctx, |ui| {
                
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
                    // Chỗ này sau này sẽ gọi hàm Memory bên file logic
                    web_sys::console::log_1(&"Scan initiated!".into());
                }

                ui.separator();
                
                // --- Tương đương getConsoleLogUI() ---
                ui.label("Log: Waiting for command...");

                ui.heading("Vision & Memory Engine");
                ui.separator(); 

                if let Some(vbox) = &self.current_box {
                    ui.label(format!("📍 Area: [x:{}, y:{}] Size: {}x{}", vbox.x, vbox.y, vbox.w, vbox.h));
                } else {
                    ui.label("📍 Area: Not selected");
                }

                if ui.button("🎯 Select Scan Area").clicked() {
                    web_sys::console::log_1(&"DEBUG: Button Clicked!".into());

                    wasm_bindgen_futures::spawn_local(async move {
                        crate::logger("📡 Waiting for user selection...");
                        
                        match vision::request_area_selection().await {
                            Some(new_box) => {
                                crate::update_vision_box(new_box);
                            },
                            None => crate::logger("⚠️ Selection cancelled or failed."),
                        }
                    });
                }

                if ui.button("Capture & Crop").clicked() {
                    if let Some(vbox) = self.current_box {
                        // Đẩy lệnh chụp ảnh vào task bất đồng bộ
                        wasm_bindgen_futures::spawn_local(async move {
                            crate::logger("⏳ Capturing... please wait.");

                            match vision::capture_and_crop(&vbox).await {
                                Ok((pixels, real_w, real_h)) => {
                                    let (result_text, unknowns_json) = crate::ocr::recognize_sequence(&pixels, real_w, real_h);

                                    if unknowns_json != "[]" {
                                        crate::logger("⚠️ Thấy font chữ lạ! Đang mở bảng Huấn luyện...");
                                        wasm_show_training_ui(unknowns_json).await; 
                                        crate::logger("🎓 Đã học thuộc bài! Bấm Capture lại nhé.");
                                    } else {
                                        crate::logger(&format!("✅ Kết quả: [ {} ]", result_text));
                                    }
                                },
                                Err(e) => crate::logger(&format!("❌ Error: {}", e)),
                            }
                        });
                    }
                }

                ui.separator();
                let current_log = crate::UI_LOG.with(|log| log.borrow().clone());
                ui.label(format!("Status: {}", current_log));
            });
    }
}