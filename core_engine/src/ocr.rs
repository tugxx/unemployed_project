use std::collections::HashMap;
use std::sync::Mutex;
use lazy_static::lazy_static;
use wasm_bindgen::prelude::*;

lazy_static! {
    static ref DICTIONARY: Mutex<HashMap<u64, char>> = Mutex::new(HashMap::new());
}

#[wasm_bindgen]
pub fn learn_hash(hash: u64, character: char) {
    if let Ok(mut dict) = DICTIONARY.lock() {
        dict.insert(hash, character);
    }
}

pub fn lookup_hash_fuzzy(target_hash: u64, max_diff: u32) -> Option<char> {
    if let Ok(dict) = DICTIONARY.lock() {
        let mut best_match = None;
        let mut min_diff = max_diff + 1;

        for (&known_hash, &character) in dict.iter() {
            // Phép thuật tính khoảng cách KNN siêu tốc độ
            let diff = (target_hash ^ known_hash).count_ones(); 
            
            if diff < min_diff {
                min_diff = diff;
                best_match = Some(character);
            }
        }
        
        // Chỉ chấp nhận nếu độ lệch nằm trong ngưỡng cho phép
        if min_diff <= max_diff {
            return best_match;
        }
    }
    None
}


// 1. Chuyển ảnh màu RGBA thành mảng bit (Trắng/Đen)
pub fn binarize(rgba: &[u8], width: usize, height: usize, threshold: u8) -> Vec<bool> {
    let mut bits = Vec::with_capacity(width * height);
    for chunk in rgba.chunks_exact(4) {
        // Tính độ sáng trung bình của R, G, B
        let brightness = (chunk[0] as u16 + chunk[1] as u16 + chunk[2] as u16) / 3;
        // Nếu sáng hơn threshold -> true (pixel chữ), ngược lại false (pixel nền)
        bits.push(brightness > threshold as u16);
    }
    bits
}

// 2. Tách các chữ số dựa vào các cột trống (Không có pixel nào là true)
pub fn segment_characters(bits: &[bool], width: usize, height: usize) -> Vec<(usize, usize, usize, usize)> {
    let mut boxes = Vec::new();
    let mut in_char = false;
    let mut start_x = 0;

    for x in 0..width {
        // Kiểm tra xem cột hiện tại có pixel nào sáng không
        let mut column_has_pixel = false;
        for y in 0..height {
            if bits[y * width + x] {
                column_has_pixel = true;
                break;
            }
        }

        if column_has_pixel && !in_char {
            start_x = x; // Bắt đầu một chữ số mới
            in_char = true;
        } else if !column_has_pixel && in_char {
            // Kết thúc chữ số, lưu lại Bounding Box (x, y, width, height)
            let char_width = x - start_x;
            if char_width > 1 { // Bỏ qua nhiễu 1 pixel
                boxes.push((start_x, 0, char_width, height));
            }
            in_char = false;
        }
    }
    
    // Nếu chữ số nằm sát mép phải
    if in_char {
        boxes.push((start_x, 0, width - start_x, height));
    }
    
    boxes
}

// 3. Thuật toán tạo "Dấu vân tay" u64 siêu tốc (Nearest Neighbor 8x8)
pub fn generate_fingerprint(bits: &[bool], orig_width: usize, char_box: (usize, usize, usize, usize)) -> u64 {
    let (bx, by, bw, bh) = char_box;
    let mut hash: u64 = 0;
    
    // Ép chữ số về lưới 8x8
    for y in 0..8 {
        for x in 0..8 {
            // Ánh xạ tọa độ 8x8 về tọa độ gốc của chữ số
            let src_x = bx + (x * bw) / 8;
            let src_y = by + (y * bh) / 8;
            
            // Lấy giá trị pixel
            let is_pixel = bits[src_y * orig_width + src_x];
            
            if is_pixel {
                // Đẩy bit 1 vào biến u64
                let bit_index = y * 8 + x;
                hash |= 1 << bit_index;
            }
        }
    }
    hash
}

pub fn recognize_sequence(rgba: &[u8], width: usize, height: usize) -> (String, String) {
    // Bước 1: Trắng đen
    let threshold = calculate_otsu_threshold(rgba);
    let bits = binarize(rgba, width, height, threshold);
    
    // Bước 2: Chặt chữ
    let char_boxes = segment_characters(&bits, width, height);
    
    let mut result_string = String::new();
    let mut unknown_json_objects = Vec::new();

    // Bước 3: Ép khuôn & Tra sổ tay
    for c_box in char_boxes {
        let hash = generate_fingerprint(&bits, width, c_box);
        
        if let Some(known_char) = lookup_hash_fuzzy(hash, 3) { 
            // Đã biết -> Nhét vào chuỗi kết quả
            result_string.push(known_char);
        } else {
            // Chưa biết -> Báo lỗi chấm hỏi và lưu mã Hash lại
            result_string.push('?');
            let (bx, by, bw, bh) = c_box;
            let mut pixels = Vec::with_capacity(bw * bh);
            for y in 0..bh {
                for x in 0..bw {
                    let is_pixel = bits[(by + y) * width + (bx + x)];
                    pixels.push(if is_pixel { 1 } else { 0 }); // 1 là chữ, 0 là nền
                }
            }
            
            // Đóng gói thành chuỗi JSON thủ công (để khỏi cài thêm thư viện)
            let pixels_str = pixels.iter().map(|p| p.to_string()).collect::<Vec<_>>().join(",");
            let json_obj = format!(
                r#"{{"hash":"{}","width":{},"height":{},"pixels":[{}]}}"#, 
                hash, bw, bh, pixels_str
            );
            unknown_json_objects.push(json_obj);
        }
    }
    
    // Ghép thành mảng JSON: [{...}, {...}]
    let final_json_array = format!("[{}]", unknown_json_objects.join(","));
    (result_string, final_json_array)
}

// Thêm hàm này vào ocr.rs để tính ngưỡng Otsu tự động
pub fn calculate_otsu_threshold(rgba: &[u8]) -> u8 {
    let mut histogram = [0usize; 256];
    let total_pixels = rgba.len() / 4;

    // Tính cường độ sáng và lập Histogram
    for chunk in rgba.chunks_exact(4) {
        let brightness = (chunk[0] as usize + chunk[1] as usize + chunk[2] as usize) / 3;
        histogram[brightness] += 1;
    }

    let mut sum = 0;
    for i in 0..256 { sum += i * histogram[i]; }

    let mut sum_b = 0;
    let mut w_b = 0;
    let mut w_f;
    let mut max_variance = 0.0;
    let mut threshold = 0;

    for i in 0..256 {
        w_b += histogram[i];
        if w_b == 0 { continue; }
        w_f = total_pixels - w_b;
        if w_f == 0 { break; }

        sum_b += i * histogram[i];
        let m_b = sum_b as f64 / w_b as f64;
        let m_f = (sum - sum_b) as f64 / w_f as f64;

        let variance = w_b as f64 * w_f as f64 * (m_b - m_f) * (m_b - m_f);
        if variance > max_variance {
            max_variance = variance;
            threshold = i as u8;
        }
    }
    threshold
}