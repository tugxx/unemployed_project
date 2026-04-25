// ============================================================================
// CORE MODULE: BINARY SEGMENT MATCHER (MẮT THẦN ĐỌC SỐ)
// Chuyên trị đọc UI Game bằng thuật toán so khớp điểm ảnh nhị phân
// ============================================================================

// Cấu trúc lưu trữ hình mẫu (Template)
interface BinaryTemplate {
  label: string;
  width: number;
  height: number;
  pixels: Uint8Array; // Mảng 1D chứa các bit 0 (nền) và 1 (chữ)
}

globalThis.visionTemplates = new Map<string, BinaryTemplate>();

/**
 * Trợ thủ 1: Kiểm tra xem một cột dọc có chứa điểm ảnh (pixel) nào của chữ không
 */
function columnHasPixel(
  binaryData: Uint8Array,
  width: number,
  height: number,
  x: number,
): boolean {
  for (let y = 0; y < height; y++) {
    if (binaryData[y * width + x] === 1) {
      return true;
    }
  }
  return false;
}

/**
 * Trợ thủ 2: Cắt và trích xuất ma trận pixel của một chữ số cụ thể
 */
function extractCharPixels(
  binaryData: Uint8Array,
  fullWidth: number,
  height: number,
  startX: number,
  charWidth: number,
): Uint8Array {
  const charPixels = new Uint8Array(charWidth * height);
  for (let cy = 0; cy < height; cy++) {
    for (let cx = 0; cx < charWidth; cx++) {
      charPixels[cy * charWidth + cx] =
        binaryData[cy * fullWidth + (startX + cx)];
    }
  }
  return charPixels;
}

globalThis.BinaryMatcher = {
  /**
   * BƯỚC 1: Binarization (Biến ảnh màu thành ảnh Nhị phân Trắng/Đen)
   * Ngưỡng threshold mặc định là 128 (0-255). Tùy game tối hay sáng mà chỉnh.
   */
  binarize: function (
    imageData: ImageData,
    threshold: number = 128,
  ): Uint8Array {
    const { width, height, data } = imageData;
    const binary = new Uint8Array(width * height);

    for (let i = 0; i < data.length; i += 4) {
      // Chuyển RGB sang Grayscale (Công thức chuẩn độ sáng)
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

      // Nếu điểm ảnh sáng hơn threshold -> chữ (1), tối hơn -> nền (0).
      // (Lưu ý: Đảo ngược 0 và 1 nếu game chữ đen nền trắng)
      binary[i / 4] = gray > threshold ? 1 : 0;
    }
    return binary;
  },

  /**
   * BƯỚC 2: Segmentation (Cắt ảnh dài thành từng chữ số đơn lẻ)
   * Dùng kỹ thuật Vertical Projection Profile (Quét dọc)
   */

  segmentDigits: function (
    binaryData: Uint8Array,
    width: number,
    height: number,
  ): BinaryTemplate[] {
    const digits: BinaryTemplate[] = [];
    let isChar = false;
    let startX = 0;

    // Quét từng cột dọc từ trái sang phải
    for (let x = 0; x < width; x++) {
      const hasPixel = columnHasPixel(binaryData, width, height, x);

      if (hasPixel && !isChar) {
        // Bắt đầu chạm vào viền trái của chữ
        isChar = true;
        startX = x;
      } else if (!hasPixel && isChar) {
        // Chạm vào khoảng trắng -> Kết thúc chữ
        isChar = false;
        const charWidth = x - startX;

        if (charWidth > 2) {
          const pixels = extractCharPixels(
            binaryData,
            width,
            height,
            startX,
            charWidth,
          );
          digits.push({ label: "?", width: charWidth, height, pixels });
        }
      }
    }

    if (isChar) {
      const charWidth = width - startX;
      if (charWidth > 2) {
        const pixels = extractCharPixels(
          binaryData,
          width,
          height,
          startX,
          charWidth,
        );
        digits.push({ label: "?", width: charWidth, height, pixels });
      }
    }

    return digits;
  },

  /**
   * BƯỚC 3: So khớp (Bitwise Compare)
   * Trả về nhãn (label) của template giống nhất
   */
  match: function (target: BinaryTemplate): string {
    let bestMatch = "?";
    let highestScore = 0;

    globalThis.visionTemplates.forEach((template, label) => {
      // Tối ưu tốc độ: Nếu kích thước lệch nhau quá nhiều thì bỏ qua luôn
      if (Math.abs(target.width - template.width) > 3) return;

      let matchCount = 0;
      const totalPixels = target.width * target.height;

      // Resize nhanh (cắt viền) để so khớp nếu width không đều
      const minW = Math.min(target.width, template.width);
      const minH = Math.min(target.height, template.height);

      for (let y = 0; y < minH; y++) {
        for (let x = 0; x < minW; x++) {
          const targetBit = target.pixels[y * target.width + x];
          const templateBit = template.pixels[y * template.width + x];

          if (targetBit === templateBit) {
            matchCount++;
          }
        }
      }

      // Công thức tính độ chính xác (%)
      const score = (matchCount / totalPixels) * 100;

      if (score > highestScore) {
        highestScore = score;
        bestMatch = label;
      }
    });

    // Nếu độ giống nhau thấp hơn 85%, coi như không nhận diện được
    return highestScore > 85 ? bestMatch : "?";
  },

  /**
   * HÀM TIỆN ÍCH: Lưu Template vào não (Huấn luyện)
   */
  train: function (label: string, template: BinaryTemplate) {
    template.label = label;
    globalThis.visionTemplates.set(label, template);
    globalThis.logStatus(`🧠 Đã học xong hình dáng số: [${label}]`, "success");
  },
};

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
  }

  // 2
  globalThis.logStatus(
    "📸 Đang chụp ảnh màn hình để xuyên thủng WebGL...",
    "info",
  );
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
  const offscreen = new OffscreenCanvas(
    globalThis.visionBox.width,
    globalThis.visionBox.height,
  );
  const ctx = offscreen.getContext("2d");
  if (!ctx) return null;

  // Lấy đúng góc tọa độ visionBox bứng sang
  const dpr = window.devicePixelRatio || 1;
  ctx.drawImage(
    imageBitmap,
    globalThis.visionBox.x * dpr,
    globalThis.visionBox.y * dpr,
    globalThis.visionBox.width * dpr,
    globalThis.visionBox.height * dpr,
    0,
    0,
    offscreen.width,
    offscreen.height,
  );

  // 4. Lấy dữ liệu điểm ảnh và đưa cho Mắt Thần nhai
  const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
  imageBitmap.close(); // Xóa bỏ bức ảnh gốc khổng lồ khỏi VRAM của Card màn hình
  const binaryData = globalThis.BinaryMatcher.binarize(imageData, 128); // 128 là ngưỡng sáng mặc định
  const digits = globalThis.BinaryMatcher.segmentDigits(
    binaryData,
    offscreen.width,
    offscreen.height,
  );

  if (globalThis.visionTemplates.size === 0) {
    globalThis.logStatus(
      "⚠️ Phát hiện font chữ lạ. Mở giao diện huấn luyện...",
      "warning",
    );

    // Luồng code sẽ BỊ ĐÓNG BĂNG tại đây, chờ người dùng bấm "Lưu" hoặc "Hủy"
    const isTrained = await globalThis.showTrainingUI(digits);

    if (!isTrained) {
      globalThis.logStatus("❌ Đã hủy huấn luyện Mắt Thần.", "error");
      return null;
    }

    globalThis.logStatus(
      "✅ Đã học thuộc lòng font chữ thành công!",
      "success",
    );
  }

  // 5. Giải mã và ghép số
  let rawString = "";
  for (const char of digits) {
    rawString += globalThis.BinaryMatcher.match(char);
  }

  // Lọc bỏ sạch sẽ rác (icon, chữ cái, dấu ?), chỉ giữ số
  const cleanNumberStr = rawString.replaceAll(/\D/g, "");

  if (!cleanNumberStr) return null;
  return Number.parseInt(cleanNumberStr, 10);
};
