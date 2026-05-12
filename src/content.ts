import { logger } from "./utils/logger";

// ==========================================
// CÁC HELPER XỬ LÝ HÌNH ẢNH (GIỮ NGUYÊN)
// ==========================================

// // Helper 1: Chuyển hàm chụp ảnh của Chrome từ Callback sang dạng Promise (Async/Await)
// const captureTabAsync = (): Promise<string> => {
//   return new Promise((resolve, reject) => {
//     chrome.runtime.sendMessage({ action: "captureTab" }, (response) => {
//       if (chrome.runtime.lastError) {
//         reject(
//           new Error(`Lỗi hệ thống Chrome: ${chrome.runtime.lastError.message}`),
//         );
//       } else if (response?.error) {
//         reject(new Error(response.error));
//       } else if (response?.imgDataUrl) {
//         resolve(response.imgDataUrl);
//       } else {
//         reject(new Error("Dữ liệu ảnh trả về trống rỗng!"));
//       }
//     });
//   });
// };

// // Helper 2: Chuyển việc load ảnh thành Promise (Fix luôn cái lỗi thiếu chữ reject của đại ca)
// const loadImageAsync = (dataUrl: string): Promise<HTMLImageElement> => {
//   return new Promise((resolve, reject) => {
//     const img = new Image();
//     img.onload = () => resolve(img);
//     img.onerror = () =>
//       reject(new Error("Trình duyệt từ chối load ảnh Base64"));
//     img.src = dataUrl;
//   });
// };

// ==========================================
// KIỂM TRA IFRAME RÁC (GIỮ NGUYÊN)
// ==========================================

const url = globalThis.location.href;
const isTrashFrame =
  /googleads|googlesyndication|adtrafficquality|doubleclick|2mdn\.net|recaptcha|safeframe|xd_handler|pixel|analytics|about:blank|about:srcdoc/i.test(
    url,
  );

if (!isTrashFrame) {
  let resolveSessionId: (id: string) => void;
  const sessionIdReady = new Promise<string>((resolve) => {
    resolveSessionId = resolve;
  });

  chrome.runtime.sendMessage({ action: "GET_SESSION_ID" }, (response) => {
    if (response?.sessionId) {
      resolveSessionId(response.sessionId); // Kích hoạt nút bấm, mở khóa Promise!
    } else {
      // Backup an toàn nếu lỡ background chưa sẵn sàng
      resolveSessionId(crypto.randomUUID());
    }
  });

  // ==========================================
  // QUẢN LÝ VÒNG ĐỜI ENGINE
  // ==========================================
  chrome.storage.local.get(["isEngineEnabled"], async (result) => {
    if (result.isEngineEnabled) {
      logger.info(
        `🧰 WASM Hacker [ON]: Đang bẫy RAM tại -> ${
          globalThis.location.hostname
        }`,
      );

      const sessionId = await sessionIdReady;
      bootCheatEngine(sessionId);
    } else {
      logger.info(
        `🧰 WASM Hacker [OFF]: Đang ngủ đông tại -> ${
          globalThis.location.hostname
        }`,
      );
    }
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.isWasmEnabled) {
      if (changes.isWasmEnabled.newValue) {
        // ĐANG OFF -> BẬT LÊN: Reload lại trang
        sessionIdReady.then((sessionId) => bootCheatEngine(sessionId));

        logger.info(
          `🧰 WASM Hacker [ACTION]: Đang tải lại trang -> ${
            globalThis.location.hostname
          }`,
        );
      } else {
        logger.info("🛑 Đã tắt Engine.");
      }
    }
  });

  // ==========================================
  // LẮNG NGHE LỆNH TỪ Background/Rust truyền tới
  // ==========================================
  
  async function bootCheatEngine(sessionId: string) {
    logger.info(`🚀 System Hacker Mode ON. Session ID: ${sessionId}`);
    // Khởi tạo các module cào dữ liệu, DOM observer, v.v. tại đây
  }

  // ==========================================
  // Nhận từ anti-pause
  // ==========================================
  globalThis.addEventListener("RELAY_ENABLE_CDP", () => {
    console.log(
      "📨 [Trạm trung chuyển]: Đã nhận lệnh từ Anti-Pause, đang báo cho Background...",
    );

    // Dùng API của Extension để gọi lên Background
    chrome.runtime.sendMessage({ action: "ENABLE_CDP_ANTI_PAUSE" });
  });
}

// ==========================================
// Bridge: Content Script -> Background/Rust
// ==========================================

type BridgeAction = "crop" | "recognize_digit" | "scan_memory";

export interface BridgePayload {
  action: BridgeAction;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  pixels?: number[];
}

// Cấu trúc gói hàng nhận về
export interface BridgeResponse {
  reqId: string;
  data?: Record<string, string> | Uint8Array;
  width?: number;
  height?: number;
  success?: boolean;
  error?: string;
}

export const bridge = (payload: BridgePayload): Promise<BridgeResponse> => {
  return new Promise((resolve, reject) => {
    // Tạo ID cho mỗi request để tránh nhầm lẫn các lệnh gọi bất đồng bộ
    const reqId = crypto.randomUUID();
    const payloadWithId = { ...payload, reqId };

    chrome.runtime.sendMessage(payloadWithId, (response: BridgeResponse) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      if (response?.success === false) {
        const errorMsg = response.error || "Unknown Error";
        return reject(new Error(errorMsg));
      }
      resolve(response);
    });
  });
};
