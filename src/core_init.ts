// Import hàm khởi tạo mặc định và hàm init_cheat_engine từ thư mục wasm do wasm-pack sinh ra
import init, {
  init_cheat_engine,
  setup_vision_bridge,
  learn_hash,
} from "./wasm_core/core_engine.js";

import { startScreenSelection, renderPersistentBox } from "./screen_selector";

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

// Định nghĩa kiểu cho hàm Bridge
type BridgeFn = (payload: BridgePayload) => Promise<BridgeResponse>;

interface UnknownDigit {
  hash: string;
  width: number;
  height: number;
  pixels: number[];
}

export const bridge = (payload: BridgePayload): Promise<BridgeResponse> => {
  return new Promise((resolve, reject) => {
    // Tạo ID cho mỗi request để tránh nhầm lẫn các lệnh gọi bất đồng bộ
    const reqId = crypto.randomUUID(); 
    const payloadWithId = { ...payload, reqId };

    chrome.runtime.sendMessage(payloadWithId, (response: BridgeResponse) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError.message);
      }
      if (response && response.success === false) {
        return reject(response.error);
      }
      resolve(response);
    });
  });
};

// // 1. Khi Extension load, nạp từ điển cũ từ bộ nhớ Chrome vào Rust
// async function loadDictionary() {
//   if (!bridge) {
//     console.error("❌ [Core]: Bridge chưa sẵn sàng, không thể nạp từ điển!");
//     return;
//   }

//   try {
//     // Gọi qua cầu để nhờ Content Script lấy hộ
//     const response = await bridge({ action: "get_dict" });
//     const dict = response.data as Record<string, string>;

//     for (const [hashStr, char] of Object.entries(dict)) {
//       learn_hash(hashStr, char.charAt(0));
//     }
//     console.log("✅ [Core]: Đã nạp từ điển hoàn tất.");
//   } catch (err) {
//     console.error("❌ [Core]: Lỗi nạp từ điển:", err);
//   }
// }

function setupMainWindowHotkey(sessionId: string) {
  let isMenuVisible = true;

  const toggleMenu = () => {
    const canvas = document.getElementById("wasm-stealth-canvas");
    if (!canvas) {
      console.error("🏢 [Tổng Hành Dinh]: Không tìm thấy thẻ canvas!");
      return;
    }

    isMenuVisible = !isMenuVisible;
    console.log(
      `🏢 [Tổng Hành Dinh]: ⚙️ Menu đang -> ${isMenuVisible ? "HIỆN 🟢" : "ẨN 🔴"}`,
    );

    if (isMenuVisible) {
      canvas.style.setProperty("display", "block", "important");
      canvas.style.setProperty("pointer-events", "auto", "important");
    } else {
      canvas.style.setProperty("display", "none", "important");
      canvas.style.setProperty("pointer-events", "none", "important");

      // Focus ngược lại vào iframe game nếu có
      const gameCanvas = (
        globalThis as unknown as Window
      ).document.querySelector(
        "canvas:not(#wasm-stealth-canvas)",
      ) as HTMLElement;
      if (gameCanvas) gameCanvas.focus();
    }
  };

  // prettier-ignore
  (globalThis as unknown as Window).addEventListener( // nosonar
    "message",
    (event: MessageEvent) => { 
      const currentOrigin = globalThis.location.origin;
      const isValidOrigin = event.origin === currentOrigin || event.origin === "null";
      if (!isValidOrigin) return;

      if (
        event.data?.action === "TOGGLE_CHEAT_MENU" &&
        event.data.token === sessionId
      ) {
        console.log("🏢 [Tổng Hành Dinh]: 📩 Đã nhận lệnh mở/tắt Menu!");
        toggleMenu();
      }
    },
  );
}

function createCropFn(port: MessagePort) {
  return (payload: BridgePayload): Promise<BridgeResponse> => {
    return new Promise((resolve, reject) => {
      const reqId = Math.random().toString(36).substring(7);

      const onResponse = (msg: MessageEvent<BridgeResponse>) => {
        if (msg.data.reqId !== reqId) return;
        port.removeEventListener("message", onResponse);

        if (msg.data.error) {
          reject(new Error(msg.data.error));
        } else {
          resolve(msg.data);
        }
      };

      port.addEventListener("message", onResponse);
      port.start();
      port.postMessage({ ...payload, reqId });
    });
  };
}

// async function bootstrapWasm(wasmUrl: string, sessionId: string) {
//   const isTopWindow = (globalThis as unknown as Window) === window.top;

//   try {
//     // Nạp thẳng module WASM vào bộ nhớ của Game
//     await init({ module_or_path: wasmUrl });

//     const launchEngine = async () => {
//       // Chỉ chạy khi có ĐỦ 2 thứ: Body và Bridge
//       if (!document.body || !bridge) return;

//       if (isTopWindow) {
//         console.log("🏰 [Tổng Hành Dinh]: Đánh thức Rust Core (UI)...");
//         init_cheat_engine();
//         await loadDictionary();
//         setupMainWindowHotkey(sessionId);
//       }
//     };

//     const onHandshake = async (event: MessageEvent) => {
//       if (event.source !== (globalThis as unknown as Window)) return;

//       const currentOrigin = globalThis.location.origin;
//       const isValidOrigin =
//         event.origin === currentOrigin || event.origin === "null";
//       if (!isValidOrigin) return;

//       if (event.data !== sessionId || event.ports.length === 0) return;
//       globalThis.removeEventListener("message", onHandshake);

//       bridge = createCropFn(event.ports[0]);

//       setup_vision_bridge(
//         async (x: number, y: number, w: number, h: number) => {
//           if (!bridge) {
//             throw new Error("⚠️ Bridge chưa sẵn sàng để thực hiện lệnh crop!");
//           }

//           return await bridge({ action: "crop", x, y, w, h });
//         },
//       );

//       launchEngine();
//     };

//     globalThis.addEventListener("message", onHandshake);

//     const targetOrigin =
//       globalThis.location.origin === "null" ? "*" : globalThis.location.origin;
//     globalThis.postMessage(sessionId, targetOrigin);

//     const checkBody = () => {
//       if (document.body) {
//         launchEngine();
//       } else {
//         setTimeout(checkBody, 50);
//       }
//     };

//     checkBody();
//   } catch (error) {
//     console.error("❌ [Core Init]: Mở cổng WASM thất bại. Lỗi:", error);
//   }
// }

globalThis.wasmSelectArea = async function () {
  // Tìm cái "màn hình" của Hacker Menu
  const canvas = document.getElementById("wasm-stealth-canvas");

  try {
    // 1. Tắt khả năng bắt chuột của Menu (Chuột sẽ xuyên qua Menu để tác động vào Game)
    if (canvas) {
      canvas.style.pointerEvents = "none";
      // Có thể thêm hiệu ứng mờ Menu để biết đang trong mode chọn vùng
      canvas.style.opacity = "0.5";
    }

    console.log("🔍 [JS Bridge]: Gọi hàm khoanh vùng...");
    const box = await startScreenSelection();

    if (!box) {
      console.warn("🔍 [JS Bridge]: Người dùng đã hủy hoặc lỗi khoanh vùng.");
      return null;
    }
    renderPersistentBox(box);

    return new Float64Array([box.x, box.y, box.width, box.height]);
  } catch (err) {
    console.error("🔍 [JS Bridge]: Lỗi nghiêm trọng:", err);
    return null;
  } finally {
    // 2. PHẢI BẬT LẠI để sau khi khoanh xong bạn còn bấm được nút trên Menu
    if (canvas) {
      canvas.style.pointerEvents = "auto";
      canvas.style.opacity = "1";
    }
  }
};

// // 2. Hàm xử lý khi phát hiện Hash lạ
// globalThis.wasmPromptUnknownHash = async function (hashStr: string) {
//   const char = prompt(
//     `🤖 Rust phát hiện mã lạ: [ ${hashStr} ]\nĐại ca hãy cho biết hình này là số mấy? (0-9)`,
//   );

//   if (char?.length === 1) {
//     // 1. Dạy ngay cho Rust
//     learn_hash(hashStr, char);

//     // 2. Lưu vĩnh viễn vào Chrome Storage
//     const data = await chrome.storage.local.get("ocr_dict");
//     const dict = (data.ocr_dict || {}) as Record<string, string>;
//     dict[hashStr] = char;
//     await chrome.storage.local.set({ ocr_dict: dict });

//     console.log(`✅ Đã lưu mã [ ${hashStr} ] = ${char}`);
//     return char; // Trả về cho Rust biết
//   }

//   return null; // Đại ca bấm Cancel
// };

// function storageGetDict(): Promise<Record<string, string>> {
//   return new Promise((resolve) => {
//     const targetOrigin =
//       globalThis.location.origin === "null" ? "*" : globalThis.location.origin;

//     // 1. Tạo tai nghe
//     const handler = (event: MessageEvent) => {
//       if (event.source !== (globalThis as unknown as Window)) return;

//       const currentOrigin = globalThis.location.origin;
//       const isValidOrigin =
//         event.origin === currentOrigin || event.origin === "null";
//       if (!isValidOrigin) return;

//       if (
//         event.data?.source === "CHEAT_ENGINE_CONTENT" &&
//         event.data?.action === "GET_DICT_RESULT"
//       ) {
//         window.removeEventListener("message", handler); // Nghe xong thì tháo tai nghe ra
//         resolve(event.data.dict);
//       }
//     };
//     window.addEventListener("message", handler);

//     // 2. Hét lên yêu cầu
//     window.postMessage(
//       { source: "CHEAT_ENGINE_UI", action: "GET_DICT" },
//       targetOrigin, // Bắn xuyên thủng lồng Sandbox
//     );
//   });
// }

// function storageSetDict(dict: Record<string, string>): Promise<void> {
//   const targetOrigin =
//     globalThis.location.origin === "null" ? "*" : globalThis.location.origin;

//   return new Promise((resolve) => {
//     const handler = (event: MessageEvent) => {
//       if (event.source !== (globalThis as unknown as Window)) return;

//       const currentOrigin = globalThis.location.origin;
//       const isValidOrigin =
//         event.origin === currentOrigin || event.origin === "null";
//       if (!isValidOrigin) return;

//       if (
//         event.data?.source === "CHEAT_ENGINE_CONTENT" &&
//         event.data?.action === "SET_DICT_RESULT"
//       ) {
//         window.removeEventListener("message", handler);
//         resolve();
//       }
//     };
//     window.addEventListener("message", handler);
//     window.postMessage(
//       { source: "CHEAT_ENGINE_UI", action: "SET_DICT", dict: dict },
//       targetOrigin,
//     );
//   });
// }

function downloadAsPNG(label: string, digitData: UnknownDigit) {
  // 1. Tạo một tờ giấy vẽ (canvas) vô hình
  const canvas = document.createElement("canvas");
  canvas.width = digitData.width;
  canvas.height = digitData.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // 2. Chế tạo cọ vẽ pixel
  const imgData = ctx.createImageData(digitData.width, digitData.height);

  for (let i = 0; i < digitData.pixels.length; i++) {
    // 1 là chữ (Trắng - 255), 0 là nền (Đen - 0)
    const color = digitData.pixels[i] === 1 ? 255 : 0;

    const idx = i * 4;
    imgData.data[idx] = color; // R
    imgData.data[idx + 1] = color; // G
    imgData.data[idx + 2] = color; // B
    imgData.data[idx + 3] = 255; // Alpha (Độ đục = 100%)
  }

  // 3. In pixel lên canvas
  ctx.putImageData(imgData, 0, 0);

  // 4. Ép trình duyệt tải về file PNG
  const link = document.createElement("a");
  // Đặt tên file cực thông minh: "5_ab12c.png" (Nhìn phát biết ngay ảnh số 5)
  link.download = `${label}_${digitData.hash.substring(0, 8)}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

async function processAndSaveData(
  inputs: NodeListOf<Element>,
  digits: UnknownDigit[],
): Promise<number> {
  const dict = await storageGetDict();
  let labeledCount = 0;

  // TUYỆT CHIÊU 1: Dùng for...of thay vì forEach để diệt 1 lớp Function
  for (const el of Array.from(inputs)) {
    const input = el as HTMLInputElement;
    const char = input.value.trim();
    const hashStr = input.dataset.hash;

    if (char && char !== "x" && hashStr) {
      // Dạy cho Não Rust
      learn_hash(hashStr, char.charAt(0));
      dict[hashStr] = char;

      // Tìm ảnh gốc để tải về (Bây giờ thằng này mới là Lớp 2, dư sức qua ải Sonar)
      const digitData = digits.find((d) => d.hash === hashStr);
      if (digitData) {
        downloadAsPNG(char.charAt(0), digitData);
        labeledCount++;
      }
    }
  }

  await storageSetDict(dict);
  return labeledCount;
}

// globalThis.wasmShowTrainingUI = async function (
//   jsonStr: string,
// ): Promise<boolean> {
//   const digits: UnknownDigit[] = JSON.parse(jsonStr);
//   if (digits.length === 0) return true;

//   return new Promise((resolve) => {
//     let modal = document.getElementById(
//       "ce-train-modal",
//     ) as HTMLDivElement | null;
//     if (!modal) {
//       // (Giữ nguyên đoạn HTML Modal siêu xịn của bạn ở đây)
//       const trainingModalHTML = `
//         <div id="ce-train-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); z-index: 9999999; justify-content: center; align-items: center; font-family: monospace;">
//           <div style="background: #222; border: 2px solid #00ff88; border-radius: 8px; padding: 20px; width: 80%; max-width: 600px; box-shadow: 0 0 20px rgba(0, 255, 136, 0.3);">
//             <h3 style="color: #00ff88; margin-top: 0; text-align: center;">HUẤN LUYỆN FONT CHỮ LẠ</h3>
//             <p style="color: #ccc; font-size: 13px; text-align: center;">Vui lòng nhập số tương ứng cho từng hình. Nhập chữ <b>x</b> để bỏ qua.</p>
//             <div id="ce-train-container" style="display: flex; gap: 15px; flex-wrap: wrap; justify-content: center; margin: 20px 0; max-height: 50vh; overflow-y: auto; padding: 10px;"></div>
//             <div style="display: flex; gap: 10px; justify-content: center;">
//               <button id="ce-btn-train-save" style="background: #007acc; color: white; border: none; padding: 10px 20px; cursor: pointer; border-radius: 4px; font-weight: bold;">💾 LƯU & TIẾP TỤC QUÉT</button>
//               <button id="ce-btn-train-cancel" style="background: #444; color: white; border: none; padding: 10px 20px; cursor: pointer; border-radius: 4px;">❌ HỦY LỆNH</button>
//             </div>
//           </div>
//         </div>
//       `;
//       const modalWrapper = document.createElement("div");
//       modalWrapper.innerHTML = trainingModalHTML;
//       document.body.appendChild(modalWrapper);
//       modal = document.getElementById("ce-train-modal") as HTMLDivElement;
//     }

//     const container = document.getElementById(
//       "ce-train-container",
//     ) as HTMLDivElement;
//     const btnSave = document.getElementById(
//       "ce-btn-train-save",
//     ) as HTMLButtonElement;
//     const btnCancel = document.getElementById(
//       "ce-btn-train-cancel",
//     ) as HTMLButtonElement;

//     container.innerHTML = "";

//     // Render từng mảnh cắt thành Flashcard
//     digits.forEach((digit) => {
//       const card = document.createElement("div");
//       card.style.cssText =
//         "background: #111; padding: 10px; border: 1px solid #444; border-radius: 6px; display: flex; flex-direction: column; align-items: center; gap: 10px;";

//       const canvas = document.createElement("canvas");
//       canvas.width = digit.width;
//       canvas.height = digit.height;
//       canvas.style.cssText = `width: ${digit.width * 3}px; height: ${digit.height * 3}px; image-rendering: pixelated; border: 1px dashed #666;`;

//       const ctx = canvas.getContext("2d");
//       if (ctx) {
//         const imgData = ctx.createImageData(digit.width, digit.height);
//         for (let i = 0; i < digit.pixels.length; i++) {
//           const val = digit.pixels[i] === 1 ? 255 : 0;
//           const px = i * 4;
//           imgData.data[px] = val; // R (Vàng)
//           imgData.data[px + 1] = val; // G (Vàng)
//           imgData.data[px + 2] = 0; // B
//           imgData.data[px + 3] = val === 255 ? 255 : 0; // Alpha
//         }
//         ctx.putImageData(imgData, 0, 0);
//       }

//       const input = document.createElement("input");
//       input.type = "text";
//       input.maxLength = 1;
//       input.dataset.hash = digit.hash; // Lưu Hash vào dataset để lát lấy ra
//       input.style.cssText =
//         "width: 30px; text-align: center; font-size: 18px; font-weight: bold; background: #333; color: white; border: 1px solid #007acc; border-radius: 4px; padding: 4px;";

//       card.appendChild(canvas);
//       card.appendChild(input);
//       container.appendChild(card);
//     });

//     modal.style.display = "flex";

//     const cleanup = () => {
//       if (modal) modal.style.display = "none";
//       btnSave.onclick = null;
//       btnCancel.onclick = null;
//     };

//     btnCancel.onclick = () => {
//       cleanup();
//       resolve(false);
//     };

//     btnSave.onclick = async () => {
//       try {
//         const inputs = container.querySelectorAll("input");

//         const labeledCount = await processAndSaveData(inputs, digits);

//         console.log(
//           `✅ [DEBUG] Đã thu thập và tải về ${labeledCount} ảnh data train!`,
//         );

//         cleanup();
//         resolve(true);
//       } catch (err) {
//         console.error("❌ [DEBUG] Lỗi cầu nối:", err);
//         resolve(false);
//       }
//     };
//   });
// };

// // prettier-ignore
// globalThis.addEventListener("message", function bootstrapListener(event) { // nosonar
//   // Chỉ nhận tin nhắn nội bộ từ Content Script (Isolated)
//   if (event.source !== (globalThis as unknown as Window)) return;

//   const data = event.data;
//   if (data?.action === "WAKE_UP_NEO") {
//     // Nghe xong mật lệnh thì hủy luôn tai nghe cho sạch
//     globalThis.removeEventListener("message", bootstrapListener);

//     const currentOrigin = globalThis.location.origin;
//     const isValidOrigin =
//       event.origin === currentOrigin || event.origin === "null";
//     if (!isValidOrigin) return;

//     const data = event.data;
//     if (data?.action === "WAKE_UP_NEO") {
//       // Nghe xong mật lệnh thì hủy luôn tai nghe cho sạch
//       globalThis.removeEventListener("message", bootstrapListener);

//       const wasmUrl = data.wasmUrl;
//       const sessionId = data.sessionId;

//       console.log("🚀 [Core]: Đã nhận lệnh khởi động từ bóng tối!");

//       // SỬA LỖI Ở ĐÂY: Truyền 2 biến vào hàm bootstrapWasm để Core thực sự chạy!
//       bootstrapWasm(wasmUrl, sessionId);
//     }
//   }
// });
