// ==========================================
// TRẠNG THÁI & BIẾN TOÀN CỤC
// ==========================================
const tabSessions: Record<number, string> = {};
const pendingRequests = new Map<string, (response: any) => void>();
let nativePort: chrome.runtime.Port | null = null;

const NATIVE_HOST_NAME = "com.cheatengine.native";

// ==========================================
// QUẢN LÝ KẾT NỐI NATIVE (ĐƯỜNG HẦM .EXE)
// ==========================================
function connectToNativeEngine() {
  if (nativePort) return; // Đã kết nối thì bỏ qua

  console.log("🚀 [Background]: Đang mở cổng lượng tử tới .exe...");
  nativePort = chrome.runtime.connectNative(NATIVE_HOST_NAME);

  // Lắng nghe phản hồi từ file .exe
  nativePort.onMessage.addListener((message: any) => {
    // Nếu tin nhắn có reqId, nghĩa là Rust đã xử lý xong và trả hàng
    if (message && message.reqId && pendingRequests.has(message.reqId)) {
      const sendResponse = pendingRequests.get(message.reqId)!;
      sendResponse(message); // Trả kết quả về cho core_init.ts
      pendingRequests.delete(message.reqId); // Dọn dẹp RAM
    } else {
      console.log(
        "📨 [Native -> Background] Tin nhắn không định tuyến:",
        message,
      );
    }
  });

  // Bắt lỗi khi .exe bị tắt hoặc mất kết nối
  nativePort.onDisconnect.addListener(() => {
    const error = chrome.runtime.lastError?.message;
    console.warn(`⚠️ [Background]: Mất kết nối với .exe. Lý do: ${error}`);
    nativePort = null;

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
  updateBadgeState(false);
});

chrome.action.onClicked.addListener(() => {
  chrome.storage.local.get(["isEngineEnabled"], (result) => {
    const newState = !result.isEngineEnabled;
    chrome.storage.local.set({ isEngineEnabled: newState });
    updateBadgeState(newState);

    // Bật/tắt tự động kết nối .exe dựa theo trạng thái
    if (newState) {
      connectToNativeEngine();
    } else if (nativePort) {
      nativePort.disconnect();
      nativePort = null;
    }
  });
});

function updateBadgeState(isEnabled: boolean) {
  if (isEnabled) {
    chrome.action.setBadgeText({ text: "ON" });
    chrome.action.setBadgeBackgroundColor({ color: "#00ff88" });
  } else {
    chrome.action.setBadgeText({ text: "OFF" });
    chrome.action.setBadgeBackgroundColor({ color: "#ff4444" });
  }
}

// ==========================================
// BỘ ĐỊNH TUYẾN MESSAGE (ROUTER)
// ==========================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  // 1. Logic chụp ảnh màn hình (Giữ nguyên)
  if (request.action === "captureTab") {
    // chrome.tabs.captureVisibleTab(
    //   { format: "jpeg", quality: 80 },
    //   (dataUrl) => {
    //     sendResponse({ imgDataUrl: dataUrl });
    //   },
    // );
    chrome.tabs.captureVisibleTab({ format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ imgDataUrl: dataUrl });
      }
    });
    return true;
  }

  // 2. Logic cấp phát Session ID (Giữ nguyên cấu trúc)
  if (request.action === "GET_SESSION_ID") {
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

  if (request.action === "ENABLE_CDP_ANTI_PAUSE" && sender.tab) {
    const tabId = sender.tab.id;
    const debuggeeId = { tabId: tabId };

    console.log(`[Core] Đang gắn Debugger vào Tab ${tabId}...`);

    // 1. Gắn Debugger (giao thức 1.3 là chuẩn cho CDP hiện tại)
    chrome.debugger.attach(debuggeeId, "1.3", () => {
      if (chrome.runtime.lastError) {
        // Lỗi này thường do tab đã được gắn debugger trước đó rồi, bỏ qua
        console.warn(
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
            console.error(
              "[Core] Lỗi lệnh Focus:",
              chrome.runtime.lastError.message,
            );
          } else {
            console.log(
              "🌌 [Core] Đã khóa Focus đa vũ trụ! Game giờ đã mù dở hoàn toàn.",
            );
          }
        },
      );
    });
  }

  // 3. LOGIC MỚI: Định tuyến BridgePayload qua file .exe
  if (request.reqId) {
    if (!nativePort) connectToNativeEngine();

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

  return false; // Nếu không lọt vào case nào thì đóng cổng
});

// // Lắng nghe cú Click trực tiếp vào Icon trên thanh Bar
// chrome.action.onClicked.addListener((_tab) => {
//   chrome.storage.local.get(["isWasmEnabled"], (result) => {
//     const newState = !result.isWasmEnabled; // Đảo ngược trạng thái
//     chrome.storage.local.set({ isWasmEnabled: newState });

//     // Đổi màu hiển thị trực quan ngay trên Icon
//     if (newState) {
//       chrome.action.setBadgeText({ text: "ON" });
//       chrome.action.setBadgeBackgroundColor({ color: "#00ff88" });
//     } else {
//       chrome.action.setBadgeText({ text: "OFF" });
//       chrome.action.setBadgeBackgroundColor({ color: "#ff4444" });
//     }
//   });
// });

// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.action === "captureTab") {
//     // chrome.tabs.captureVisibleTab(
//     //   { format: "jpeg", quality: 80 },
//     //   (dataUrl) => {
//     //     sendResponse({ imgDataUrl: dataUrl });
//     //   },
//     // );
//     // Tuyệt chiêu chụp ảnh toàn bộ Tab hiện tại
//     chrome.tabs.captureVisibleTab({ format: "png" }, (dataUrl) => {
//       if (chrome.runtime.lastError) {
//         console.error("Lỗi Background:", chrome.runtime.lastError.message);
//         sendResponse({ error: chrome.runtime.lastError.message });
//         return;
//       }
//       sendResponse({ imgDataUrl: dataUrl });
//     });
//     return true; // Bắt buộc phải có dòng này để báo hiệu sẽ trả kết quả bất đồng bộ
//   }
// });

// const tabSessions: Record<number, string> = {};

// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.action === "GET_SESSION_ID") {
//     // Lấy ID của tab hiện tại
//     const tabId = sender.tab?.id;
//     if (!tabId) {
//       sendResponse({ sessionId: crypto.randomUUID() }); // Fallback an toàn
//       return true;
//     }

//     // Nếu tab này chưa có ID thì tạo mới, có rồi thì dùng lại
//     if (!tabSessions[tabId]) {
//       tabSessions[tabId] = crypto.randomUUID();
//     }

//     sendResponse({ sessionId: tabSessions[tabId] });
//   }
//   return true; // Giữ cổng kết nối cho hàm async
// });

// Dọn dẹp RAM khi người dùng đóng Tab
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabSessions[tabId]) {
    delete tabSessions[tabId];
    console.log(`🧹 [Background]: Đã dọn dẹp Session ID của Tab ${tabId}`);

    // Tùy chọn: Gửi tín hiệu báo cho Rust biết Tab này đã chết để giải phóng RAM bên Rust
    if (nativePort) {
      nativePort.postMessage({ action: "TAB_CLOSED", _meta: { tabId } });
    }
  }
});
