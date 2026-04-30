use wasm_bindgen::prelude::*;
use web_sys::console;
use std::cell::RefCell;
use js_sys::Function;

mod ui;
mod vision;
mod ocr;

thread_local! {
    pub static VISION_CALLBACK: RefCell<Option<Function>> = RefCell::new(None);
    pub static UI_LOG: RefCell<String> = RefCell::new("Waiting for command...".to_string());
    pub static CURRENT_VBOX: RefCell<Option<vision::VisionBox>> = RefCell::new(None);
}

pub fn logger(msg: &str) {
    // 1. Gửi vào Console trình duyệt
    web_sys::console::log_1(&msg.into());
    
    // 2. Ghi đè vào hộp thư để UI hiển thị
    UI_LOG.with(|log| {
        *log.borrow_mut() = msg.to_string();
    });
}

pub fn update_vision_box(vbox: vision::VisionBox) {
    CURRENT_VBOX.with(|box_cell| {
        *box_cell.borrow_mut() = Some(vbox);
    });
    logger("✅ Selection area updated!");
}

#[wasm_bindgen]
pub fn setup_vision_bridge(callback: Function) {
    VISION_CALLBACK.with(|cb| {
        *cb.borrow_mut() = Some(callback);
    });
}

// Hàm này sẽ tự động chạy ngay khi file WASM được load
#[wasm_bindgen(start)]
pub fn main() -> Result<(), JsValue> {
    console::log_1(&"🚀 [Rust Core]: Bộ não WASM đã khởi động thành công!".into());
    Ok(())
}

#[wasm_bindgen]
pub fn init_cheat_engine() {
    console_error_panic_hook::set_once();

    console::log_1(&"🔥 [Rust Core]: Bắt đầu dựng UI tàng hình...".into());

    // eframe chạy trên web là một tác vụ bất đồng bộ (async), nên ta phải đưa nó vào vòng lặp của JS
    wasm_bindgen_futures::spawn_local(async {
        let window = web_sys::window().expect("Không tìm thấy window");
        let document = window.document().expect("Không tìm thấy document");
        
        // 1. Tạo MỘT thẻ canvas duy nhất làm thao trường
        let canvas = document.create_element("canvas").unwrap();
        canvas.set_id("wasm-stealth-canvas");
        
        // Căng canvas này tràn viền, trong suốt, và cho nó đè lên vạn vật
        canvas.set_attribute(
            "style",
            "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 9999999; background: transparent; pointer-events: auto;"
        ).unwrap();
        
        document.body().unwrap().append_child(&canvas).unwrap();

        // 2. Đẩy eframe vào cái canvas đó
        let web_options = eframe::WebOptions {
            ..Default::default()
        };

        let runner = eframe::WebRunner::new();
        let result = runner.start(
            "wasm-stealth-canvas",
            web_options,
            Box::new(|_cc| Box::new(ui::CheatMenuApp::default())),
        ).await;

        if let Err(e) = result {
            web_sys::console::log_1(&format!("❌ [Rust Core]: Lỗi dựng hình: {:?}", e).into());
        }
    });
}

