// Import hàm khởi tạo mặc định và hàm init_cheat_engine từ thư mục wasm do wasm-pack sinh ra
import init, {
  init_cheat_engine,
  setup_vision_bridge,
  learn_hash,
} from "./wasm_core/core_engine.js";

import { startScreenSelection, renderPersistentBox } from "./screen_selector";

type BridgeAction = "crop" | "get_dict" | "set_dict";

interface BridgePayload {
  action: BridgeAction;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  dictData?: Record<string, string>;
}

// Cấu trúc gói hàng nhận về
interface BridgeResponse {
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

let bridge: BridgeFn | null = null;

// 1. Khi Extension load, nạp từ điển cũ từ bộ nhớ Chrome vào Rust
async function loadDictionary() {
  if (!bridge) {
    console.error("❌ [Core]: Bridge chưa sẵn sàng, không thể nạp từ điển!");
    return;
  }

  try {
    // Gọi qua cầu để nhờ Content Script lấy hộ
    const response = await bridge({ action: "get_dict" });
    const dict = response.data as Record<string, string>;

    for (const [hashStr, char] of Object.entries(dict)) {
      learn_hash(BigInt(hashStr), char.charAt(0));
    }
    console.log("✅ [Core]: Đã nạp từ điển hoàn tất.");
  } catch (err) {
    console.error("❌ [Core]: Lỗi nạp từ điển:", err);
  }
}

function setupHotkey() {
  let isMenuVisible = true;

  globalThis.addEventListener("keydown", (event) => {
    // Sử dụng phím Insert (hoặc đổi thành 'Backquote' cho phím ~)
    if (event.code === "Insert") {
      const canvas = document.getElementById("wasm-stealth-canvas");
      if (!canvas) return;

      isMenuVisible = !isMenuVisible;

      if (isMenuVisible) {
        // Hiện Menu: Nhìn thấy được và chặn click chuột để thao tác UI
        canvas.style.visibility = "visible";
        canvas.style.pointerEvents = "auto";
      } else {
        // Ẩn Menu: Tàng hình và cho phép click chuột XUYÊN QUA để chơi game
        canvas.style.visibility = "hidden";
        canvas.style.pointerEvents = "none";
      }
    }
  });

  console.log("⌨️ [Hotkey]: Đã kích hoạt. Bấm phím [Insert] để Ẩn/Hiện Menu.");
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

async function bootstrapWasm() {
  try {
    const urlParams = new URL(import.meta.url).searchParams;
    const wasmUrl = urlParams.get("w");
    const sessionId = urlParams.get("s");

    if (!wasmUrl || !sessionId) throw new Error("Missing parameters");

    // Nạp thẳng module WASM vào bộ nhớ của Game
    await init({ module_or_path: wasmUrl });

    const launchEngine = async () => {
      // Chỉ chạy khi có ĐỦ 2 thứ: Body và Bridge
      if (!document.body || !bridge) return;

      console.log("🚀 [Core Init]: Đánh thức Rust Core...");
      init_cheat_engine();

      // Nạp từ điển ngay sau khi Engine thức dậy
      await loadDictionary();

      setupHotkey();
    };

    const onHandshake = async (e: MessageEvent) => {
      if (e.data !== sessionId || e.ports.length === 0) return;
      window.removeEventListener("message", onHandshake);

      bridge = createCropFn(e.ports[0]);

      setup_vision_bridge(
        async (x: number, y: number, w: number, h: number) => {
          if (!bridge) {
            throw new Error("⚠️ Bridge chưa sẵn sàng để thực hiện lệnh crop!");
          }

          return await bridge({ action: "crop", x, y, w, h });
        },
      );

      launchEngine();
    };

    window.addEventListener("message", onHandshake);
    window.postMessage(sessionId, globalThis.location.origin);

    const checkBody = () => {
      if (document.body) {
        launchEngine();
      } else {
        setTimeout(checkBody, 50);
      }
    };

    checkBody();
  } catch (error) {
    console.error("❌ [Core Init]: Mở cổng WASM thất bại. Lỗi:", error);
  }
}

// Kích nổ
bootstrapWasm();

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

// 2. Hàm xử lý khi phát hiện Hash lạ
globalThis.wasmPromptUnknownHash = async function (hashStr: string) {
  const hash = BigInt(hashStr);

  const char = prompt(
    `🤖 Rust phát hiện mã lạ: [ ${hashStr} ]\nĐại ca hãy cho biết hình này là số mấy? (0-9)`,
  );

  if (char?.length === 1) {
    // 1. Dạy ngay cho Rust
    learn_hash(hash, char);

    // 2. Lưu vĩnh viễn vào Chrome Storage
    const data = await chrome.storage.local.get("ocr_dict");
    const dict = (data.ocr_dict || {}) as Record<string, string>;
    dict[hash.toString()] = char;
    await chrome.storage.local.set({ ocr_dict: dict });

    console.log(`✅ Đã lưu mã [ ${hashStr} ] = ${char}`);
    return char; // Trả về cho Rust biết
  }

  return null; // Đại ca bấm Cancel
};

globalThis.wasmShowTrainingUI = async function (
  jsonStr: string,
): Promise<boolean> {
  const digits: UnknownDigit[] = JSON.parse(jsonStr);
  if (digits.length === 0) return true;

  return new Promise((resolve) => {
    let modal = document.getElementById(
      "ce-train-modal",
    ) as HTMLDivElement | null;
    if (!modal) {
      // (Giữ nguyên đoạn HTML Modal siêu xịn của bạn ở đây)
      const trainingModalHTML = `
        <div id="ce-train-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); z-index: 9999999; justify-content: center; align-items: center; font-family: monospace;">
          <div style="background: #222; border: 2px solid #00ff88; border-radius: 8px; padding: 20px; width: 80%; max-width: 600px; box-shadow: 0 0 20px rgba(0, 255, 136, 0.3);">
            <h3 style="color: #00ff88; margin-top: 0; text-align: center;">HUẤN LUYỆN FONT CHỮ LẠ</h3>
            <p style="color: #ccc; font-size: 13px; text-align: center;">Vui lòng nhập số tương ứng cho từng hình. Nhập chữ <b>x</b> để bỏ qua.</p>
            <div id="ce-train-container" style="display: flex; gap: 15px; flex-wrap: wrap; justify-content: center; margin: 20px 0; max-height: 50vh; overflow-y: auto; padding: 10px;"></div>
            <div style="display: flex; gap: 10px; justify-content: center;">
              <button id="ce-btn-train-save" style="background: #007acc; color: white; border: none; padding: 10px 20px; cursor: pointer; border-radius: 4px; font-weight: bold;">💾 LƯU & TIẾP TỤC QUÉT</button>
              <button id="ce-btn-train-cancel" style="background: #444; color: white; border: none; padding: 10px 20px; cursor: pointer; border-radius: 4px;">❌ HỦY LỆNH</button>
            </div>
          </div>
        </div>
      `;
      const modalWrapper = document.createElement("div");
      modalWrapper.innerHTML = trainingModalHTML;
      document.body.appendChild(modalWrapper);
      modal = document.getElementById("ce-train-modal") as HTMLDivElement;
    }

    const container = document.getElementById(
      "ce-train-container",
    ) as HTMLDivElement;
    const btnSave = document.getElementById(
      "ce-btn-train-save",
    ) as HTMLButtonElement;
    const btnCancel = document.getElementById(
      "ce-btn-train-cancel",
    ) as HTMLButtonElement;

    container.innerHTML = "";

    // Render từng mảnh cắt thành Flashcard
    digits.forEach((digit) => {
      const card = document.createElement("div");
      card.style.cssText =
        "background: #111; padding: 10px; border: 1px solid #444; border-radius: 6px; display: flex; flex-direction: column; align-items: center; gap: 10px;";

      const canvas = document.createElement("canvas");
      canvas.width = digit.width;
      canvas.height = digit.height;
      canvas.style.cssText = `width: ${digit.width * 3}px; height: ${digit.height * 3}px; image-rendering: pixelated; border: 1px dashed #666;`;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        const imgData = ctx.createImageData(digit.width, digit.height);
        for (let i = 0; i < digit.pixels.length; i++) {
          const val = digit.pixels[i] === 1 ? 255 : 0;
          const px = i * 4;
          imgData.data[px] = val; // R (Vàng)
          imgData.data[px + 1] = val; // G (Vàng)
          imgData.data[px + 2] = 0; // B
          imgData.data[px + 3] = val === 255 ? 255 : 0; // Alpha
        }
        ctx.putImageData(imgData, 0, 0);
      }

      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 1;
      input.dataset.hash = digit.hash; // Lưu Hash vào dataset để lát lấy ra
      input.style.cssText =
        "width: 30px; text-align: center; font-size: 18px; font-weight: bold; background: #333; color: white; border: 1px solid #007acc; border-radius: 4px; padding: 4px;";

      card.appendChild(canvas);
      card.appendChild(input);
      container.appendChild(card);
    });

    modal.style.display = "flex";

    const cleanup = () => {
      if (modal) modal.style.display = "none";
      btnSave.onclick = null;
      btnCancel.onclick = null;
    };

    btnCancel.onclick = () => {
      cleanup();
      resolve(false);
    };

    btnSave.onclick = async () => {
      const inputs = container.querySelectorAll("input");

      // Lấy từ điển cũ từ Storage
      const data = await chrome.storage.local.get("ocr_dict");
      const dict = (data.ocr_dict || {}) as Record<string, string>;

      inputs.forEach((input) => {
        const char = input.value.trim();
        const hashStr = input.dataset.hash;

        if (char && char !== "x" && hashStr) {
          // 1. Dạy cho Não Rust
          learn_hash(BigInt(hashStr), char.charAt(0));
          // 2. Cập nhật vào từ điển Storage
          dict[hashStr] = char;
        }
      });

      // Lưu lại vĩnh viễn
      await chrome.storage.local.set({ ocr_dict: dict });

      cleanup();
      resolve(true);
    };
  });
};
