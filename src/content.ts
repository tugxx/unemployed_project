// Cấu trúc yêu cầu cắt ảnh từ Rust gửi sang
interface CropRequest {
  action: "crop" | "get_dict" | "set_dict";
  reqId: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  dictData?: Record<string, string>;
}

// Cấu trúc phản hồi từ Content Script trả về Rust
interface CropResponse {
  reqId: string;
  data: Uint8Array;
  width?: number;
  height?: number;
  success?: boolean;
  error?: string;
}

// ==========================================
// CÁC HELPER XỬ LÝ HÌNH ẢNH (GIỮ NGUYÊN)
// ==========================================

// Helper 1: Chuyển hàm chụp ảnh của Chrome từ Callback sang dạng Promise (Async/Await)
const captureTabAsync = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "captureTab" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(
          new Error(`Lỗi hệ thống Chrome: ${chrome.runtime.lastError.message}`),
        );
      } else if (response?.error) {
        reject(new Error(response.error));
      } else if (response?.imgDataUrl) {
        resolve(response.imgDataUrl);
      } else {
        reject(new Error("Dữ liệu ảnh trả về trống rỗng!"));
      }
    });
  });
};

// Helper 2: Chuyển việc load ảnh thành Promise (Fix luôn cái lỗi thiếu chữ reject của đại ca)
const loadImageAsync = (dataUrl: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("Trình duyệt từ chối load ảnh Base64"));
    img.src = dataUrl;
  });
};

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
    resolveSessionId = resolve; // Giữ lại hàm mở khóa để gọi sau
  });

  // // ==========================================
  // // XỬ LÝ HOTKEY (CHUYỂN HƯỚNG XUỐNG .EXE)
  // // ==========================================
  // globalThis.addEventListener(
  //   "keydown",
  //   (event: KeyboardEvent) => {
  //     if (event.repeat) return;

  //     if (event.code === "Insert") {
  //       console.log("⚡ [Content Script]: 🎯 ĐÃ HỚT TAY TRÊN PHÍM INSERT!");
  //       event.stopImmediatePropagation();
  //       event.preventDefault();

  //       // Dù là Iframe hay Top Window, bắn thẳng thông báo lên Tổng Hành Dinh
  //       sessionIdReady.then((sessionId) => {
  //         if (window.top) {
  //           // prettier-ignore
  //           window.top.postMessage( // nosonar
  //             { action: "TOGGLE_CHEAT_MENU", token: sessionId },
  //             "*",
  //           );
  //         }
  //       });
  //     }
  //   },
  //   { capture: true },
  // );

  // ==========================================
  // QUẢN LÝ VÒNG ĐỜI ENGINE
  // ==========================================
  chrome.storage.local.get(["isEngineEnabled"], async (result) => {
    if (result.isEngineEnabled) {
      console.log(
        `🧰 WASM Hacker [ON]: Đang bẫy RAM tại -> ${
          globalThis.location.hostname
        }`,
      );

      // const response = await chrome.runtime.sendMessage({
      //   action: "GET_SESSION_ID",
      // });
      // const secretSessionId = response.sessionId;
      // resolveSessionId(secretSessionId);

      const sessionId = await sessionIdReady;
      bootCheatEngine(sessionId);

      // const channel = new MessageChannel();
      // channel.port1.onmessage = async (event: MessageEvent<CropRequest>) => {
      //   const { action, reqId } = event.data;

      //   if (action === "get_dict") {
      //     const result = await chrome.storage.local.get("ocr_dict");
      //     channel.port1.postMessage({
      //       reqId,
      //       data: result.ocr_dict || {},
      //     });
      //     return;
      //   }

      //   if (action === "set_dict") {
      //     const { dictData } = event.data;
      //     await chrome.storage.local.set({ ocr_dict: dictData });
      //     channel.port1.postMessage({ reqId, success: true });
      //     return;
      //   }

      //   if (action === "crop" || !action) {
      //     const { x, y, w, h } = event.data;

      //     try {
      //       // 1. Chụp ảnh (code sẽ tự đợi ở đây mà không cần lồng callback)
      //       const dataUrl = await captureTabAsync();

      //       // 2. Load ảnh vào đối tượng Image
      //       const img = await loadImageAsync(dataUrl);

      //       const dpr = window.devicePixelRatio || 1;
      //       const canvas = document.createElement("canvas");
      //       canvas.width = w ?? 0;
      //       canvas.height = h ?? 0;
      //       const ctx = canvas.getContext("2d");
      //       if (!ctx) throw new Error("Trình duyệt không hỗ trợ Canvas 2D");

      //       ctx.drawImage(
      //         img,
      //         (x ?? 0) * dpr,
      //         (y ?? 0) * dpr,
      //         (w ?? 0) * dpr,
      //         (h ?? 0) * dpr,
      //         0,
      //         0,
      //         w ?? 0,
      //         h ?? 0,
      //       );

      //       const imageData = ctx.getImageData(0, 0, w ?? 0, h ?? 0);
      //       const uint8Array = new Uint8Array(imageData.data.buffer);

      //       console.group("🔍 DEBUG CROP");
      //       console.log("Canvas Size:", imageData.width, "x", imageData.height);
      //       console.log("Byte Array Length:", uint8Array.length);
      //       console.log("Preview Link:", canvas.toDataURL());
      //       console.groupEnd();

      //       // Trả hàng qua đường ống
      //       const successPayload: CropResponse = {
      //         reqId,
      //         data: uint8Array,
      //         width: imageData.width,
      //         height: imageData.height,
      //       };
      //       channel.port1.postMessage(successPayload);
      //     } catch (error) {
      //       // Tóm gọn MỌI THỂ LOẠI LỖI (chụp ảnh xịt, load ảnh xịt, cắt ảnh xịt) về một mối
      //       const message =
      //         error instanceof Error ? error.message : "Lỗi không xác định";
      //       console.error("🚨 [Crop Flow Error]:", message);
      //       channel.port1.postMessage({ reqId, error: message });
      //     }
      //   }
      // };

      // // 4. Mật mã bàn giao đường ống: Chỉ nghe đúng ám hiệu UUID
      // const handshakeListener = (e: MessageEvent<string>) => {
      //   if (e.source !== (globalThis as unknown as Window)) return;

      //   if (e.data === secretSessionId) {
      //     globalThis.removeEventListener("message", handshakeListener);

      //     // Ném đầu ống (port2) sang cho Main World
      //     const targetOrigin =
      //       globalThis.location.origin === "null"
      //         ? "*"
      //         : globalThis.location.origin;
      //     globalThis.postMessage(secretSessionId, targetOrigin, [
      //       channel.port2,
      //     ]);
      //   }
      // };
      // globalThis.addEventListener("message", handshakeListener);
    } else {
      console.log(
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

        console.log(
          `🧰 WASM Hacker [ACTION]: Đang tải lại trang -> ${
            globalThis.location.hostname
          }`,
        );
        // globalThis.location.reload();
      } else {
        // // ĐANG ON -> TẮT ĐI: Tự tay xóa UI và bắn tín hiệu ngầm

        // // 2. Bắn một Event xuyên qua rào cản thế giới để báo cho file Core
        // document.dispatchEvent(new CustomEvent("WASM_HACKER_SHUTDOWN"));

        // console.log(
        //   `🧰 WASM Hacker [OFF]: Đã gỡ UI và ngắt bẫy tại -> ${
        //     globalThis.location.hostname
        //   }`,
        // );

        console.log("🛑 Đã tắt Engine.");
      }
    }
  });

  // // prettier-ignore
  // globalThis.addEventListener("message", async (event) => { // nosonar
  //   // 1. Phải đến từ chính cửa sổ/iframe hiện tại
  //   if (event.source !== (globalThis as unknown as Window)) return;

  //   // 2. Origin phải khớp (chấp nhận cả trường hợp origin là "null")
  //   const currentOrigin = globalThis.location.origin;
  //   const isValidOrigin =
  //     event.origin === currentOrigin ||
  //     (currentOrigin === "null" && event.origin === "null");
  //   if (!isValidOrigin) return;

  //   const data = event.data;
  //   if (!data) return;

  //   const targetOrigin =
  //     globalThis.location.origin === "null" ? "*" : globalThis.location.origin;

  //   // 2. Nhận yêu cầu chụp ảnh từ Mắt Thần (Main World)
  //   if (data.action === "REQUEST_SCREENSHOT") {
  //     const messageId = data.messageId; // Nhớ ID để trả đúng người

  //     // 3. Gọi Background (Vì Content Script có quyền dùng chrome.runtime)
  //     chrome.runtime.sendMessage({ action: "captureTab" }, (response) => {
  //       // 4. Quăng bức ảnh ngược trở lại Game

  //       globalThis.postMessage(
  //         {
  //           action: "RESPONSE_SCREENSHOT",
  //           messageId: messageId,
  //           dataUrl: response.imgDataUrl,
  //           error: response?.error,
  //         },
  //         targetOrigin,
  //       );
  //     });
  //     return;
  //   }

  //   if (data.source === "CHEAT_ENGINE_UI") {
  //     // 1. Nhận yêu cầu LẤY từ điển
  //     if (data.action === "GET_DICT") {
  //       const data = await chrome.storage.local.get("ocr_dict");
  //       globalThis.postMessage(
  //         {
  //           source: "CHEAT_ENGINE_CONTENT",
  //           action: "GET_DICT_RESULT",
  //           dict: data.ocr_dict || {},
  //         },
  //         targetOrigin,
  //       );
  //     }

  //     // 2. Nhận yêu cầu LƯU từ điển
  //     if (data.action === "SET_DICT") {
  //       await chrome.storage.local.set({ ocr_dict: data.dict });
  //       globalThis.postMessage(
  //         {
  //           source: "CHEAT_ENGINE_CONTENT",
  //           action: "SET_DICT_RESULT",
  //           status: "success",
  //         },
  //         targetOrigin,
  //       );
  //     }
  //   }
  // });

  // ==========================================
  // LẮNG NGHE LỆNH TỪ RUST .EXE TRUYỀN LÊN
  // ==========================================
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Ví dụ: Rust yêu cầu Content Script cắt ảnh màn hình ở tọa độ (x, y, w, h)
    if (request.action === "REQUEST_CROP") {
      (async () => {
        try {
          const dataUrl = await captureTabAsync();
          const img = await loadImageAsync(dataUrl);

          // Logic tạo canvas và cắt ảnh (crop) giữ nguyên như cũ của bạn
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = request.w;
          canvas.height = request.h;
          ctx?.drawImage(
            img,
            request.x,
            request.y,
            request.w,
            request.h,
            0,
            0,
            request.w,
            request.h,
          );

          const imageData = ctx?.getImageData(0, 0, request.w, request.h);
          // Gửi data pixel ngược lại cho Rust
          sendResponse({
            success: true,
            pixels: Array.from(imageData?.data || []),
          });
        } catch (err) {
          sendResponse({ success: false, error: String(err) });
        }
      })();
      return true; // Giữ cổng cho async
    }
  });

  // async function bootCheatEngine(sessionId: string) {
  //   const wasmUrl = chrome.runtime.getURL("dist/core_engine_bg.wasm");

  //   // Đánh thức core_init đang ngủ ở Main World
  //   const targetOrigin =
  //     globalThis.location.origin === "null" ? "*" : globalThis.location.origin;
  //   window.postMessage(
  //     {
  //       action: "WAKE_UP_NEO",
  //       wasmUrl: wasmUrl,
  //       sessionId: sessionId,
  //     },
  //     targetOrigin,
  //   );
  // }

  async function bootCheatEngine(sessionId: string) {
    console.log(`🚀 System Hacker Mode ON. Session ID: ${sessionId}`);
    // Khởi tạo các module cào dữ liệu, DOM observer, v.v. tại đây
  }
}
