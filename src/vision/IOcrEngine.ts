// File: IOcrEngine.ts
export interface IOcrEngine {
  /**
   * Khởi tạo model (load file thư viện, load AI weights...).
   * Gọi 1 lần duy nhất lúc bật tool để các lần scan sau không bị lag.
   */
  init(): Promise<void>;

  /**
   * Nhận vào ảnh đã crop và trả về con số.
   */
  recognize(imageData: ImageData): Promise<number | null>;
}
