use lazy_static::lazy_static;
use rayon::prelude::*;
use serde_json::json;
use std::collections::HashMap;
use std::sync::Mutex;

lazy_static! {
    static ref DICTIONARY: Mutex<HashMap<[u8; 64], char>> = Mutex::new(HashMap::new());
}

// #[wasm_bindgen]
// pub fn learn_hash(hash_hex: String, character: char) {
//     // 1. Kiểm tra an toàn: Chuỗi phải dài đúng 128 ký tự (64 ô * 2 ký tự Hex)
//     if hash_hex.len() != 128 {
//         return; // Bỏ qua nếu dữ liệu rác
//     }

//     // 2. Dịch ngược chuỗi Hex về lại mảng [u8; 64]
//     let mut vector = [0u8; 64];
//     for i in 0..64 {
//         let start = i * 2;
//         let end = start + 2;

//         // Cắt từng cặp 2 ký tự (VD: "ff", "a0") và ép về số nguyên u8
//         if let Ok(val) = u8::from_str_radix(&hash_hex[start..end], 16) {
//             vector[i] = val;
//         } else {
//             return; // Nếu parse lỗi (chứa ký tự lạ), hủy thao tác
//         }
//     }

//     // 3. Nhét vào từ điển (DICTIONARY giờ đây nhận Key là [u8; 64])
//     if let Ok(mut dict) = DICTIONARY.lock() {
//         dict.insert(vector, character);
//     }
// }

pub fn lookup_vector_fuzzy(target_vector: &[u8; 64], max_diff: u32) -> Option<char> {
    if let Ok(dict) = DICTIONARY.lock() {
        let mut best_match = None;
        let mut min_diff = max_diff + 1;

        for (known_vector, &character) in dict.iter() {
            // Phép toán đo khoảng cách Manhattan (Sum of Absolute Differences)
            // Tính tổng độ chênh lệch màu của từng ô 8x8 một cách siêu tốc
            let diff: u32 = target_vector
                .iter()
                .zip(known_vector.iter())
                .map(|(&a, &b)| a.abs_diff(b) as u32)
                .sum();

            if diff < min_diff {
                min_diff = diff;
                best_match = Some(character);
            }
        }

        if min_diff <= max_diff {
            return best_match;
        }
    }
    None
}

// pub fn binarize_adaptive(gray: &[u8], width: usize, height: usize) -> Vec<bool> {
//     let mut bits = vec![false; width * height];
//     let mut integral_image = vec![0u32; width * height];
//     let total_pixels = (width * height) as u32;

//     // Bước 1: Tạo Integral Image (Ảnh tích phân) - Chỉ tốn 1 lần quét duy nhất
//     for y in 0..height {
//         let mut row_sum = 0u32;
//         for x in 0..width {
//             row_sum += gray[y * width + x] as u32;
//             if y == 0 {
//                 integral_image[y * width + x] = row_sum;
//             } else {
//                 integral_image[y * width + x] = integral_image[(y - 1) * width + x] + row_sum;
//             }
//         }
//     }

//     // Bước 2: AI Ước lượng cực tính (Polarity Estimation)
//     // Lấy tổng độ sáng (chính là phần tử cuối cùng của mảng tích phân) chia cho tổng pixel
//     let global_sum = integral_image[(height - 1) * width + (width - 1)];
//     let global_mean = global_sum / total_pixels;

//     let mut light_pixel_count = 0;
//     for &p in gray {
//         if (p as u32) > global_mean {
//             light_pixel_count += 1;
//         }
//     }

//     // AI Quyết định: Nếu pixel sáng là thiểu số, thì ảnh này là Chữ Sáng - Nền Tối
//     let is_light_text = light_pixel_count < (total_pixels / 2);

//     let s = (width / 8).max(2) as i32;
//     let t = 10;

//     for y in 0..height {
//         for x in 0..width {
//             let y1 = (y as i32 - s).max(0) as usize;
//             let y2 = (y as i32 + s).min(height as i32 - 1) as usize;
//             let x1 = (x as i32 - s).max(0) as usize;
//             let x2 = (x as i32 + s).min(width as i32 - 1) as usize;

//             // Tính tổng vùng 1 cửa sổ chỉ bằng 4 điểm trên Integral Image
//             let count = (x2 - x1) * (y2 - y1);
//             if count == 0 {
//                 continue;
//             }

//             let sum = integral_image[y2 * width + x2]
//                 - integral_image[y1 * width + x2]
//                 - integral_image[y2 * width + x1]
//                 + integral_image[y1 * width + x1];

//             let pixel = gray[y * width + x] as u32;

//             if is_light_text {
//                 // Chữ sáng, nền tối: Tìm pixel SÁNG hơn trung bình vùng
//                 if pixel * (count as u32) > sum * (100 + t) / 100 {
//                     bits[y * width + x] = true;
//                 }
//             } else {
//                 // Chữ tối, nền sáng: Tìm pixel TỐI hơn trung bình vùng
//                 if pixel * (count as u32) < sum * (100 - t) / 100 {
//                     bits[y * width + x] = true;
//                 }
//             }
//         }
//     }
//     bits
// }

// 2. Tách các chữ số dựa vào các cột trống (Không có pixel nào là true)
pub fn segment_characters(
    bits: &[bool],
    width: usize,
    height: usize,
) -> Vec<(usize, usize, usize, usize)> {
    let mut visited = vec![false; width * height];
    let mut boxes = Vec::new();

    // 8 hướng di chuyển để loang màu (Trái, Phải, Lên, Xuống và 4 góc chéo)
    let dirs = [
        (-1, -1),
        (0, -1),
        (1, -1),
        (-1, 0),
        (1, 0),
        (-1, 1),
        (0, 1),
        (1, 1),
    ];

    for y in 0..height {
        for x in 0..width {
            let idx = y * width + x;

            // Nếu gặp pixel sáng và chưa từng ghé thăm -> Bắt đầu loang màu!
            if bits[idx] && !visited[idx] {
                let mut queue = vec![(x, y)];
                visited[idx] = true;

                // Lưu lại tọa độ để vẽ Hộp bao (Bounding Box)
                let mut min_x = x;
                let mut max_x = x;
                let mut min_y = y;
                let mut max_y = y;
                let mut area = 0; // Diện tích (số pixel thực tế của chữ)

                // Vòng lặp BFS (Breadth-First Search) loang màu
                while let Some((cx, cy)) = queue.pop() {
                    area += 1;

                    for &(dx, dy) in &dirs {
                        let nx = cx as isize + dx;
                        let ny = cy as isize + dy;

                        // Kiểm tra xem có bị tràn viền không
                        if nx >= 0 && nx < width as isize && ny >= 0 && ny < height as isize {
                            let nx = nx as usize;
                            let ny = ny as usize;
                            let n_idx = ny * width + nx;

                            // Nếu pixel bên cạnh cũng sáng -> Ăn luôn!
                            if bits[n_idx] && !visited[n_idx] {
                                visited[n_idx] = true;
                                queue.push((nx, ny));

                                // Cập nhật lại khung chữ nhật bao quanh
                                if nx < min_x {
                                    min_x = nx;
                                }
                                if nx > max_x {
                                    max_x = nx;
                                }
                                if ny < min_y {
                                    min_y = ny;
                                }
                                if ny > max_y {
                                    max_y = ny;
                                }
                            }
                        }
                    }
                }

                let box_w = max_x - min_x + 1;
                let box_h = max_y - min_y + 1;

                // --- BỘ LỌC TÀN KHỐC (Xử lý nhiễu & viền nét đứt) ---
                // Chỉ nhận những hòn đảo:
                // 1. Diện tích > 5 pixel (Lọc điểm nhiễu lấm tấm)
                // 2. Chiều cao > 4 pixel (Lọc nét đứt ngang của UI)
                // 3. Tỷ lệ không được quá dị dạng (Tùy chọn, có thể thêm sau)
                if area > 5 && box_h > 4 {
                    boxes.push((min_x, min_y, box_w, box_h));
                }
            }
        }
    }

    // CỰC KỲ QUAN TRỌNG: Loang màu xong thì các chữ số có thể bị lộn xộn thứ tự.
    // Ta phải sắp xếp lại các hộp từ Trái sang Phải (theo min_x) để đọc chữ không bị ngược.
    boxes.sort_by_key(|a| a.0);
    boxes
}

// Hàm hỗ trợ chuyển RGBA sang Grayscale (Ảnh xám)
pub fn to_grayscale(rgba: &[u8], _width: usize, _height: usize) -> Vec<u8> {
    rgba.par_chunks(4)
        .map(|pixel| {
            let r = pixel[0] as f32;
            let g = pixel[1] as f32;
            let b = pixel[2] as f32;
            // Ép kiểu trực tiếp từng pixel độc lập
            (r * 0.299 + g * 0.587 + b * 0.114) as u8
        })
        .collect()
}

// 🚀 THUẬT TOÁN MỚI: Trích xuất vector đặc trưng 64 chiều (Average Pooling)
pub fn generate_density_vector(
    gray: &[u8],
    orig_width: usize,
    char_box: (usize, usize, usize, usize),
) -> [u8; 64] {
    let (bx, by, bw, bh) = char_box;
    let mut vector = [0; 64];

    // Tính kích thước của 1 "khối" trong ảnh gốc
    let cell_w = (bw as f32 / 8.0).max(1.0);
    let cell_h = (bh as f32 / 8.0).max(1.0);

    for y in 0..8 {
        for x in 0..8 {
            let start_x = bx + (x as f32 * cell_w) as usize;
            let start_y = by + (y as f32 * cell_h) as usize;

            let end_x = (bx + ((x + 1) as f32 * cell_w).ceil() as usize).min(bx + bw);
            let end_y = (by + ((y + 1) as f32 * cell_h).ceil() as usize).min(by + bh);

            let mut pixel_sum: u32 = 0;
            let mut pixel_count: u32 = 0;

            // Quét AVERAGE POOLING: Cộng dồn giá trị độ sáng của mọi pixel trong khối
            for cy in start_y..end_y {
                for cx in start_x..end_x {
                    // Chú ý: Ở ảnh xám, chữ thường là màu sáng (giá trị cao) trên nền tối.
                    // Nếu game của đại ca chữ đen nền trắng, đại ca phải đảo ngược lại (255 - pixel).
                    let pixel_val = gray[cy * orig_width + cx];
                    pixel_sum += pixel_val as u32;
                    pixel_count += 1;
                }
            }

            // Tính trung bình mật độ (Scale về từ 0.0 đến 1.0)
            if let Some(avg) = pixel_sum.checked_div(pixel_count) {
                let vector_index = y * 8 + x;
                vector[vector_index] = avg as u8;
            }
        }
    }

    vector
}

pub fn top_hat_text_extractor(gray: &[u8], width: usize, height: usize) -> Vec<bool> {
    let size = width * height;

    // Kích thước chổi quét. Offset = 2 tức là chổi quét 5x5 pixel.
    // Đủ to để nuốt chửng nét chữ mỏng, và đủ nhỏ để Icon sống sót.
    let offset = 2i32;

    // 1. Erode - Tìm giá trị TỐI NHẤT trong vùng
    let mut eroded = vec![0u8; size];
    eroded
        .par_chunks_mut(width) // Chia output thành các dòng
        .enumerate()
        .for_each(|(y, row)| {
            for x in 0..width as i32 {
                let mut min_val = 255u8;
                for ky in -offset..=offset {
                    for kx in -offset..=offset {
                        let ny = (y as i32 + ky).clamp(0, height as i32 - 1) as usize;
                        let nx = (x + kx).clamp(0, width as i32 - 1) as usize;
                        let val = gray[ny * width + nx];
                        if val < min_val {
                            min_val = val;
                        }
                    }
                }
                row[x as usize] = min_val;
            }
        });

    // 2. ĐẮP BỘT (Dilate) - Tìm giá trị SÁNG NHẤT trong vùng bị gọt
    let mut opened = vec![0u8; size];
    opened
        .par_chunks_mut(width)
        .enumerate()
        .for_each(|(y, row)| {
            for x in 0..width as i32 {
                let mut max_val = 0u8;
                for ky in -offset..=offset {
                    for kx in -offset..=offset {
                        let ny = (y as i32 + ky).clamp(0, height as i32 - 1) as usize;
                        let nx = (x + kx).clamp(0, width as i32 - 1) as usize;
                        let val = eroded[ny * width + nx];
                        if val > max_val {
                            max_val = val;
                        }
                    }
                }
                row[x as usize] = max_val;
            }
        });

    // 3. PHÉP TRỪ (Top-Hat = Gốc - Opened)
    gray.par_iter()
        .zip(opened.par_iter())
        .map(|(&g, &o)| g.saturating_sub(o) > 30)
        .collect()
}

// // Thuật toán chuẩn cộng đồng: Gom các Box nằm gần nhau thành 1
// pub fn merge_nearby_boxes(
//     boxes: &[(usize, usize, usize, usize)],
//     distance: usize // Khoảng cách tối đa để 2 mảnh vỡ được coi là 1 chữ (thường là 1 hoặc 2 pixel)
// ) -> Vec<(usize, usize, usize, usize)> {
//     let mut merged: Vec<(usize, usize, usize, usize)> = Vec::new();
//     let mut used = vec![false; boxes.len()];

//     for i in 0..boxes.len() {
//         if used[i] { continue; }

//         let (mut x1, mut y1, mut w1, mut h1) = boxes[i];
//         let mut r1 = x1 + w1;
//         let mut b1 = y1 + h1;

//         let mut changed = true;
//         while changed {
//             changed = false;
//             for j in 0..boxes.len() {
//                 if i == j || used[j] { continue; }

//                 let (x2, y2, w2, h2) = boxes[j];
//                 let r2 = x2 + w2;
//                 let b2 = y2 + h2;

//                 // Kiểm tra xem 2 hộp có nằm gần nhau trong phạm vi 'distance' không
//                 // Công thức kiểm tra giao nhau mở rộng (Expanded Intersection)
//                 let overlap_x = !(r1 + distance < x2 || x1 > r2 + distance);
//                 let overlap_y = !(b1 + distance < y2 || y1 > b2 + distance);

//                 if overlap_x && overlap_y {
//                     // Nếu gần nhau -> Nuốt chửng hộp j vào hộp i
//                     x1 = x1.min(x2);
//                     y1 = y1.min(y2);
//                     r1 = r1.max(r2);
//                     b1 = b1.max(b2);
//                     w1 = r1 - x1;
//                     h1 = b1 - y1;

//                     used[j] = true;
//                     changed = true; // Quét lại xem cái hộp to này có nuốt thêm được ai nữa không
//                 }
//             }
//         }
//         merged.push((x1, y1, w1, h1));
//     }

//     // Trả về danh sách các hộp đã được gom lại
//     // Đồng thời sắp xếp lại từ trái qua phải để đọc chữ cho đúng thứ tự
//     merged.sort_by_key(|box_tuple| box_tuple.0);
//     merged
// }

pub fn recognize_sequence(rgba: &[u8], width: usize, height: usize) -> (String, String) {
    let gray = to_grayscale(rgba, width, height);
    let bits = top_hat_text_extractor(&gray, width, height);
    let char_boxes = segment_characters(&bits, width, height);

    let mut result_string = String::new();
    let mut unknown_json_objects = Vec::new();

    // Bước 3: Ép khuôn & Tra sổ tay
    for c_box in char_boxes {
        let (bx, by, bw, bh) = c_box;
        // if bw < 3 || bh < 5 {
        //     crate::logger("   -> ❌ Bị loại vì kích thước quá nhỏ!");
        //     continue;
        // }

        // Nén khối mật độ từ ảnh XÁM
        let vector = generate_density_vector(&gray, width, c_box);

        if let Some(known_char) = lookup_vector_fuzzy(&vector, 2000) {
            // Đã biết -> Nhét vào chuỗi kết quả
            result_string.push(known_char);
        } else {
            // Chưa biết -> Báo lỗi chấm hỏi và lưu mã Hash lại
            result_string.push('?');

            let mut pixels = Vec::with_capacity(bw * bh);
            for y in 0..bh {
                for x in 0..bw {
                    let is_pixel = bits[(by + y) * width + (bx + x)];
                    pixels.push(if is_pixel { 1 } else { 0 }); // 1 là chữ, 0 là nền
                }
            }

            let vector_hex = vector
                .iter()
                .map(|b| format!("{:02x}", b))
                .collect::<String>();
            let unknown_obj = json!({
                "hash": vector_hex,
                "width": bw,
                "height": bh,
                "pixels": pixels
            });
            unknown_json_objects.push(unknown_obj);
        }
    }

    let json_str = if unknown_json_objects.is_empty() {
        "[]".to_string()
    } else {
        serde_json::to_string(&unknown_json_objects).unwrap()
    };
    (result_string, json_str)
}
