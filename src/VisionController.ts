import { IOcrEngine } from "./vision/IOcrEngine";
import { TesseractEngine } from "./vision/TesseractEngine"; // sonar
import { updateDebugView } from "./utils/debug";
// import { OcradEngine } from "./vision/OcradEngine"; sonar
// import { BinaryMatcher } from "./vision/binary_matcher"; sonar

// const IS_DEBUG_VISION = false; sonar
// globalThis.currentOcrEngine = new BinaryMatcher() as IOcrEngine; sonar
globalThis.currentOcrEngine = new TesseractEngine() as IOcrEngine; // sonar
// globalThis.currentOcrEngine = new OcradEngine() as IOcrEngine; sonar

globalThis.autoReadScreenValue = async function (): Promise<number | null> {
  // 1. Nếu chưa khoanh vùng, yêu cầu người dùng khoanh ngay lập tức
  if (!globalThis.visionBox) {
    globalThis.logStatus(
      "🖱️ Vui lòng khoanh vùng chứa con số trên Game...",
      "info",
    );
    const box = await globalThis.startScreenSelection();
    if (!box) {
      globalThis.logStatus("⚠️ Đã hủy khoanh vùng màn hình.", "warning");
      return null;
    }
    globalThis.visionBox = box; // Lưu lại xài cho Next Scan

    renderPersistentBox(box);
  }

  const currentBox = globalThis.visionBox;
  if (!currentBox) return null;

  // 2. Chụp và xử lý ảnh nhị phân
  const imageData = await captureAndCrop(currentBox);
  if (!imageData) return null;

  await globalThis.currentOcrEngine.init();

  updateDebugView(
    imageData,
    imageData.width,
    imageData.height,
    "Tesseract Crop",
  );

  const result = await globalThis.currentOcrEngine.recognize(imageData);

  if (result && result.length > 1) {
    globalThis.logStatus(
      `Phát hiện ${result.length} số, sẽ chọn ra số đầu tiên: ${result[0]}`,
      "warning",
    );
  }

  // 5. Xử lý kết quả trả về
  if (result === null) {
    globalThis.logStatus(
      "⚠️ Không đọc được số nào. Có thể vùng khoanh bị lệch.",
      "error",
    );
    // Tự phục hồi: Xóa box lỗi để người dùng khoanh lại
    // globalThis.visionBox = null;
    // document.getElementById("ce-persistent-box")?.remove();
    return null;
  }

  return result[0];
};

function renderPersistentBox(box: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  let persistentBox = document.getElementById(
    "ce-persistent-box",
  ) as HTMLDivElement | null;

  if (!persistentBox) {
    persistentBox = document.createElement("div");
    persistentBox.id = "ce-persistent-box";

    // pointer-events: none là cực kỳ quan trọng để không cản trở click chuột vào game
    persistentBox.style.cssText = `
      position: fixed;
      border: 2px dashed #00ff88;
      background: rgba(0, 255, 136, 0.05);
      z-index: 9999998;
      pointer-events: none;
      box-sizing: border-box;
      box-shadow: 0 0 8px rgba(0, 255, 136, 0.5);
      transition: all 0.15s ease-out;
    `;

    document.body.appendChild(persistentBox);
  }

  // Cập nhật vị trí và kích thước theo box mới nhất
  persistentBox.style.left = box.x + "px";
  persistentBox.style.top = box.y + "px";
  persistentBox.style.width = box.width + "px";
  persistentBox.style.height = box.height + "px";
}

async function captureAndCrop(box: {
  x: number;
  y: number;
  width: number;
  height: number;
}): Promise<ImageData | null> {
  if (!box) return null;

  globalThis.logStatus("📸 Đang chụp ảnh màn hình", "info");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    // Tạo ID ngẫu nhiên để không bị lẫn lộn nếu ấn liên tục
    const messageId = Math.random().toString(36).substring(2);

    // Bật radar lắng nghe kết quả trả về
    const listener = (event: MessageEvent) => {
      if (event.source !== globalThis.window) return;
      if (
        event.data?.action === "RESPONSE_SCREENSHOT" &&
        event.data.messageId === messageId
      ) {
        globalThis.removeEventListener("message", listener); // Nhận được rồi thì tắt radar
        if (event.data.error) {
          reject(new Error("Chrome từ chối chụp ảnh: " + event.data.error));
          return;
        }
        if (!event.data.dataUrl) {
          reject(new Error("Background trả về ảnh trống!"));
          return;
        }
        resolve(event.data.dataUrl);
      }
    };
    globalThis.addEventListener("message", listener);

    // Bắn tín hiệu yêu cầu chụp ảnh lên Content Script
    globalThis.postMessage(
      { action: "REQUEST_SCREENSHOT", messageId },
      globalThis.location.origin,
    );
  });

  // Tải ảnh chụp toàn màn hình vào bộ nhớ
  const base64Data = dataUrl.split(",")[1]; // Cắt bỏ chữ "data:image/jpeg;base64,"
  const byteString = atob(base64Data);

  // Chuyển đổi siêu tốc trong RAM sang mảng nhị phân
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.codePointAt(i) ?? 0;
  }

  const blob = new Blob([ab], { type: "image/jpeg" });
  const imageBitmap = await createImageBitmap(blob);

  // 3. Tạo một Canvas ẩn để "copy" vùng ảnh đã khoanh
  const offscreen = new OffscreenCanvas(box.width, box.height);
  const ctx = offscreen.getContext("2d");
  if (!ctx) return null;

  // Lấy đúng góc tọa độ visionBox bứng sang
  const dpr = globalThis.devicePixelRatio || 1;
  const margin = 2;
  const cropWidth = box.width - margin * 2;
  const cropHeight = box.height - margin * 2;

  ctx.drawImage(
    imageBitmap,
    (box.x + margin) * dpr,
    (box.y + margin) * dpr,
    cropWidth * dpr,
    cropHeight * dpr,
    0,
    0,
    cropWidth,
    cropHeight,
  );

  imageBitmap.close();

  const imageData = ctx.getImageData(0, 0, cropWidth, cropHeight);
  updateDebugView(imageData, cropWidth, cropHeight, "Raw Crop");

  return ctx.getImageData(0, 0, box.width, box.height);
}
