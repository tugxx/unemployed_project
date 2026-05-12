use crate::vision::VisionBox;
use crate::{BridgePayload, app_log};
use eframe::egui;
use image::RgbaImage;
use std::sync::mpsc;
use std::sync::mpsc::Receiver;

pub mod overlay;
pub mod panels;
pub mod training;

#[derive(Default, Clone)]
pub struct OcrDebugBag {
    pub width: usize,
    pub height: usize,
    pub gray_pixels: Vec<u8>,
    pub binary_pixels: Vec<u8>,
    pub boxes: Vec<(usize, usize, usize, usize)>,
    pub lines: Vec<(Vec<u8>, usize, usize)>,
    pub line_inputs: Vec<String>,
    pub line_textures: Vec<egui::TextureHandle>,
}

// ==========================================
// CẤU TRÚC APP (Chứa Trạng Thái & Đường Ống)
// ==========================================
pub struct CheatMenuApp {
    scan_value: String,
    current_box: Option<VisionBox>,

    // Đường ống nhận dữ liệu từ Chrome đập xuống
    rx: Receiver<BridgePayload>,

    // Trạng thái cho bảng Training AI
    show_training_ui: bool,
    unknowns_data: String,

    is_selecting_area: bool,        // Cờ đánh dấu đang trong chế độ ngắm bắn
    drag_start: Option<egui::Pos2>, // Lưu tọa độ lúc bấm chuột xuống

    // 1. Cờ bật tắt cửa sổ Debug ảnh
    pub show_debug_image: bool,
    // 2. Biến chứa ảnh đã nạp vào GPU (Phải dùng Option vì lúc mới mở app chưa có ảnh)
    pub debug_texture: Option<egui::TextureHandle>,
    pub request_capture_flag: bool,
    pub native_img_tx: mpsc::Sender<RgbaImage>,
    pub native_img_rx: mpsc::Receiver<RgbaImage>,
    pub capture_countdown: Option<u8>,

    pub debug_raw_texture: Option<egui::TextureHandle>,
    pub debug_gray_texture: Option<egui::TextureHandle>,
    pub debug_binary_texture: Option<egui::TextureHandle>,
    pub debug_bag: Option<OcrDebugBag>,

    pub debug_zoom: f32,
    pub debug_label_input: String,

    pub lines: Vec<(Vec<u8>, usize, usize)>,
}

impl CheatMenuApp {
    // Hàm khởi tạo, nhận đầu ra của đường ống `rx` từ main.rs
    pub fn new(rx: Receiver<BridgePayload>) -> Self {
        let (img_tx, img_rx) = std::sync::mpsc::channel();

        Self {
            scan_value: String::new(),
            current_box: None,
            rx,
            show_training_ui: false,
            unknowns_data: String::new(),
            is_selecting_area: false,
            drag_start: None,
            show_debug_image: false,
            debug_texture: None,
            request_capture_flag: false,
            native_img_tx: img_tx,
            native_img_rx: img_rx,
            capture_countdown: None,
            debug_raw_texture: None,
            debug_gray_texture: None,
            debug_binary_texture: None,
            debug_bag: None,
            debug_zoom: 1.0,
            debug_label_input: String::new(),
            lines: Vec::new(),
        }
    }

    fn handle_incoming_messages(&mut self, ctx: &egui::Context) {
        while let Ok(payload) = self.rx.try_recv() {
            if payload.action.as_str() == "CROP_RESULT" {
                // Chrome gửi mảng pixels về
                app_log!("✅ Đã nhận ảnh từ Chrome! Đang xử lý AI...");

                let w = payload.w.unwrap_or(0.0) as usize;
                let h = payload.h.unwrap_or(0.0) as usize;
                let raw_pixels = payload.pixels.unwrap_or_default();

                // 1. Kiểm tra an toàn: Đảm bảo số lượng pixel khớp với kích thước w * h * 4 (R,G,B,A)
                if w > 0 && h > 0 && raw_pixels.len() == w * h * 4 {
                    // 2. Tạo hình ảnh màu từ mảng raw
                    let color_image = egui::ColorImage::from_rgba_unmultiplied([w, h], &raw_pixels);

                    // 3. Nạp thẳng lên GPU và lưu vào State
                    self.debug_texture = Some(ctx.load_texture(
                        "debug_crop_img",
                        color_image,
                        egui::TextureOptions::LINEAR, // Giữ độ mượt, hoặc NEAREST nếu muốn soi pixel rỗ
                    ));

                    app_log!("✅ Nạp ảnh Debug thành công! Đang chạy OCR...");

                    // Tự động bật bảng Debug khi có ảnh mới (Tùy chọn, bác có thể bỏ dòng này)
                    self.show_debug_image = true;
                } else {
                    app_log!("❌ Lỗi: Dữ liệu pixel bị vỡ hoặc kích thước sai!");
                }

                // let (result_text, unknowns_json) =
                //     crate::ocr::recognize_sequence(&raw_pixels, w, h);

                // if unknowns_json != "[]" {
                //     self.logs
                //         .push("⚠️ Thấy font chữ lạ! Mở bảng Training...".to_string());
                //     self.unknowns_data = unknowns_json.to_string();
                //     self.show_training_ui = true; // Bật cờ hiện popup
                // } else {
                //     self.logs
                //         .push(format!("✅ OCR Xong! Kết quả: {}", result_text));
                // }
            }
        }

        // 2. Check ống của màn hình OS (XCap Native)
        while let Ok(native_img) = self.native_img_rx.try_recv() {
            let w = native_img.width() as usize;
            let h = native_img.height() as usize;

            app_log!("✅ Chụp Native thành công! Size: {}x{}", w, h);

            // 1. Chuyển RgbaImage thành mảng pixel thô
            let raw_pixels = native_img.into_raw();

            // 2. Chuyển thành định dạng ColorImage của egui
            let color_image = egui::ColorImage::from_rgba_unmultiplied([w, h], &raw_pixels);

            // 3. Nạp lên GPU và lưu cái TextureHandle vào biến debug_texture
            self.debug_texture =
                Some(ctx.load_texture("debug_crop_img", color_image, egui::TextureOptions::LINEAR));

            app_log!("✅ Nạp ảnh Debug thành công! Đang chạy OCR...");

            // Tự động bật bảng Debug khi có ảnh mới
            self.show_debug_image = true;

            let mut my_bag = OcrDebugBag::default();
            let (result_text, unknowns_json) =
                crate::ocr::recognize_sequence(&raw_pixels, w, h, Some(&mut my_bag));

            let raw_size = [w, h];
            self.debug_raw_texture = Some(ctx.load_texture(
                "raw",
                egui::ColorImage::from_rgba_unmultiplied(raw_size, &raw_pixels),
                egui::TextureOptions::NEAREST,
            ));

            let upscaled_size = [my_bag.width, my_bag.height];
            self.debug_gray_texture = Some(ctx.load_texture(
                "gray",
                egui::ColorImage::from_gray(upscaled_size, &my_bag.gray_pixels),
                egui::TextureOptions::NEAREST,
            ));

            self.debug_binary_texture = Some(ctx.load_texture(
                "binary",
                egui::ColorImage::from_gray(upscaled_size, &my_bag.binary_pixels),
                egui::TextureOptions::NEAREST,
            ));

            self.debug_bag = Some(my_bag);
        }
    }
}

// ==========================================
// VÒNG LẶP VẼ UI (60 FPS)
// ==========================================
impl eframe::App for CheatMenuApp {
    fn clear_color(&self, _visuals: &egui::Visuals) -> [f32; 4] {
        [0.0, 0.0, 0.0, 0.0]
    }

    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        let ctx = ui.ctx().clone();

        // 1. LIẾC NHÌN ĐƯỜNG ỐNG (NON-BLOCKING)
        self.handle_incoming_messages(&ctx);

        if ui.input(|i| i.key_pressed(egui::Key::Escape)) {
            self.is_selecting_area = false;
            self.current_box = None;
            self.drag_start = None;
        }

        panels::draw_memory_engine(self, ui);
        panels::draw_vision_engine(self, ui);
        panels::draw_logs(self, ui);

        panels::show_debug_viewport(self, &ctx);
        overlay::show_ghost_window(self, &ctx);
        training::show_training_window(self, &ctx);
    }
}
