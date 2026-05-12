import { logger } from "./utils/logger";

interface INativeMessage {
  reqId?: string;
  action?: string;
  status?: string;
  data?: unknown;
  error?: string;
  [key: string]: unknown; // Linh hoạt cho mọi dữ liệu JSON
}

interface RustCommand {
  action: string;
  [key: string]: unknown;
}

// ==========================================
// TRẠNG THÁI & BIẾN TOÀN CỤC
// ==========================================
const tabSessions: Record<number, string> = {};
const pendingRequests = new Map<string, (response: INativeMessage) => void>();
let nativePort: chrome.runtime.Port | null = null;

const NATIVE_HOST_NAME = "com.cheatengine.native";

// ==========================================
// QUẢN LÝ KẾT NỐI NATIVE (ĐƯỜNG HẦM .EXE)
// ==========================================
function connectToNativeEngine() {
  if (nativePort) return; // Đã kết nối thì bỏ qua

  logger.info("🚀 [Background]: Đang mở cổng lượng tử tới .exe...");
  nativePort = chrome.runtime.connectNative(NATIVE_HOST_NAME);

  // Lắng nghe phản hồi từ file .exe
  nativePort.onMessage.addListener((rawMessage: unknown) => {
    const message = rawMessage as INativeMessage & { action?: string };

    // ==========================================
    // TRƯỜNG HỢP 1: Chrome hỏi -> Rust trả lời
    // ==========================================
    if (
      typeof message.reqId === "string" &&
      pendingRequests.has(message.reqId)
    ) {
      const sendResponse = pendingRequests.get(message.reqId)!;
      sendResponse(message); // Trả kết quả về cho core_init.ts
      pendingRequests.delete(message.reqId); // Dọn dẹp RAM
      return;
    }

    // ==========================================
    // TRƯỜNG HỢP 2: Rust chủ động gửi lệnh cho Chrome (Mô hình mới)
    // ==========================================
    if (typeof message.action === "string") {
      // Gọi cái hàm định tuyến mà ta vừa viết lúc nãy
      handleCommandFromRust(message as RustCommand);
      return;
    }

    // ==========================================
    // TRƯỜNG HỢP 3: Rác hoặc tin nhắn mồ côi
    // ==========================================
    logger.info(
      "📨 [Native -> Background] Tin nhắn không định tuyến:",
      message,
    );
  });

  // Bắt lỗi khi .exe bị tắt hoặc mất kết nối
  nativePort.onDisconnect.addListener(() => {
    const error = chrome.runtime.lastError?.message;
    logger.warn(`⚠️ [Background]: Mất kết nối với .exe. Lý do: ${error}`);
    nativePort = null;

    chrome.storage.local.set({ isEngineEnabled: false }, () => {
      logger.info("🔄 [Background]: Đã tự động chuyển trạng thái sang OFF.");
    });
    setBadgeInactive();

    // Hủy toàn bộ các request đang chờ nêú .exe sập
    for (const [reqId, sendResponse] of pendingRequests.entries()) {
      sendResponse({
        reqId,
        success: false,
        error: "Native Host disconnected",
      });
    }
    pendingRequests.clear();
  });
}

// ==========================================
// QUẢN LÝ VÒNG ĐỜI EXTENSION (UI)
// ==========================================
// Khởi tạo màu sắc ban đầu khi cài Extension
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ isEngineEnabled: false });
  setBadgeInactive();
});

chrome.action.onClicked.addListener(() => {
  logger.info(
    "🔘 [Background]: Icon Extension được bấm, đang toggle trạng thái...",
  );
  chrome.storage.local.get(["isEngineEnabled"], (result) => {
    const newState = !result.isEngineEnabled;
    chrome.storage.local.set({ isEngineEnabled: newState });

    // Bật/tắt tự động kết nối .exe dựa theo trạng thái
    if (newState) {
      logger.info(
        "🟢 [Background]: Cheat Engine đã được kích hoạt. Đang kết nối tới .exe...",
      );
      setBadgeActive();
      connectToNativeEngine();
    } else if (nativePort) {
      logger.info(
        "🔴 [Background]: Cheat Engine đã được tắt. Đang ngắt kết nối từ .exe...",
      );
      setBadgeInactive();
      nativePort.disconnect();
      nativePort = null;
    }
  });
});

function setBadgeActive() {
  chrome.action.setBadgeText({ text: "ON" });
  chrome.action.setBadgeBackgroundColor({ color: "#00ff88" });
}

function setBadgeInactive() {
  chrome.action.setBadgeText({ text: "OFF" });
  chrome.action.setBadgeBackgroundColor({ color: "#ff4444" });
}

// ==========================================
// BỘ ĐỊNH TUYẾN MESSAGE (ROUTER) - lắng nghe content script
// ==========================================

function handleGetSessionId(
  _request: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: { sessionId: string }) => void,
) {
  const tabId = sender.tab?.id;

  if (!tabId) {
    sendResponse({ sessionId: crypto.randomUUID() });
    return true;
  }
  if (!tabSessions[tabId]) {
    tabSessions[tabId] = crypto.randomUUID();
  }
  sendResponse({ sessionId: tabSessions[tabId] });
  return true;
}

function handleEnableCdp(
  _request: unknown,
  sender: chrome.runtime.MessageSender,
  _sendResponse: (response: unknown) => void,
) {
  const tabId = sender.tab?.id;
  const debuggeeId = { tabId: tabId };

  logger.info(`[Core] Đang gắn Debugger vào Tab ${tabId}...`);

  // 1. Gắn Debugger (giao thức 1.3 là chuẩn cho CDP hiện tại)
  chrome.debugger.attach(debuggeeId, "1.3", () => {
    if (chrome.runtime.lastError) {
      // Lỗi này thường do tab đã được gắn debugger trước đó rồi, bỏ qua
      logger.warn(
        "[Core] Cảnh báo gắn Debugger:",
        chrome.runtime.lastError.message,
      );
      return;
    }

    // 2. Bắn lệnh Vua: Bắt buộc nhân trình duyệt luôn Focus
    chrome.debugger.sendCommand(
      debuggeeId,
      "Emulation.setFocusEmulationEnabled",
      { enabled: true },
      () => {
        if (chrome.runtime.lastError) {
          logger.error(
            "[Core] Lỗi lệnh Focus:",
            chrome.runtime.lastError.message,
          );
        } else {
          logger.info(
            "🌌 [Core] Đã khóa Focus đa vũ trụ! Game giờ đã mù dở hoàn toàn.",
          );
        }
      },
    );
  });
}

function handleBridgePayload(
  request: { reqId: string; [key: string]: unknown },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: INativeMessage) => void,
) {
  if (!nativePort) connectToNativeEngine();
  const tabId = sender.tab?.id;

  // Gói thêm thông tin để Rust biết tin nhắn đến từ Tab/Session nào
  const payloadToNative = {
    ...request,
    _meta: {
      tabId: tabId,
      sessionId: tabId ? tabSessions[tabId] : null,
    },
  };

  // Đưa hàm trả lời vào danh sách chờ
  pendingRequests.set(request.reqId, sendResponse);

  // Bắn dữ liệu vào đường hầm!
  nativePort?.postMessage(payloadToNative);

  return true; // Giữ cổng mở chờ .exe gọi lại
}

type MessageHandler = (
  request: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => void | boolean;

const ACTION_HANDLERS: Record<string, MessageHandler> = {
  GET_SESSION_ID: handleGetSessionId,
  ENABLE_CDP_ANTI_PAUSE: handleEnableCdp,
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.reqId) {
    handleBridgePayload(request, sender, sendResponse);
    return;
  }

  if (request.action) {
    const handler = ACTION_HANDLERS[request.action];
    if (handler) {
      // Tìm thấy hàm xử lý tương ứng thì gọi luôn
      return handler(request, sender, sendResponse);
    } else {
      // Log ra để dễ debug nếu lỡ gửi sai tên action
      logger.warn(
        `⚠️ [Router]: Bỏ qua tin nhắn không rõ action: ${request.action}`,
      );
    }
  }

  return false;
});

// Dọn dẹp RAM khi người dùng đóng Tab
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabSessions[tabId]) {
    delete tabSessions[tabId];
    logger.info(`🧹 [Background]: Đã dọn dẹp Session ID của Tab ${tabId}`);

    // Tùy chọn: Gửi tín hiệu báo cho Rust biết Tab này đã chết để giải phóng RAM bên Rust
    if (nativePort) {
      nativePort.postMessage({ action: "TAB_CLOSED", _meta: { tabId } });
    }
  }
});

function handleCommandFromRust(command: RustCommand) {
  logger.info(`📥 [Background]: Nhận lệnh chủ động từ Rust:`, command.action);

  if (command.action === "REQUEST_CAPTURE") {
    // 1. Chụp nhanh toàn bộ màn hình của Tab hiện tại (Chỉ Background mới có quyền này)
    chrome.tabs.captureVisibleTab(
      chrome.windows.WINDOW_ID_CURRENT,
      { format: "png", quality: 100 },
      async (dataUrl) => {
        if (chrome.runtime.lastError) {
          logger.error(
            "❌ Lỗi máy ảnh Chrome:",
            chrome.runtime.lastError.message,
          );
          return;
        }

        try {
          const x = Number(command.x) || 0;
          const y = Number(command.y) || 0;
          const w = Number(command.w) || 0;
          const h = Number(command.h) || 0;

          // 2. Chuyển ảnh Base64 thành dạng Bitmap để nhét vào Canvas
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const bitmap = await createImageBitmap(blob);

          // 3. Xài OffscreenCanvas để CẮT ẢNH CHẠY NGẦM (Không cần DOM, siêu nhanh)
          const canvas = new OffscreenCanvas(w, h);
          const ctx = canvas.getContext("2d");

          if (!ctx) throw new Error("Không tạo được context 2D");

          // Cắt đúng cái ô mà Rust gửi lên
          ctx.drawImage(
            bitmap,
            x,
            y,
            w,
            h, // Tọa độ gốc trên ảnh to
            0,
            0,
            w,
            h, // Tọa độ đích trên ảnh nhỏ
          );

          // 4. Lấy raw pixels (mảng RGBA) ra
          const imageData = ctx.getImageData(0, 0, w, h);

          logger.info(
            `✂️ [Background]: Đã cắt xong ảnh ${w}x${h}, gửi về Rust!`,
          );

          // 5. Ném thẳng mảng pixels về cho Rust OCR
          nativePort?.postMessage({
            action: "CROP_RESULT",
            w: w,
            h: h,
            pixels: Array.from(imageData.data),
          });
        } catch (err) {
          logger.error("❌ Lỗi cắt ảnh ngầm:", err);
        }
      },
    );
  } else {
    logger.warn(`⚠️ [Background]: Lệnh Rust không hợp lệ: ${command.action}`);
  }
}

async function enableExtensionForSite(tab: chrome.tabs.Tab) {
  if (!tab.url || !tab.id) return;

  const url = new URL(tab.url);
  const origin = `${url.origin}/*`;

  // 1. Xin quyền (Chrome tự lưu vào profile, không cần manifest)
  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) return;

  // 2. Đăng ký Script động cho domain này
  // Sau khi chạy lệnh này, Chrome tự động coi content.bundle.js
  // là content_script của riêng domain này mãi mãi.
  try {
    const existingScripts =
      await chrome.scripting.getRegisteredContentScripts();
    const isAlreadyRegistered = existingScripts.some(
      (s) => s.id === `script-${url.hostname}`,
    );

    if (!isAlreadyRegistered) {
      await chrome.scripting.registerContentScripts([
        {
          id: `script-${url.hostname}`,
          js: ["dist/content.bundle.js"],
          matches: [origin],
          runAt: "document_start",
          allFrames: true,
        },
        {
          id: `anti-pause-${url.hostname}`,
          js: ["dist/anti_pause.bundle.js"],
          matches: [origin],
          runAt: "document_start",
          allFrames: true,
          world: "MAIN", // Nhớ giữ nguyên cờ này!
        },
      ]);
      logger.info(`🚀 Đã kích hoạt tàng hình cho ${url.hostname}`);

      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ["dist/content.bundle.js"],
      });

      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ["dist/anti_pause.bundle.js"],
        world: "MAIN",
      });
      logger.info(`💉 Đã tiêm Content Script vào tab hiện tại thành công!`);
    }
  } catch (err) {
    // Dùng _err để báo cho Linter biết là ta cố tình bỏ qua biến này
    logger.warn(
      `⚠️ Không thể đăng ký script, có thể do trùng ID hoặc lỗi hệ thống. ${err}`,
    );
  }
}

// Khi bấm vào Icon Extension
chrome.action.onClicked.addListener((tab) => {
  enableExtensionForSite(tab);
});
