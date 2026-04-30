use wasm_bindgen::prelude::*; // Chứa JsValue
use js_sys::Promise;
use wasm_bindgen_futures::JsFuture;

// Struct lưu trữ tọa độ thay cho globalThis.visionBox
#[derive(Clone, Copy)]
pub struct VisionBox {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = window, js_name = wasmSelectArea)]
    fn wasm_select_area() -> Promise;
}

// Hàm này sẽ thò tay ra ngoài DOM, tìm Canvas game và lấy mảng pixel
pub async fn capture_and_crop(vbox: &VisionBox) -> Result<(Vec<u8>, usize, usize), String> {
    // 1. Lôi hàm ẩn danh JS ra khỏi két sắt
    let callback = crate::VISION_CALLBACK.with(|cb| {
        cb.borrow().clone()
    }).ok_or("Bridge not established!")?;
    
    // 2. Chuyển đổi tham số sang kiểu JS
    let this = JsValue::null();
    let x = JsValue::from(vbox.x);
    let y = JsValue::from(vbox.y);
    let w = JsValue::from(vbox.w);
    let h = JsValue::from(vbox.h);

    // 3. Kích hoạt hàm JS
    let promise_val = callback.call4(&this, &x, &y, &w, &h)
        .map_err(|e| format!("JS Call Error: {:?}", e))?;

    let promise = js_sys::Promise::from(promise_val);
    let js_val = JsFuture::from(promise).await
        .map_err(|e| format!("JS Future Error: {:?}", e))?;

    // 1. Lấy mảng Pixel
    let data_prop = JsValue::from_str("data");
    let data_val = js_sys::Reflect::get(&js_val, &data_prop)
        .map_err(|_| "Missing 'data' property")?;
    let uint8_arr = data_val.dyn_into::<js_sys::Uint8Array>()
        .map_err(|_| "Failed to cast data to Uint8Array")?;

    // 2. Lấy Chiều rộng THỰC TẾ
    let width_prop = JsValue::from_str("width");
    let width_val = js_sys::Reflect::get(&js_val, &width_prop)
        .map_err(|_| "Missing 'width' property")?;
    let real_w = width_val.as_f64().ok_or("Invalid width")? as usize;

    // 3. Lấy Chiều cao THỰC TẾ
    let height_prop = JsValue::from_str("height");
    let height_val = js_sys::Reflect::get(&js_val, &height_prop)
        .map_err(|_| "Missing 'height' property")?;
    let real_h = height_val.as_f64().ok_or("Invalid height")? as usize;

    // Trả về cả 3 thông số
    Ok((uint8_arr.to_vec(), real_w, real_h))
}

pub async fn request_area_selection() -> Option<VisionBox> {
    let promise = wasm_select_area();
    let js_val = JsFuture::from(promise).await.ok()?;
    
    let array = js_val.dyn_into::<js_sys::Float64Array>().ok()?;
    let coords = array.to_vec();
    
    if coords.len() == 4 {
        Some(VisionBox {
            x: coords[0],
            y: coords[1],
            w: coords[2],
            h: coords[3],
        })
    } else {
        None
    }
}