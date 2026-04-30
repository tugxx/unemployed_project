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

const url = globalThis.location.href;
const isTrashFrame =
  /googleads|googlesyndication|adtrafficquality|doubleclick|2mdn\.net|recaptcha|safeframe|xd_handler|pixel|analytics|about:blank|about:srcdoc/i.test(
    url,
  );

if (!isTrashFrame) {
  function injectScript(file: string): Promise<void> {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.type = "module";
      script.src = file;
      script.onload = () => {
        script.remove();
        resolve();
      };
      (document.head || document.documentElement).appendChild(script);
    });
  }

  chrome.storage.local.get(["isWasmEnabled"], async (result) => {
    if (result.isWasmEnabled === true) {
      console.log(
        `🧰 WASM Hacker [ON]: Đang bẫy RAM tại -> ${
          globalThis.location.hostname
        }`,
      );

      const wasmUrl = chrome.runtime.getURL("dist/core_engine_bg.wasm");
      const initUrl = chrome.runtime.getURL("dist/core_init.bundle.js");

      const secretSessionId = crypto.randomUUID();
      const Url = `${initUrl}?w=${encodeURIComponent(wasmUrl)}&s=${secretSessionId}`;

      await injectScript(Url);

      const channel = new MessageChannel();
      channel.port1.onmessage = async (event: MessageEvent<CropRequest>) => {
        const { action, reqId } = event.data;

        if (action === "get_dict") {
          const result = await chrome.storage.local.get("ocr_dict");
          channel.port1.postMessage({
            reqId,
            data: result.ocr_dict || {},
          });
          return;
        }

        if (action === "set_dict") {
          const { dictData } = event.data;
          await chrome.storage.local.set({ ocr_dict: dictData });
          channel.port1.postMessage({ reqId, success: true });
          return;
        }

        if (action === "crop" || !action) {
          const { x, y, w, h } = event.data;

          chrome.runtime.sendMessage(
            { action: "captureTab" },
            async (response) => {
              if (!response?.imgDataUrl) {
                channel.port1.postMessage({ reqId, error: "Lỗi chụp ảnh" });
                return;
              }

              try {
                const img = new Image();
                img.src = response.imgDataUrl;
                await new Promise((resolve) => {
                  img.onload = resolve;
                });

                const dpr = window.devicePixelRatio || 1;
                const canvas = document.createElement("canvas");
                canvas.width = w ?? 0;
                canvas.height = h ?? 0;
                const ctx = canvas.getContext("2d");

                ctx!.drawImage(
                  img,
                  (x ?? 0) * dpr,
                  (y ?? 0) * dpr,
                  (w ?? 0) * dpr,
                  (h ?? 0) * dpr,
                  0,
                  0,
                  w ?? 0,
                  h ?? 0,
                );

                const imageData = ctx!.getImageData(0, 0, w ?? 0, h ?? 0);
                const uint8Array = new Uint8Array(imageData.data.buffer);

                console.group("🔍 DEBUG CROP");
                console.log(
                  "Canvas Size:",
                  imageData.width,
                  "x",
                  imageData.height,
                );
                console.log("Byte Array Length:", uint8Array.length);
                console.log("Preview Link:", canvas.toDataURL());
                console.groupEnd();

                // Trả hàng qua đường ống
                const successPayload: CropResponse = {
                  reqId,
                  data: uint8Array,
                  width: imageData.width,
                  height: imageData.height,
                };
                channel.port1.postMessage(successPayload);
              } catch (error) {
                const message =
                  error instanceof Error ? error.message : "Unknown error";
                channel.port1.postMessage({ reqId, error: message });
              }
            },
          );
        }
      };

      // 4. Mật mã bàn giao đường ống: Chỉ nghe đúng ám hiệu UUID
      const handshakeListener = (e: MessageEvent<string>) => {
        if (e.data === secretSessionId) {
          window.removeEventListener("message", handshakeListener);
          // Ném đầu ống (port2) sang cho Main World
          window.postMessage(secretSessionId, globalThis.location.origin, [
            channel.port2,
          ]);
        }
      };
      window.addEventListener("message", handshakeListener);
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
      if (changes.isWasmEnabled.newValue === true) {
        // ĐANG OFF -> BẬT LÊN: Reload lại trang
        if (
          (globalThis as unknown as Window) ===
          (globalThis as unknown as Window).top
        ) {
          console.log(
            `🧰 WASM Hacker [ACTION]: Đang tải lại trang -> ${
              globalThis.location.hostname
            }`,
          );
          globalThis.location.reload();
        }
      } else {
        // ĐANG ON -> TẮT ĐI: Tự tay xóa UI và bắn tín hiệu ngầm

        // 2. Bắn một Event xuyên qua rào cản thế giới để báo cho file Core
        document.dispatchEvent(new CustomEvent("WASM_HACKER_SHUTDOWN"));

        console.log(
          `🧰 WASM Hacker [OFF]: Đã gỡ UI và ngắt bẫy tại -> ${
            globalThis.location.hostname
          }`,
        );
      }
    }
  });
}

// Trong file Content Script (nơi chứa injectScript)
window.addEventListener("message", (event) => {
  // 1. Chỉ nhận tin nhắn từ chính trang web hiện tại
  if (
    event.origin !== globalThis.window.location.origin ||
    event.source !== globalThis.window
  ) {
    return;
  }

  // 2. Nhận yêu cầu chụp ảnh từ Mắt Thần (Main World)
  if (event.data?.action === "REQUEST_SCREENSHOT") {
    const messageId = event.data.messageId; // Nhớ ID để trả đúng người

    // 3. Gọi Background (Vì Content Script có quyền dùng chrome.runtime)
    chrome.runtime.sendMessage({ action: "captureTab" }, (response) => {
      // 4. Quăng bức ảnh ngược trở lại Game
      window.postMessage(
        {
          action: "RESPONSE_SCREENSHOT",
          messageId: messageId,
          dataUrl: response.imgDataUrl,
          error: response?.error,
        },
        globalThis.window.location.origin,
      );
    });
  }
});
