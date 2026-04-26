// File: TesseractEngine.ts
import Tesseract from "tesseract.js";
import { IOcrEngine } from "./IOcrEngine";

export class TesseractEngine implements IOcrEngine {
  private worker: Tesseract.Worker | null = null;
  private isInitialized = false;

  async init(): Promise<void> {
    if (this.isInitialized) return;

    globalThis.logStatus("⏳ Đang tải Mạch não Tesseract AI...", "info");

    try {
      this.worker = await Tesseract.createWorker("eng", 1, {
        // Có thể thêm logger để xem tiến độ tải model nếu muốn
        // logger: m => console.log(m)
      });

      // Ép Tesseract CHỈ nhận diện số, bỏ qua bảng chữ cái để tăng tốc độ độ và độ chính xác
      await this.worker.setParameters({
        tessedit_char_whitelist: "0123456789",
      });

      this.isInitialized = true;
      globalThis.logStatus("✅ Tesseract AI đã sẵn sàng!", "info");
    } catch (error) {
      console.error("Lỗi khởi tạo Tesseract:", error);
      globalThis.logStatus("❌ Lỗi khởi tạo Tesseract AI", "error");
    }
  }

  async recognize(imageData: ImageData): Promise<number | null> {
    if (!this.worker) {
      console.error("Tesseract chưa được khởi tạo! Hãy gọi init() trước.");
      return null;
    }

    try {
      // Tesseract.js trên trình duyệt nhận DataURL hoặc Canvas
      const canvas = document.createElement("canvas");
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("Trình duyệt không hỗ trợ Canvas 2D hoặc hết bộ nhớ.");
        return null;
      }
      ctx.putImageData(imageData, 0, 0);
      const dataUrl = canvas.toDataURL("image/png");

      // Bắt đầu nhận diện
      const {
        data: { text },
      } = await this.worker.recognize(dataUrl);

      // Lọc sạch mọi thứ, chỉ giữ lại số (đề phòng whitelist vẫn lọt rác)
      const cleanText = text.replaceAll(/\D/g, "");

      if (!cleanText) {
        return null;
      }

      return Number.parseInt(cleanText, 10);
    } catch (error) {
      console.error("Lỗi khi đọc ảnh bằng Tesseract:", error);
      return null;
    }
  }
}
