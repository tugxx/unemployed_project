use crate::app_log;

use super::CheatMenuApp;
use super::VisionBox;
// use crate::BridgeResponse;

pub fn show_ghost_window(app: &mut CheatMenuApp, ctx: &egui::Context) {
    if let Some(frames_left) = app.capture_countdown {
        if frames_left > 0 {
            // Trừ đi 1 frame
            app.capture_countdown = Some(frames_left - 1);
            // Ép egui render frame tiếp theo ngay lập tức
            ctx.request_repaint();
            // Return luôn, KHÔNG vẽ ghost window nữa để OS có thời gian dọn dẹp nó
            return;
        } else {
            // Đã đếm về 0 -> Chắc chắn 100% cửa sổ mờ đã biến mất khỏi màn hình OS
            app.capture_countdown = None; // Reset cờ

            if let Some(vbox) = app.current_box {
                app_log!("📸 Đang chụp ảnh OS Native...");

                let tx = app.native_img_tx.clone();
                let scale_factor = ctx.pixels_per_point();
                let ctx_clone = ctx.clone();

                // Quăng vào thread chạy luôn, KHÔNG cần sleep nữa!
                std::thread::spawn(move || {
                    if let Ok(monitors) = xcap::Monitor::all()
                        && let Some(monitor) = monitors.first()
                        && let Ok(full_image) = monitor.capture_image()
                    {
                        let real_x = (vbox.x as f32 * scale_factor) as u32;
                        let real_y = (vbox.y as f32 * scale_factor) as u32;
                        let real_w = (vbox.w as f32 * scale_factor) as u32;
                        let real_h = (vbox.h as f32 * scale_factor) as u32;

                        let cropped =
                            image::imageops::crop_imm(&full_image, real_x, real_y, real_w, real_h)
                                .to_image();

                        let _ = tx.send(cropped);
                        ctx_clone.request_repaint(); // Báo UI có ảnh mới
                    }
                });
            }
        }
    }

    if !app.is_selecting_area && app.current_box.is_none() {
        return;
    }

    let overlay_builder = egui::ViewportBuilder::default()
        .with_title("Hacker_Vision_Overlay")
        .with_transparent(true) // Nền kính trong suốt
        .with_decorations(false) // Tắt thanh tiêu đề (Nút X, -)
        .with_maximized(true) // Phóng to phủ kín toàn màn hình Windows
        .with_always_on_top() // Luôn nổi trên game/Chrome
        .with_mouse_passthrough(true); // CHÌA KHÓA: Cho phép click chuột xuyên qua nét vẽ!

    ctx.show_viewport_immediate(
        egui::ViewportId::from_hash_of("overlay_window"),
        overlay_builder,
        |ctx, _class| {
            if ctx.input(|i| i.viewport().close_requested()) {
                app.is_selecting_area = false;
                app.current_box = None; // Xóa data -> Khung tự biến mất, cửa sổ tự hủy!
                app.drag_start = None;
            }

            // Bắt phím ESC cho chắc kèo
            if ctx.input(|i| i.key_pressed(egui::Key::Escape)) {
                app.is_selecting_area = false;
                app.current_box = None;
                app.drag_start = None;
            }

            if app.is_selecting_area {
                // Ép con trỏ chuột thành dấu cộng (Crosshair) ở tầng OS
                ctx.set_cursor_icon(egui::CursorIcon::Crosshair);

                // Tắt chế độ xuyên chuột để Rust hứng click
                ctx.send_viewport_cmd(egui::ViewportCommand::MousePassthrough(false));
            } else {
                // Trả lại trạng thái xuyên chuột cho game
                ctx.send_viewport_cmd(egui::ViewportCommand::MousePassthrough(true));
            }

            // --- 2. LẮNG NGHE SỰ KIỆN KÉO THẢ (Chỉ chạy khi đang mode Select) ---
            if app.is_selecting_area {
                let pointer = ctx.input(|i| i.pointer.clone());

                // Lúc vừa bấm chuột xuống
                if pointer.primary_pressed() {
                    app.drag_start = pointer.interact_pos();
                }

                // Đang giữ chuột và kéo đi
                if let (Some(start_pos), Some(current_pos)) =
                    (app.drag_start, pointer.interact_pos())
                {
                    // Tính toán x, y, w, h
                    let min_x = start_pos.x.min(current_pos.x);
                    let min_y = start_pos.y.min(current_pos.y);
                    let w = (current_pos.x - start_pos.x).abs();
                    let h = (current_pos.y - start_pos.y).abs();

                    // Cập nhật current_box liên tục để vẽ realtime
                    app.current_box = Some(VisionBox {
                        x: min_x as i32,
                        y: min_y as i32,
                        w: w as i32,
                        h: h as i32,
                    });
                }

                // Lúc nhả chuột ra (CHỐT SỔ)
                if pointer.primary_released() {
                    app.is_selecting_area = false; // Thoát chế độ chọn
                    app.drag_start = None;
                    app_log!("✅ Chốt tọa độ an toàn tầng OS!");

                    // if let Some(vbox) = &app.current_box {
                    //     if vbox.w < 5 || vbox.h < 5 {
                    //         app.current_box = None;
                    //     } else {
                    //         app.logs
                    //             .push("✅ Chốt tọa độ! Đang gọi Chrome chụp ảnh...".to_string());

                    //         // --- GỬI LỆNH CHỤP CHO CHROME ---
                    //         let payload = BridgeResponse {
                    //             reqId: "cmd_capture".to_string(),
                    //             action: Some("REQUEST_CAPTURE".to_string()),
                    //             success: true,
                    //             error: None,
                    //             x: Some(vbox.x),
                    //             y: Some(vbox.y),
                    //             w: Some(vbox.w),
                    //             h: Some(vbox.h),
                    //         };

                    //         if let Err(e) = crate::send_to_chrome(&payload) {
                    //             app.logs.push(format!("❌ Lỗi gọi máy ảnh: {}", e));
                    //         }
                    //     }
                    // }

                    if let Some(vbox) = app.current_box {
                        if vbox.w < 5 || vbox.h < 5 {
                            app.current_box = None;
                            app_log!("⚠️ Vùng chọn quá nhỏ, đã hủy.");
                        } else {
                            app_log!("⏳ Đợi OS dọn dẹp bộ đệm đồ họa...");

                            // BẬT BỘ ĐẾM: Đợi 3 frames để GPU dọn sạch cái cửa sổ mờ này đi
                            app.capture_countdown = Some(3);

                            // Bắt buộc render ngay để quá trình đếm lùi bắt đầu
                            ctx.request_repaint();
                        }
                    }
                }
            } else {
                ctx.send_viewport_cmd(egui::ViewportCommand::MousePassthrough(true));
            }

            // Tiến hành vẽ cái box dựa theo tọa độ tuyệt đối
            if let Some(vbox) = &app.current_box
                && vbox.w > 0
                && vbox.h > 0
            {
                // Lấy cây cọ vẽ của cái Ghost Window này
                let painter = ctx.layer_painter(egui::LayerId::new(
                    egui::Order::Foreground,
                    egui::Id::new("overlay_painter"),
                ));

                let rect = egui::Rect::from_min_size(
                    egui::pos2(vbox.x as f32, vbox.y as f32),
                    egui::vec2(vbox.w as f32, vbox.h as f32),
                );

                painter.rect(
                    rect,
                    0.0,
                    egui::Color32::from_rgba_unmultiplied(255, 0, 0, 40), // Đỏ mờ
                    egui::Stroke::new(2.0, egui::Color32::RED),           // Viền đỏ nét
                    egui::StrokeKind::Inside,
                );

                painter.text(
                    egui::pos2(vbox.x as f32, vbox.y as f32 - 15.0),
                    egui::Align2::LEFT_TOP,
                    format!("Target Locked: {}x{}", vbox.w, vbox.h),
                    egui::FontId::proportional(14.0),
                    egui::Color32::GREEN,
                );
            }
        },
    );
}
