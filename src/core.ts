// File: src/injected_main.ts

// ==========================================
// BƯỚC 0: DẠY TYPESCRIPT (Không sinh ra JS)
// ==========================================
import "./global.d.ts";
import "./vision/IOcrEngine";

// ==========================================
// BƯỚC 1: TIỆN ÍCH (Độc lập, chạy mọi nơi)
// ==========================================
import "./utils/debug"; // Chứa hàm updateDebugView

// ==========================================
// BƯỚC 2: CORE MODULE - BỘ NHỚ (Ưu tiên tóm RAM sớm)
// ==========================================
import "./memory_hooker"; // Hook WebAssembly ngay khi có thể
import "./scanner_engine"; // Logic quét RAM
import "./memory_writer"; // Logic sửa RAM

// ==========================================
// BƯỚC 3: VISION MODULE - MẮT THẦN
// ==========================================
// 3.1. Các thư viện Model (Phải load trước để Controller có cái mà gọi)
import "./vision/binary_matcher"; // Template engine cũ
import "./vision/TesseractEngine"; // Tesseract AI

// 3.2. Công cụ chọn vùng
import "./screen_selector"; // Sinh ra visionBox

// 3.3. Bộ điều phối trung tâm của Mắt thần
import "./VisionController"; // Gọi captureAndCrop, debug, và Model

// ==========================================
// BƯỚC 4: GIAO DIỆN (Nạp cuối cùng)
// ==========================================
// UI phải load cuối vì nó cần gán sự kiện cho các nút bấm
// (Nút Scan gọi scanner_engine, nút OCR gọi VisionController)
import "./ui_view";
