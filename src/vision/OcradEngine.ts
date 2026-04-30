import { IOcrEngine } from "./IOcrEngine";

declare const OCRAD: (
  image: ImageData | HTMLCanvasElement | HTMLImageElement,
) => string;

export class OcradEngine implements IOcrEngine {
  private readonly workspaceCanvas = document.createElement("canvas");
  private readonly workspaceCtx = this.workspaceCanvas.getContext("2d", {
    willReadFrequently: true,
  });

  async init(): Promise<void> {
    // Ocrad không cần tải data, khởi tạo ngay lập tức
    console.log("⚡ Ocrad Engine đã sẵn sàng!");
  }

  private calculateHistogramAndGrays(
    data: Uint8ClampedArray,
    totalPixels: number,
  ) {
    const grays = new Uint8ClampedArray(totalPixels);
    const histogram = new Array(256).fill(0);

    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const gray = Math.round(
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2],
      );
      grays[j] = gray;
      histogram[gray]++;
    }

    return { grays, histogram };
  }

  private calculateOtsuThreshold(
    histogram: number[],
    totalPixels: number,
  ): number {
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * histogram[i];

    let sumB = 0;
    let wB = 0;
    let varMax = 0;
    let threshold = 0;

    for (let t = 0; t < 256; t++) {
      wB += histogram[t];
      if (wB === 0) continue;

      const wF = totalPixels - wB;
      if (wF === 0) break;

      sumB += t * histogram[t];

      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const varBetween = wB * wF * (mB - mF) * (mB - mF);

      if (varBetween > varMax) {
        varMax = varBetween;
        threshold = t;
      }
    }

    return threshold;
  }

  private determinePolarityInvert(
    grays: Uint8ClampedArray,
    threshold: number,
  ): boolean {
    let pixelsAbove = 0;

    // Tối ưu: Chỉ cần đếm 1 bên, bên còn lại dùng phép trừ
    for (const element of grays) {
      if (element >= threshold) pixelsAbove++;
    }

    const pixelsBelow = grays.length - pixelsAbove;

    // Đảo cực nếu số pixel sáng ít hơn số pixel tối (chữ trắng nền đen)
    return pixelsAbove < pixelsBelow;
  }

  private applyThresholdToImage(
    data: Uint8ClampedArray,
    grays: Uint8ClampedArray,
    threshold: number,
    invert: boolean,
  ): void {
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const gray = grays[j];
      const isForeground = invert ? gray >= threshold : gray < threshold;
      const finalColor = isForeground ? 0 : 255;

      data[i] = finalColor; // R
      data[i + 1] = finalColor; // G
      data[i + 2] = finalColor; // B
      // Alpha (data[i + 3]) giữ nguyên
    }
  }

  preprocessImageForOCR(imageData: ImageData): ImageData {
    const data = imageData.data;
    const totalPixels = data.length / 4;

    const { grays, histogram } = this.calculateHistogramAndGrays(
      data,
      totalPixels,
    );

    const threshold = this.calculateOtsuThreshold(histogram, totalPixels);

    const invert = this.determinePolarityInvert(grays, threshold);

    this.applyThresholdToImage(data, grays, threshold, invert);

    return imageData;
  }

  async recognize(imageData: ImageData): Promise<number[] | null> {
    try {
      const processedImageData = this.preprocessImageForOCR(imageData);

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = imageData.width;
      tempCanvas.height = imageData.height;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) {
        console.error("Trình duyệt không hỗ trợ Canvas 2D hoặc hết bộ nhớ.");
        return null;
      }

      tempCtx.putImageData(processedImageData, 0, 0);
      const scale = 3; // Phóng to 300% cho AI hết "cận thị"
      const padding = 20; // Bơm thêm viền trắng 20px xung quanh để tránh Hội chứng Tight Crop

      // 4. TẠO CANVAS CHÍNH (Đã được buff kích thước)
      this.workspaceCanvas.width = imageData.width * scale + padding * 2;
      this.workspaceCanvas.height = imageData.height * scale + padding * 2;
      const ctx = this.workspaceCtx;
      if (!ctx) return null;

      // 5. ĐỔ NỀN TRẮNG TOÀN BỘ (Cực kỳ quan trọng để tạo Padding)
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(
        0,
        0,
        this.workspaceCanvas.width,
        this.workspaceCanvas.height,
      );

      // 6. Tắt tính năng làm mờ ảnh của trình duyệt (Giữ cho font Pixel game sắc cạnh, không bị nhòe khi phóng to)
      ctx.imageSmoothingEnabled = false;

      // 7. IN ẢNH TỪ CANVAS TẠM SANG CANVAS CHÍNH (Đặt vào giữa, xung quanh là viền trắng)
      ctx.drawImage(
        tempCanvas,
        padding,
        padding,
        imageData.width * scale,
        imageData.height * scale,
      );

      const text = OCRAD(this.workspaceCanvas);
      globalThis.logStatus(`Ocrad nhận diện được text: "${text}"`, "info");

      let fixText = text.replaceAll(/[Oo]/g, "0").replaceAll(/[lI]/g, "1");

      fixText = fixText.replaceAll(/[,.]/g, "");

      const matchedNumbers = fixText.match(/\d+/g);

      if (!matchedNumbers || matchedNumbers.length === 0) {
        return null;
      }

      const results = matchedNumbers.map((numStr) =>
        Number.parseInt(numStr, 10),
      );

      return results;
    } catch (error) {
      console.error("Lỗi khi chạy Ocrad:", error);
      return null;
    }
  }

  async terminate(): Promise<void> {
    // Không có worker để đóng, hàm này để trống cũng được
  }
}
