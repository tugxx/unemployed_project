use crate::app_log;

use super::CheatMenuApp;
// use crate::BridgeResponse;
use egui::Ui;

// 1. CỤM MEMORY ENGINE
pub fn draw_memory_engine(app: &mut CheatMenuApp, ui: &mut Ui) {
    ui.heading("Memory Engine");
    ui.separator();
    ui.label("Scan Selectors (Coming soon)");

    ui.horizontal(|ui| {
        ui.label("Value:");
        ui.text_edit_singleline(&mut app.scan_value);
    });

    if ui.button("First Scan").clicked() {
        app_log!("Scan initiated (Native Memory)...");
    }
    ui.separator();
}

// 2. CỤM VISION & OCR
pub fn draw_vision_engine(app: &mut CheatMenuApp, ui: &mut Ui) {
    ui.heading("Vision & OCR Engine");
    ui.separator();

    if let Some(vbox) = &app.current_box {
        ui.label(format!(
            "📍 Area: [x:{}, y:{}] Size: {}x{}",
            vbox.x, vbox.y, vbox.w, vbox.h
        ));
    } else {
        ui.label("📍 Area: Not selected");
    }

    ui.horizontal(|ui| {
        if ui.button("🎯 Select Scan Area").clicked() {
            app.is_selecting_area = true;
            app.current_box = None;
            app.drag_start = None;
            app_log!("🔍 Đang chọn vùng... Hãy kéo chuột trên màn hình!");
        }

        // Nếu bác còn nút Cancel hoặc Capture thì nhét chung vào đây
        if ui.button("📸 Capture & Crop").clicked() {
            if app.current_box.is_some() {
                app.request_capture_flag = true;
                app_log!("⏳ Yêu cầu chụp lại vùng hiện tại...");
            } else {
                app_log!("⚠️ Hãy chọn vùng trước khi chụp!");
            }
        }
    });
    ui.separator();

    ui.checkbox(&mut app.show_debug_image, "👁 Hiển thị cửa sổ Debug Ảnh");
    ui.separator();
}

// 3. CỤM LOG CONSOLE
pub fn draw_logs(_app: &mut CheatMenuApp, ui: &mut Ui) {
    ui.horizontal(|ui| {
        ui.heading("📜 App Logs");

        // Đẩy nút Xóa sang lề phải cho đẹp
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            if ui.button("🗑️ Xóa Log").clicked() {
                // Mở khóa Mutex và dọn dẹp mảng
                if let Ok(mut logs) = crate::GLOBAL_LOGS.lock() {
                    logs.clear();
                }
            }
        });
    });

    ui.separator();

    // 2. Vẽ khung cuộn chứa Log
    egui::ScrollArea::vertical()
        .max_height(150.0)
        .stick_to_bottom(true) // Tự cuộn xuống dòng mới nhất
        .show(ui, |ui| {
            // Mở khóa để đọc (Chỉ khóa trong phạm vi vẽ UI này thôi)
            if let Ok(logs) = crate::GLOBAL_LOGS.lock() {
                for log in logs.iter() {
                    ui.colored_label(egui::Color32::LIGHT_GREEN, log);
                }
            }
        });
}

pub fn show_debug_viewport(app: &mut CheatMenuApp, ctx: &egui::Context) {
    // Chỉ tạo Viewport khi cờ show_debug_image đang bật
    if !app.show_debug_image {
        return;
    }

    let debug_builder = egui::ViewportBuilder::default()
        .with_title("📸 Raw Crop Preview (Debug)")
        .with_inner_size([800.0, 600.0]) // Kích thước khởi tạo
        .with_always_on_top() // Luôn nổi để dễ soi
        .with_decorations(true); // Giữ thanh tiêu đề để còn nắm đầu kéo đi được

    ctx.show_viewport_immediate(
        egui::ViewportId::from_hash_of("debug_pipeline"),
        debug_builder,
        |ctx, _class| {
            // Xử lý nút X của cửa sổ này
            if ctx.input(|i| i.viewport().close_requested()) {
                app.show_debug_image = false;
            }

            egui::Panel::top("debug_toolbar").show_inside(ctx, |ui| {
                ui.horizontal(|ui| {
                    ui.label("🔍 Phóng to:");

                    if ui.button("➖").clicked() {
                        app.debug_zoom -= 0.2;
                    }

                    // Thanh trượt từ 0.1x (rất nhỏ) đến 5.0x (rất to)
                    ui.add(egui::Slider::new(&mut app.debug_zoom, 0.1..=5.0).text("x"));

                    if ui.button("➕").clicked() {
                        app.debug_zoom += 0.2;
                    }
                    if ui.button("Reset").clicked() {
                        app.debug_zoom = 1.0;
                    }

                    // Chặn không cho zoom âm hoặc bằng 0 gây lỗi
                    app.debug_zoom = app.debug_zoom.clamp(0.1, 5.0);

                    ui.separator();
                    ui.label("💡 Mẹo: Giữ Ctrl + Lăn chuột để Zoom");
                });

                ui.separator();
                ui.heading("✂️ CÁC DÒNG ĐÃ CẮT (Data Train)");

                if let Some(bag) = &mut app.debug_bag {
                    // Dùng horizontal_wrapped: Tự dàn ngang, hết màn hình tự rớt xuống dòng (Giống Flex-wrap)
                    ui.horizontal_wrapped(|ui| {
                        // Duyệt qua từng dòng đã được cắt
                        for i in 0..bag.lines.len() {
                            // Vẽ 1 cái khung bao quanh từng dòng nhìn cho pờ-rồ
                            ui.group(|ui| {
                                ui.vertical(|ui| {
                                    // 1. Hiển thị ảnh của dòng này
                                    if let Some(tex) = bag.line_textures.get(i) {
                                        ui.image(tex);
                                    }

                                    ui.add_space(5.0);

                                    // 2. Ô Input (Mỗi dòng 1 ô riêng biệt)
                                    ui.horizontal(|ui| {
                                        ui.label("🏷️");

                                        // Khiên ép kiểu cho ô input hiện tại
                                        bag.line_inputs[i].retain(|c| {
                                            c.is_ascii_digit() || c == ',' || c == ' ' || c == '%'
                                        });

                                        ui.add(
                                            egui::TextEdit::singleline(&mut bag.line_inputs[i])
                                                .hint_text("Nhập số...")
                                                .desired_width(100.0), // Chỉnh width ngắn lại cho gọn
                                        );
                                    });

                                    // 3. Cụm nút bấm Lưu / Rác
                                    ui.horizontal(|ui| {
                                        let is_valid = !bag.line_inputs[i].trim().is_empty();

                                        // Nút Lưu Data Chuẩn
                                        if ui
                                            .add_enabled(is_valid, egui::Button::new("💾 Lưu"))
                                            .clicked()
                                        {
                                            let (pixels, w, h) = &bag.lines[i];
                                            crate::ocr::save_training_data(
                                                pixels,
                                                *w,
                                                *h,
                                                bag.line_inputs[i].trim(),
                                            );
                                            bag.line_inputs[i].clear(); // Lưu xong xóa trắng
                                        }

                                        // Nút Lưu Rác Thật
                                        if ui.button("🗑️ Rác").clicked() {
                                            let (pixels, w, h) = &bag.lines[i];
                                            crate::ocr::save_training_data(
                                                pixels, *w, *h, "garbage",
                                            );
                                        }
                                    });
                                });
                            });
                        }
                    });
                }
            });

            egui::CentralPanel::default().show_inside(ctx, |ui| {
                if let Some(texture) = &app.debug_texture {
                    ui.vertical_centered(|ui| {
                        ui.label(format!("Size: {}x{}", texture.size()[0], texture.size()[1]));

                        // Vẽ ảnh Raw
                        egui::ScrollArea::both().show(ui, |ui| {
                            let zoom = app.debug_zoom;

                            // Vẽ ảnh Raw
                            if let Some(tex) = &app.debug_raw_texture {
                                ui.label(format!(
                                    "1. Raw Image ({}x{})",
                                    tex.size()[0],
                                    tex.size()[1]
                                ));
                                ui.add(
                                    egui::Image::new(tex).fit_to_exact_size(tex.size_vec2() * zoom),
                                );
                                ui.add_space(10.0);
                            }

                            // Vẽ ảnh Gray
                            if let Some(tex) = &app.debug_gray_texture {
                                ui.label("2. Grayscale");
                                ui.add(
                                    egui::Image::new(tex).fit_to_exact_size(tex.size_vec2() * zoom),
                                );
                                ui.add_space(10.0);
                            }

                            // Vẽ ảnh Binary & Khung viền đỏ
                            if let (Some(tex), Some(bag)) =
                                (&app.debug_binary_texture, &app.debug_bag)
                            {
                                ui.label(format!(
                                    "3. Binary & Boxes (Tìm thấy {} ký tự)",
                                    bag.boxes.len()
                                ));

                                let img_size = tex.size_vec2() * zoom;
                                let (rect, _) =
                                    ui.allocate_exact_size(img_size, egui::Sense::hover());

                                // Vẽ nền ảnh nhị phân
                                ui.painter().image(
                                    tex.id(),
                                    rect,
                                    egui::Rect::from_min_max(
                                        egui::pos2(0.0, 0.0),
                                        egui::pos2(1.0, 1.0),
                                    ),
                                    egui::Color32::WHITE,
                                );

                                // Quét túi lấy tọa độ đè khung đỏ lên
                                for &(bx, by, bw, bh) in &bag.boxes {
                                    let min_x = rect.min.x + (bx as f32 * zoom);
                                    let min_y = rect.min.y + (by as f32 * zoom);
                                    let box_rect = egui::Rect::from_min_max(
                                        egui::pos2(min_x, min_y),
                                        egui::pos2(
                                            min_x + (bw as f32 * zoom),
                                            min_y + (bh as f32 * zoom),
                                        ),
                                    );
                                    ui.painter().rect(
                                        box_rect,
                                        0.0,
                                        egui::Color32::TRANSPARENT,
                                        (1.0, egui::Color32::RED),
                                        egui::StrokeKind::Inside,
                                    );
                                }
                            }
                        });
                    });
                } else {
                    ui.centered_and_justified(|ui| {
                        ui.label("⏳ Chờ dữ liệu từ Native OS...");
                    });
                }
            });
        },
    );
}
