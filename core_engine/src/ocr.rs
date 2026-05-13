use image::imageops::FilterType;
use image::{ImageBuffer, Luma};
use lazy_static::lazy_static;
use rayon::prelude::*;
use serde_json::json;
use std::collections::HashMap;
use std::sync::Mutex;
use std::fs;
use std::io::Write;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::app_log;
use crate::ui::OcrDebugBag;

lazy_static! {
    static ref DICTIONARY: Mutex<HashMap<[u8; 64], char>> = Mutex::new(HashMap::new());
}

pub fn save_training_data(pixels: &[u8], width: usize, height: usize, label: &str) {
    let Some(img) = ImageBuffer::<Luma<u8>, _>::from_raw(width as u32, height as u32, pixels)
    else {
        app_log!("❌ Không tạo được ImageBuffer");
        return;
    };

    // 3. Tạo thư mục nếu chưa có
    let base_dir = "../../../training_real_data";
    match std::fs::create_dir_all(base_dir) {
        Ok(_) => {}
        Err(e) => {
            app_log!("❌ Tạo thư mục thất bại: {} | Lỗi: {}", base_dir, e);
            return;
        }
    }

    // 4. Lưu ảnh với định dạng: [nhãn]_[id_ngẫu_nhiên].png
    // Ví dụ: training_data/2, 999, 3_12345.png
    let uuid = uuid::Uuid::new_v4().simple().to_string();
    let filename = format!("{}/{}_{}.png", base_dir, label, &uuid[0..6]);

    match img.save(&filename) {
        Ok(_) => app_log!("✅ Đã lưu: {}", filename),
        Err(e) => {
            app_log!("❌ Lưu thất bại: {} | Lỗi: {}", filename, e);
        }
    }
}

pub fn save_yolo_data(rgba: &[u8], width: usize, height: usize, boxes: &[egui::Rect]) {
    // Tạo tên file ngẫu nhiên dựa trên thời gian
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();

    let base_name = format!("game_ui_{}", timestamp);

    // Đảm bảo thư mục tồn tại
    let img_dir = "dataset_yolo/images/train";
    let label_dir = "dataset_yolo/labels/train";
    fs::create_dir_all(img_dir).unwrap();
    fs::create_dir_all(label_dir).unwrap();

    // 1. LƯU ẢNH (Dùng thư viện image)
    let img_path = format!("{}/{}.png", img_dir, base_name);
    image::save_buffer(
        &img_path,
        rgba,
        width as u32,
        height as u32,
        image::ColorType::Rgba8,
    )
    .expect("Lỗi khi lưu ảnh YOLO");

    // 2. LƯU FILE TXT (YOLO FORMAT)
    let txt_path = format!("{}/{}.txt", label_dir, base_name);
    let mut file = fs::File::create(&txt_path).expect("Không tạo được file YOLO txt");

    let w_f32 = width as f32;
    let h_f32 = height as f32;

    for b in boxes {
        // b là tọa độ trên ảnh gốc
        let box_w = b.width();
        let box_h = b.height();
        let x_center = b.min.x + (box_w / 2.0);
        let y_center = b.min.y + (box_h / 2.0);

        // Chuẩn hóa (Normalize) về [0..1]
        let norm_x = x_center / w_f32;
        let norm_y = y_center / h_f32;
        let norm_w = box_w / w_f32;
        let norm_h = box_h / h_f32;

        // Class id = 0, cách nhau bằng dấu cách
        let line = format!(
            "0 {:.6} {:.6} {:.6} {:.6}\n",
            norm_x, norm_y, norm_w, norm_h
        );
        file.write_all(line.as_bytes()).unwrap();
    }

    println!("✅ Đã xuất YOLO data: {}", base_name);
}

pub fn to_grayscale(rgba: &[u8], _width: usize, _height: usize) -> Vec<u8> {
    // Bước 1: Xám hóa chuẩn Luma (như cũ của bác)
    let mut gray: Vec<u8> = rgba
        .par_chunks(4)
        .map(|p| (p[0] as f32 * 0.299 + p[1] as f32 * 0.587 + p[2] as f32 * 0.114) as u8)
        .collect();

    // Bước 2: Tìm Min và Max để căng độ tương phản
    let (&min, &max) = match (gray.par_iter().min(), gray.par_iter().max()) {
        (Some(min), Some(max)) => (min, max),
        _ => return gray,
    };

    // Nếu ảnh quá phẳng (không có độ tương phản), thoát sớm
    if max <= min {
        return gray;
    }

    // Bước 3: Căng dải màu ra toàn bộ dải [0, 255]
    // Công thức: I_out = (I_in - min) * 255 / (max - min)
    gray.par_iter_mut().for_each(|pixel| {
        let stretched = (*pixel as f32 - min as f32) * 255.0 / (max - min) as f32;
        *pixel = stretched.clamp(0.0, 255.0) as u8;
    });

    gray
}

// Hàm nội suy phóng to ảnh Xám
pub fn upscale_gray(
    gray: &[u8],
    width: usize,
    height: usize,
    scale: u32,
) -> (Vec<u8>, usize, usize) {
    let new_w = width as u32 * scale;
    let new_h = height as u32 * scale;

    // 1. Chuyển mảng &[u8] thành cấu trúc ảnh 1 kênh màu (Luma) của crate `image`
    if let Some(img) =
        ImageBuffer::<Luma<u8>, _>::from_raw(width as u32, height as u32, gray.to_vec())
    {
        // 2. Phóng to bằng thuật toán CatmullRom (Bicubic) - Giữ nét chữ cực mượt
        let resized = image::imageops::resize(&img, new_w, new_h, FilterType::CatmullRom);

        // 3. Trả về mảng byte mới kèm kích thước mới
        return (resized.into_raw(), new_w as usize, new_h as usize);
    }

    // Nếu lỗi thì trả về ảnh gốc (an toàn)
    (gray.to_vec(), width, height)
}

pub fn adaptive_threshold(gray: &[u8], width: usize, height: usize) -> Vec<bool> {
    let mut result = vec![false; gray.len()];
    let s = (width / 8).max(1) as i32; // Kích thước vùng lân cận (tùy chỉnh theo font chữ)

    let t = 25; // Ngưỡng phần trăm (tối hơn % so với nền thì là chữ)
    let noise_shield = 35;

    let global_sum: u64 = gray.iter().map(|&p| p as u64).sum();
    let global_mean = (global_sum / (width * height) as u64) as u8;

    let mut dark_count = 0;
    let mut light_count = 0;
    for &p in gray {
        if p < global_mean {
            dark_count += 1;
        } else {
            light_count += 1;
        }
    }

    // Nét chữ luôn chiếm diện tích ÍT HƠN nền.
    // Nếu điểm tối nhiều hơn -> Nền đen, Chữ trắng.
    let is_light_text = dark_count > light_count;

    // 1. Tính Integral Image (Ảnh tích phân) để tính trung bình vùng siêu nhanh
    let mut int_img = vec![0i64; (width + 1) * (height + 1)];
    for y in 0..height {
        for x in 0..width {
            int_img[(y + 1) * (width + 1) + (x + 1)] = gray[y * width + x] as i64
                + int_img[y * (width + 1) + (x + 1)]
                + int_img[(y + 1) * (width + 1) + x]
                - int_img[y * (width + 1) + x];
        }
    }

    // 2. Duyệt từng pixel và so sánh với trung bình vùng
    for y in 0..height {
        for x in 0..width {
            // Lấy tọa độ cửa sổ
            let x1 = (x as i32 - s).max(0) as usize;
            let x2 = (x as i32 + s).min(width as i32 - 1) as usize;
            let y1 = (y as i32 - s).max(0) as usize;
            let y2 = (y as i32 + s).min(height as i32 - 1) as usize;

            let count = ((x2 - x1 + 1) * (y2 - y1 + 1)) as i64;
            let sum = int_img[(y2 + 1) * (width + 1) + (x2 + 1)]
                - int_img[y1 * (width + 1) + (x2 + 1)]
                - int_img[(y2 + 1) * (width + 1) + x1]
                + int_img[y1 * (width + 1) + x1];

            let local_mean = sum / count;
            let pixel = gray[y * width + x] as i64;

            // KHIÊN CHỐNG NHIỄU: Nếu pixel quá tiệm cận với màu nền chung thì coi như là rác
            if (pixel - global_mean as i64).abs() > noise_shield {
                if is_light_text {
                    // CHỮ TRẮNG NỀN ĐEN: Pixel nét chữ phải SÁNG HƠN trung bình vùng
                    if pixel * 100 > local_mean * (100 + t) {
                        result[y * width + x] = true;
                    }
                } else {
                    // CHỮ ĐEN NỀN TRẮNG: Pixel nét chữ phải TỐI HƠN trung bình vùng
                    if pixel * 100 < local_mean * (100 - t) {
                        result[y * width + x] = true;
                    }
                }
            }
        }
    }
    result
}

// 🚀 THUẬT TOÁN HPP: Cắt 1 ảnh to thành nhiều ảnh 1 dòng
pub fn split_into_lines(
    binary_pixels: &[u8],
    width: usize,
    height: usize,
) -> Vec<(Vec<u8>, usize, usize)> {
    // Trả về Vec chứa (Mảng_Pixel, Rộng, Cao)

    // Bước 1: Quét dọc ảnh, đếm pixel trắng trên từng hàng ngang
    let white_sums: Vec<usize> = binary_pixels
        .chunks(width)
        .map(|row| row.iter().filter(|&&p| p > 127).count())
        .collect();

    let total_white: usize = white_sums.iter().sum();
    let total_pixels = width * height;

    let is_white_bg = total_white > (total_pixels / 2);
    app_log!("is white: {}", is_white_bg);

    // Quy đổi từ "Đếm Trắng" sang "Đếm Chữ" (Foreground)
    let fg_sums: Vec<usize> = white_sums
        .into_iter()
        .map(|white_count| {
            if is_white_bg {
                // Nếu nền trắng, nét chữ (màu đen) sẽ bằng Tổng chiều rộng - Số pixel trắng
                width - white_count
            } else {
                // Nếu nền đen, nét chữ chính là số pixel trắng
                white_count
            }
        })
        .collect();

    // Bước 2: Tìm tọa độ Y bắt đầu và kết thúc của từng dòng chữ
    let mut line_coords = Vec::new();
    let mut in_line = false;
    let mut start_y = 0;

    // Ngưỡng lọc nhiễu: Hàng nào có <= 2 pixel trắng thì coi như là khoảng trống (khe đen)
    let noise_threshold = 2;

    // Duyệt qua mảng fg_sums (chứa số lượng pixel của NÉT CHỮ)
    for (y, &sum) in fg_sums.iter().enumerate() {
        if sum > noise_threshold {
            if !in_line {
                in_line = true;
                start_y = y;
            }
        } else {
            if in_line {
                in_line = false;
                if y - start_y > 5 {
                    line_coords.push((start_y, y));
                }
            }
        }
    }
    // Chốt sổ dòng cuối cùng nếu sát mép ảnh
    if in_line && (height - start_y > 5) {
        line_coords.push((start_y, height));
    }

    // Bước 3: Cắt mảng 1 chiều thành các bức ảnh nhỏ
    let mut cropped_images = Vec::new();
    for (start_y, end_y) in line_coords {
        let new_h = end_y - start_y;
        let mut cropped = Vec::with_capacity(width * new_h);

        for y in start_y..end_y {
            let row_start = y * width;
            cropped.extend_from_slice(&binary_pixels[row_start..row_start + width]);
        }
        cropped_images.push((cropped, width, new_h));
    }

    cropped_images
}

pub fn recognize_sequence(
    rgba: &[u8],
    width: usize,
    height: usize,
    mut debug_bag: Option<&mut OcrDebugBag>,
) -> (String, String) {
    let expected_len = width.saturating_mul(height).saturating_mul(4);

    // 1. Nếu ảnh size = 0, hoặc độ dài mảng byte bé hơn kích thước thực tế
    if width == 0 || height == 0 || rgba.len() < expected_len {
        // Thoát êm đẹp, trả về kết quả rỗng, App sống sót 100%
        return (String::new(), "[]".to_string());
    }

    let gray = to_grayscale(rgba, width, height);
    let scale_factor = 3; // Bác có thể thử 3 nếu ảnh gốc quá bé
    let (scaled_gray, new_w, new_h) = upscale_gray(&gray, width, height, scale_factor);
    if let Some(bag) = debug_bag.as_deref_mut() {
        bag.gray_pixels = scaled_gray.clone();
        bag.width = new_w; // Cập nhật lại kích thước cho túi đồ
        bag.height = new_h;
    }

    // let blur = box_blur(&gray, new_w, new_h);

    // let bits = adaptive_threshold(&scaled_gray, new_w, new_h);
    // let binary_pixels: Vec<u8> = bits.iter().map(|&b| if b { 255 } else { 0 }).collect();

    // // 2. Chạy thuật toán HPP để cắt ra các dòng
    // let lines = split_into_lines(&binary_pixels, new_w, new_h);

    // if let Some(bag) = debug_bag.as_deref_mut() {
    //     bag.gray_pixels = scaled_gray.clone();

    //     // Gán ảnh gốc (phòng khi cần soi toàn cảnh)
    //     bag.binary_pixels = binary_pixels;
    //     bag.width = new_w;
    //     bag.height = new_h;

    //     let lines_len = lines.len();
    //     bag.lines = lines;
    //     bag.line_inputs = vec![String::new(); lines_len];
    // }

    // let char_boxes = segment_characters(&bits, new_w, new_h);
    // if let Some(bag) = debug_bag {
    //     bag.boxes = char_boxes.clone();
    //     bag.width = new_w;
    //     bag.height = new_h;
    // }

    // let mut result_string = String::new();
    // let mut unknown_json_objects = Vec::new();

    let result_string = String::new();
    let unknown_json_objects: Vec<serde_json::Value> = Vec::new();

    // // Bước 3: Ép khuôn & Tra sổ tay
    // for c_box in char_boxes {
    //     let (bx, by, bw, bh) = c_box;
    //     // if bw < 3 || bh < 5 {
    //     //     crate::logger("   -> ❌ Bị loại vì kích thước quá nhỏ!");
    //     //     continue;
    //     // }

    //     // Nén khối mật độ từ ảnh XÁM
    //     let vector = generate_density_vector(&gray, new_w, c_box);

    //     if let Some(known_char) = lookup_vector_fuzzy(&vector, 2000) {
    //         // Đã biết -> Nhét vào chuỗi kết quả
    //         result_string.push(known_char);
    //     } else {
    //         // Chưa biết -> Báo lỗi chấm hỏi và lưu mã Hash lại
    //         result_string.push('?');

    //         let mut pixels = Vec::with_capacity(bw * bh);
    //         for y in 0..bh {
    //             for x in 0..bw {
    //                 let is_pixel = bits[(by + y) * width + (bx + x)];
    //                 pixels.push(if is_pixel { 1 } else { 0 }); // 1 là chữ, 0 là nền
    //             }
    //         }

    //         let vector_hex = vector
    //             .iter()
    //             .map(|b| format!("{:02x}", b))
    //             .collect::<String>();
    //         let unknown_obj = json!({
    //             "hash": vector_hex,
    //             "width": bw,
    //             "height": bh,
    //             "pixels": pixels
    //         });
    //         unknown_json_objects.push(unknown_obj);
    //     }
    // }

    let json_str = if unknown_json_objects.is_empty() {
        "[]".to_string()
    } else {
        serde_json::to_string(&unknown_json_objects).unwrap()
    };
    (result_string, json_str)
}

// // 2. Tách các chữ số dựa vào các cột trống (Không có pixel nào là true)
// pub fn segment_characters(
//     bits: &[bool],
//     width: usize,
//     height: usize,
// ) -> Vec<(usize, usize, usize, usize)> {
//     let mut visited = vec![false; width * height];
//     let mut boxes = Vec::new();

//     // 8 hướng di chuyển để loang màu (Trái, Phải, Lên, Xuống và 4 góc chéo)
//     let dirs = [
//         (-1, -1),
//         (0, -1),
//         (1, -1),
//         (-1, 0),
//         (1, 0),
//         (-1, 1),
//         (0, 1),
//         (1, 1),
//     ];

//     for y in 0..height {
//         for x in 0..width {
//             let idx = y * width + x;

//             // Nếu gặp pixel sáng và chưa từng ghé thăm -> Bắt đầu loang màu!
//             if bits[idx] && !visited[idx] {
//                 let mut queue = vec![(x, y)];
//                 visited[idx] = true;

//                 // Lưu lại tọa độ để vẽ Hộp bao (Bounding Box)
//                 let mut min_x = x;
//                 let mut max_x = x;
//                 let mut min_y = y;
//                 let mut max_y = y;
//                 let mut area = 0; // Diện tích (số pixel thực tế của chữ)

//                 // Vòng lặp BFS (Breadth-First Search) loang màu
//                 while let Some((cx, cy)) = queue.pop() {
//                     area += 1;

//                     for &(dx, dy) in &dirs {
//                         let nx = cx as isize + dx;
//                         let ny = cy as isize + dy;

//                         // Kiểm tra xem có bị tràn viền không
//                         if nx >= 0 && nx < width as isize && ny >= 0 && ny < height as isize {
//                             let nx = nx as usize;
//                             let ny = ny as usize;
//                             let n_idx = ny * width + nx;

//                             // Nếu pixel bên cạnh cũng sáng -> Ăn luôn!
//                             if bits[n_idx] && !visited[n_idx] {
//                                 visited[n_idx] = true;
//                                 queue.push((nx, ny));

//                                 // Cập nhật lại khung chữ nhật bao quanh
//                                 if nx < min_x {
//                                     min_x = nx;
//                                 }
//                                 if nx > max_x {
//                                     max_x = nx;
//                                 }
//                                 if ny < min_y {
//                                     min_y = ny;
//                                 }
//                                 if ny > max_y {
//                                     max_y = ny;
//                                 }
//                             }
//                         }
//                     }
//                 }

//                 let box_w = max_x - min_x + 1;
//                 let box_h = max_y - min_y + 1;

//                 // --- BỘ LỌC TÀN KHỐC (Xử lý nhiễu & viền nét đứt) ---
//                 // Chỉ nhận những hòn đảo:
//                 // 1. Diện tích > 5 pixel (Lọc điểm nhiễu lấm tấm)
//                 // 2. Chiều cao > 4 pixel (Lọc nét đứt ngang của UI)
//                 // 3. Tỷ lệ không được quá dị dạng (Tùy chọn, có thể thêm sau)
//                 if area > 5 && box_h > 4 {
//                     boxes.push((min_x, min_y, box_w, box_h));
//                 }
//             }
//         }
//     }

//     // CỰC KỲ QUAN TRỌNG: Loang màu xong thì các chữ số có thể bị lộn xộn thứ tự.
//     // Ta phải sắp xếp lại các hộp từ Trái sang Phải (theo min_x) để đọc chữ không bị ngược.
//     boxes.sort_by_key(|a| a.0);
//     boxes
// }

// // 🚀 THUẬT TOÁN MỚI: Trích xuất vector đặc trưng 64 chiều (Average Pooling)
// pub fn generate_density_vector(
//     gray: &[u8],
//     orig_width: usize,
//     char_box: (usize, usize, usize, usize),
// ) -> [u8; 64] {
//     let (bx, by, bw, bh) = char_box;
//     let mut vector = [0; 64];

//     let img_height = gray.len() / orig_width.max(1);

//     // Tính kích thước của 1 "khối" trong ảnh gốc
//     let cell_w = (bw as f32 / 8.0).max(1.0);
//     let cell_h = (bh as f32 / 8.0).max(1.0);

//     for y in 0..8 {
//         for x in 0..8 {
//             let start_x = bx + (x as f32 * cell_w) as usize;
//             let start_y = by + (y as f32 * cell_h) as usize;

//             let end_x = (bx + ((x + 1) as f32 * cell_w).ceil() as usize)
//                 .min(bx + bw)
//                 .min(orig_width); // Chặn cạnh phải

//             let end_y = (by + ((y + 1) as f32 * cell_h).ceil() as usize)
//                 .min(by + bh)
//                 .min(img_height); // Chặn cạnh đáy

//             let mut pixel_sum: u32 = 0;
//             let mut pixel_count: u32 = 0;

//             // Quét AVERAGE POOLING: Cộng dồn giá trị độ sáng của mọi pixel trong khối
//             for cy in start_y..end_y {
//                 for cx in start_x..end_x {
//                     let idx = cy * orig_width + cx;

//                     if idx < gray.len() {
//                         pixel_sum += gray[idx] as u32;
//                         pixel_count += 1;
//                     }
//                 }
//             }

//             // Tính trung bình mật độ (Scale về từ 0.0 đến 1.0)
//             if let Some(avg) = pixel_sum.checked_div(pixel_count) {
//                 let vector_index = y * 8 + x;
//                 vector[vector_index] = avg as u8;
//             }
//         }
//     }

//     vector
// }

// pub fn lookup_vector_fuzzy(target_vector: &[u8; 64], max_diff: u32) -> Option<char> {
//     if let Ok(dict) = DICTIONARY.lock() {
//         let mut best_match = None;
//         let mut min_diff = max_diff + 1;

//         for (known_vector, &character) in dict.iter() {
//             // Phép toán đo khoảng cách Manhattan (Sum of Absolute Differences)
//             // Tính tổng độ chênh lệch màu của từng ô 8x8 một cách siêu tốc
//             let diff: u32 = target_vector
//                 .iter()
//                 .zip(known_vector.iter())
//                 .map(|(&a, &b)| a.abs_diff(b) as u32)
//                 .sum();

//             if diff < min_diff {
//                 min_diff = diff;
//                 best_match = Some(character);
//             }
//         }

//         if min_diff <= max_diff {
//             return best_match;
//         }
//     }
//     None
// }
