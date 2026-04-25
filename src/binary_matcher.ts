// ============================================================================
// CORE MODULE: BINARY SEGMENT MATCHER (MẮT THẦN ĐỌC SỐ)
// Chuyên trị đọc UI Game bằng thuật toán so khớp điểm ảnh nhị phân
// ============================================================================

const IS_DEBUG_VISION = false;

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
        this.addValidatedDigit(digits, binaryData, width, height, startX, x);
      }
    }

    if (isChar) {
      this.addValidatedDigit(digits, binaryData, width, height, startX, width);
    }

    globalThis.logStatus(
      `🔍 Tìm thấy ${digits.length} ký tự tiềm năng.`,
      "info",
    );
    return digits;
  },

  addValidatedDigit: function (
    digits: BinaryTemplate[],
    binaryData: Uint8Array,
    width: number,
    height: number,
    startX: number,
    endX: number,
  ) {
    const charWidth = endX - startX;
    if (charWidth <= 2) return; // Bỏ qua nếu quá hẹp

    // 1. Lọc rác dọc (vạch kẻ)
    if (charWidth < 4) {
      console.log(`🗑️ Đã lọc bỏ rác dọc tại X:${startX} (width: ${charWidth})`);
      return;
    }

    // 2. Cảnh báo nếu khối quá lớn (Dùng actualHeight để fix lỗi ESLint)
    const actualHeight = height;
    if (charWidth > actualHeight * 1.2) {
      console.warn(
        `⚠️ Khối tại X:${startX} quá lớn (rộng ${charWidth}px). Có thể dính chùm!`,
      );
    }

    // 3. Trích xuất pixel
    const pixels = extractCharPixels(
      binaryData,
      width,
      height,
      startX,
      charWidth,
    );
    digits.push({ label: "?", width: charWidth, height: actualHeight, pixels });

    console.log(
      `[Segment] Đã cắt khối: Rộng ${charWidth}px, Tọa độ X: ${startX}`,
    );
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

    console.log(
      `[Match Result] Kết quả tốt nhất: [${bestMatch}] với độ khớp: ${highestScore.toFixed(1)}%`,
    );

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

function updateBinaryDebugView(
  binaryData: Uint8Array,
  width: number,
  height: number,
  label: string = "AI Vision",
) {
  const debugCanvas = document.createElement("canvas");
  debugCanvas.width = width;
  debugCanvas.height = height;
  const dctx = debugCanvas.getContext("2d");
  if (!dctx) return;

  const dImgData = dctx.createImageData(width, height);

  for (let i = 0; i < binaryData.length; i++) {
    // 1 -> Vàng chanh rực rỡ, 0 -> Đen xì
    const color = binaryData[i] === 1 ? 255 : 0;
    const p = i * 4;
    dImgData.data[p] = color; // R
    dImgData.data[p + 1] = color; // G
    dImgData.data[p + 2] = 0; // B
    dImgData.data[p + 3] = 255; // Alpha
  }
  dctx.putImageData(dImgData, 0, 0);

  // Quản lý Element hiển thị
  let debugUI = document.getElementById("ce-debug-vision") as HTMLImageElement;
  if (!debugUI) {
    debugUI = document.createElement("img");
    debugUI.id = "ce-debug-vision";
    // pointer-events: none để không cản trở thao tác game
    debugUI.style.cssText = `
      position: fixed; bottom: 10px; right: 10px; z-index: 9999999; 
      border: 2px solid #ff0055; background: #000; width: 250px; 
      image-rendering: pixelated; pointer-events: none;
      box-shadow: 0 0 15px rgba(255, 0, 85, 0.5);
    `;
    document.body.appendChild(debugUI);
  }

  debugUI.src = debugCanvas.toDataURL();
  console.log(`👁️ [${label}] Đã cập nhật ảnh X-Ray (${width}x${height})`);
}

async function captureAndCrop(box: {
  x: number;
  y: number;
  width: number;
  height: number;
}): Promise<ImageData | null> {
  if (!box) return null;

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
  const offscreen = new OffscreenCanvas(box.width, box.height);
  const ctx = offscreen.getContext("2d");
  if (!ctx) return null;

  // Lấy đúng góc tọa độ visionBox bứng sang
  const dpr = globalThis.devicePixelRatio || 1;
  const margin = 2;
  ctx.drawImage(
    imageBitmap,
    (box.x + margin) * dpr,
    (box.y + margin) * dpr,
    (box.width - margin * 2) * dpr,
    (box.height - margin * 2) * dpr,
    0,
    0,
    box.width - margin * 2,
    box.height - margin * 2,
  );

  imageBitmap.close();

  // offscreen.convertToBlob().then((blob) => {
  //   const reader = new FileReader();
  //   reader.onloadend = () => {
  //     const base64data = reader.result as string;

  //     // Tạo một cái ảnh nổi trên màn hình để soi
  //     let debugUI = document.getElementById(
  //       "ce-debug-vision",
  //     ) as HTMLImageElement;
  //     if (!debugUI) {
  //       debugUI = document.createElement("img");
  //       debugUI.id = "ce-debug-vision";
  //       debugUI.style.cssText =
  //         "position:fixed; bottom:10px; right:10px; z-index:9999999; border:2px solid red; background:#000; width:200px; image-rendering:pixelated;";
  //       document.body.appendChild(debugUI);
  //     }
  //     debugUI.src = base64data;
  //     console.log("👁️ Mắt Thần đang nhìn thấy ảnh hiện ở góc màn hình!");
  //   };
  //   reader.readAsDataURL(blob);
  // });

  return ctx.getImageData(0, 0, box.width, box.height);
}

async function ensureTrained(digits: BinaryTemplate[]): Promise<boolean> {
  const guesses = digits.map((digit) => globalThis.BinaryMatcher.match(digit));
  const hasUnknown = guesses.includes("?");

  if (!hasUnknown) return true;

  globalThis.logStatus(
    "⚠️ Mắt Thần gặp ký tự lạ. Vui lòng dạy nó...",
    "warning",
  );
  return await globalThis.showTrainingUI(digits, guesses);
}

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

  // 4. Lấy dữ liệu điểm ảnh và đưa cho Mắt Thần nhai
  const binaryData = globalThis.BinaryMatcher.binarize(imageData, 128); // 128 là ngưỡng sáng mặc định
  if (IS_DEBUG_VISION) {
    updateBinaryDebugView(
      binaryData,
      currentBox.width,
      currentBox.height,
      "Check Threshold",
    );
  }
  const digits = globalThis.BinaryMatcher.segmentDigits(
    binaryData,
    imageData.width,
    imageData.height,
  );

  if (digits.length === 0) {
    globalThis.logStatus(
      "⚠️ Vùng khoanh trống trơn (không tìm thấy hình khối nào). Đang reset vùng chọn...",
      "error",
    );

    // Xóa luôn cái box lỗi để lần sau bấm Scan nó bắt khoanh lại
    globalThis.visionBox = null;
    document.getElementById("ce-persistent-box")?.remove();
    return null;
  }

  const trained = await ensureTrained(digits);
  if (!trained) return null;

  let rawString = "";
  let unmatchCount = 0;

  for (const char of digits) {
    const res = globalThis.BinaryMatcher.match(char);
    if (res === "?") unmatchCount++;
    rawString += res;
  }

  if (rawString.includes("?")) {
    globalThis.logStatus(
      `❌ Thất bại: Nhận diện được ${digits.length} khối nhưng có ${unmatchCount} khối không khớp mẫu (score < 85%).`,
      "warning",
    );
    // In chuỗi kết quả lỗi ra console để soi: ví dụ "1?0"
    console.log("Dữ liệu nhận diện lỗi:", rawString);
    return null;
  }

  // Lọc bỏ sạch sẽ rác (icon, chữ cái, dấu ?), chỉ giữ số
  const cleanNumberStr = rawString.replaceAll(/\D/g, "");
  if (!cleanNumberStr) {
    globalThis.logStatus(
      "❌ Thất bại: Kết quả nhận diện không chứa chữ số nào.",
      "error",
    );
    return null;
  }

  return Number.parseInt(cleanNumberStr, 10);
};
