// ============================================================================
// UI MODULE: MÀN HÌNH KÉO THẢ (BOUNDING BOX SELECTOR)
// Nhiệm vụ: Phủ mờ màn hình, cho phép kéo thả để lấy tọa độ (x, y, w, h)
// ============================================================================

globalThis.startScreenSelection = function (): Promise<{
  x: number;
  y: number;
  width: number;
  height: number;
} | null> {
  return new Promise((resolve) => {
    // Tránh việc bấm liên tục tạo ra nhiều lớp overlay
    if (document.getElementById("ce-selection-overlay")) {
      resolve(null);
      return;
    }

    // 1. Tạo lớp phủ (Overlay) tối màu che toàn màn hình
    const overlay = document.createElement("div");
    overlay.id = "ce-selection-overlay";
    overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.4); z-index: 99999999; 
            cursor: crosshair; user-select: none;
        `;

    // 2. Tạo khung viền đỏ (Khung Bounding Box)
    const box = document.createElement("div");
    box.style.cssText = `
            position: absolute; border: 2px dashed #ff0044; 
            background: rgba(255, 0, 68, 0.2); pointer-events: none; display: none;
        `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    let isDragging = false;
    let startX = 0,
      startY = 0;

    // Bắt sự kiện bấm chuột xuống
    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      box.style.left = startX + "px";
      box.style.top = startY + "px";
      box.style.width = "0px";
      box.style.height = "0px";
      box.style.display = "block";
    };

    // Bắt sự kiện rê chuột (Tính toán kích thước khung)
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const currentX = e.clientX;
      const currentY = e.clientY;

      // Toán học: Tính góc trên cùng bên trái và chiều rộng/cao dù kéo ngược hay xuôi
      const x = Math.min(startX, currentX);
      const y = Math.min(startY, currentY);
      const w = Math.abs(currentX - startX);
      const h = Math.abs(currentY - startY);

      box.style.left = x + "px";
      box.style.top = y + "px";
      box.style.width = w + "px";
      box.style.height = h + "px";
    };

    // Bắt sự kiện nhả chuột (Hoàn thành)
    const onMouseUp = (e: MouseEvent) => {
      if (!isDragging) return;
      isDragging = false;

      const x = Math.min(startX, e.clientX);
      const y = Math.min(startY, e.clientY);
      const w = Math.abs(e.clientX - startX);
      const h = Math.abs(e.clientY - startY);

      cleanup();

      // Chống spam: Nếu chỉ click chuột (không kéo), coi như hủy bỏ
      if (w < 5 || h < 5) {
        resolve(null);
      } else {
        resolve({ x, y, width: w, height: h });
      }
    };

    // Chức năng phụ: Bấm phím ESC để thoát khẩn cấp
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cleanup();
        resolve(null);
      }
    };

    // Dọn dẹp DOM và Sự kiện để tránh rò rỉ bộ nhớ (Memory Leak)
    const cleanup = () => {
      overlay.removeEventListener("mousedown", onMouseDown);
      overlay.removeEventListener("mousemove", onMouseMove);
      overlay.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("keydown", onKeyDown);
      overlay.remove();
    };

    // Gắn "tai nghe" sự kiện vào overlay
    overlay.addEventListener("mousedown", onMouseDown);
    overlay.addEventListener("mousemove", onMouseMove);
    overlay.addEventListener("mouseup", onMouseUp);
    document.addEventListener("keydown", onKeyDown);
  });
};
