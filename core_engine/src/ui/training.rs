use crate::app_log;

use super::CheatMenuApp;

pub fn show_training_window(app: &mut CheatMenuApp, ctx: &egui::Context) {
    // Kỹ thuật "Early Return": Bọc điều kiện ở ngoài cùng để code bên trong đỡ bị lùi (indent) quá sâu
    if !app.show_training_ui {
        return;
    }

    let viewport_id = egui::ViewportId::from_hash_of("training_popup");
    let builder = egui::ViewportBuilder::default()
        .with_title("🎓 Huấn luyện AI Model")
        .with_inner_size([400.0, 200.0])
        .with_always_on_top();

    ctx.show_viewport_immediate(viewport_id, builder, |viewport_ui, _class| {
        // 2. Dùng .show_inside() cực kỳ thanh lịch như bác nói:
        egui::CentralPanel::default().show_inside(viewport_ui, |popup_ui| {
            popup_ui.label("Đã phát hiện Hash mới chưa có trong từ điển.");
            popup_ui.label(format!("Dữ liệu thô: {}", app.unknowns_data));

            popup_ui.add_space(10.0);

            popup_ui.horizontal(|h_ui| {
                if h_ui.button("Lưu vào Dict nội bộ").clicked() {
                    app.show_training_ui = false;
                    app_log!("🎓 Đã học thuộc bài! Hãy Capture lại.");
                }
                if h_ui.button("Hủy").clicked() {
                    app.show_training_ui = false;
                    app_log!("⚠️ Đã hủy huấn luyện.");
                }
            });
        });

        // 3. Bắt sự kiện tắt cửa sổ (bấm nút X)
        if viewport_ui.input(|i| i.viewport().close_requested()) {
            app.show_training_ui = false;
        }

        // Bắt thêm phím ESC cho chuẩn UX
        if viewport_ui.input(|i| i.key_pressed(egui::Key::Escape)) {
            app.show_training_ui = false;
        }
    });
}
