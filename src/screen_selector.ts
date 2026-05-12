// // ============================================================================
// // UI MODULE: MÀN HÌNH KÉO THẢ (BOUNDING BOX SELECTOR)
// // Nhiệm vụ: Phủ mờ màn hình, cho phép kéo thả để lấy tọa độ (x, y, w, h)
// // ============================================================================

// export async function startScreenSelection(): Promise<{
//   x: number;
//   y: number;
//   width: number;
//   height: number;
// } | null> {
//   return new Promise((resolve) => {
//     let isDragging = false;
//     let startClientX = 0,
//       startClientY = 0; // Để cắt ảnh (Web coordinates)
//     let startScreenX = 0,
//       startScreenY = 0; // Để vẽ UI (OS coordinates)

//     const onMouseDown = (e: MouseEvent) => {
//       isDragging = true;
//       startClientX = e.clientX;
//       startClientY = e.clientY;
//       startScreenX = e.screenX;
//       startScreenY = e.screenY;
//     };

//     const onMouseMove = (e: MouseEvent) => {
//       // Bắt buộc phải có click chuột mới vẽ
//       if (!isDragging) return;

//       // 🚀 BẮN REAL-TIME TỌA ĐỘ LÊN RUST ĐỂ NÓ VẼ KHUNG MÀU ĐỎ TRÊN MÀN HÌNH WINDOWS
//       chrome.runtime.sendMessage({
//         action: "AREA_SELECTED",
//         box: {
//           x: Math.min(startScreenX, e.screenX),
//           y: Math.min(startScreenY, e.screenY),
//           w: Math.abs(e.screenX - startScreenX),
//           h: Math.abs(e.screenY - startScreenY),
//         },
//       });
//     };

//     const onMouseUp = (e: MouseEvent) => {
//       if (!isDragging) return;
//       isDragging = false;

//       cleanup();

//       // Tính toán kích thước
//       const w = Math.abs(e.clientX - startClientX);
//       const h = Math.abs(e.clientY - startClientY);

//       // Chống spam: Nếu vùng chọn quá nhỏ (< 5px), coi như hủy bỏ
//       if (w < 5 || h < 5) {
//         resolve(null);
//       } else {
//         // Chốt Tọa độ Web trả về để background cắt ảnh
//         resolve({
//           x: Math.min(startClientX, e.clientX),
//           y: Math.min(startClientY, e.clientY),
//           width: w,
//           height: h,
//         });
//       }
//     };

//     // Chức năng phụ: Bấm phím ESC để thoát khẩn cấp
//     const onKeyDown = (e: KeyboardEvent) => {
//       if (e.key === "Escape") {
//         cleanup();
//         resolve(null);
//       }
//     };

//     const cleanup = () => {
//       globalThis.removeEventListener("mousedown", onMouseDown);
//       globalThis.removeEventListener("mousemove", onMouseMove);
//       globalThis.removeEventListener("mouseup", onMouseUp);
//       globalThis.removeEventListener("keydown", onKeyDown);
//     };

//     // Gắn "tai nghe" sự kiện thẳng vào window, không đụng chạm DOM
//     globalThis.addEventListener("mousedown", onMouseDown);
//     globalThis.addEventListener("mousemove", onMouseMove);
//     globalThis.addEventListener("mouseup", onMouseUp);
//     globalThis.addEventListener("keydown", onKeyDown);
//   });
// }

// // export function renderPersistentBox(box: {
// //   x: number;
// //   y: number;
// //   width: number;
// //   height: number;
// // }) {
// //   let persistentBox = document.getElementById(
// //     "ce-persistent-box",
// //   ) as HTMLDivElement | null;

// //   if (!persistentBox) {
// //     persistentBox = document.createElement("div");
// //     persistentBox.id = "ce-persistent-box";

// //     // pointer-events: none là cực kỳ quan trọng để không cản trở click chuột vào game
// //     persistentBox.style.cssText = `
// //       position: fixed;
// //       border: 2px dashed #00ff88;
// //       background: rgba(0, 255, 136, 0.05);
// //       z-index: 9999998;
// //       pointer-events: none;
// //       box-sizing: border-box;
// //       box-shadow: 0 0 8px rgba(0, 255, 136, 0.5);
// //       transition: all 0.15s ease-out;
// //     `;

// //     document.body.appendChild(persistentBox);
// //   }

// //   // Cập nhật vị trí và kích thước theo box mới nhất
// //   persistentBox.style.left = box.x + "px";
// //   persistentBox.style.top = box.y + "px";
// //   persistentBox.style.width = box.width + "px";
// //   persistentBox.style.height = box.height + "px";
// // }
