// ============================================================================
// CORE MODULE: BINARY SEGMENT MATCHER (MẮT THẦN ĐỌC SỐ)
// Chuyên trị đọc UI Game bằng thuật toán so khớp điểm ảnh nhị phân
// ============================================================================

import { updateDebugView } from "../utils/debug";
import { BinaryTemplate } from "../global";

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
  async init(): Promise<void> {
    // Với Template Matching cũ của bạn thì chả cần load model nặng nào cả
    // Nên hàm này có thể chỉ log ra 1 câu rồi thôi
    globalThis.logStatus("⚡ Binary Template Engine đã sẵn sàng!", "info");
  },

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

  async recognize(imageData: ImageData): Promise<number | null> {
    // BÊ NGUYÊN ĐOẠN CODE CŨ VÀO ĐÂY
    const binaryData = globalThis.BinaryMatcher.binarize(imageData, 128);

    updateDebugView(
      binaryData,
      imageData.width,
      imageData.height,
      "Binary Threshold",
    );

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

    const trained = await globalThis.BinaryMatcher.ensureTrained(digits);
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
      globalThis.logStatus("Dữ liệu nhận diện lỗi:", rawString);
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
  },

  async ensureTrained(digits: BinaryTemplate[]): Promise<boolean> {
    const guesses = digits.map((digit) =>
      globalThis.BinaryMatcher.match(digit),
    );
    const hasUnknown = guesses.includes("?");

    if (!hasUnknown) return true;

    globalThis.logStatus(
      "⚠️ Mắt Thần gặp ký tự lạ. Vui lòng dạy nó...",
      "warning",
    );
    return await globalThis.showTrainingUI(digits, guesses);
  },
};
