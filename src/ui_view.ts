import { BinaryTemplate } from "./global";

const getHeaderUI = () => `
  <div id="ce-header" style="background:#2d2d30; padding:10px; cursor:move; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #444; flex-shrink:0;">
      <b id="ce-title-text" style="color:#00ff88; font-size:14px; user-select:none;">🧰 <span id="ce-title-name">WASM Engine V5</span></b>
      <div style="display:flex; gap:6px;">
          <button id="ce-btn-min" style="width:24px; height:24px; background:#444; color:#fff; border:none; border-radius:3px; cursor:pointer; font-size:14px; font-weight:bold; padding:0; transition:0.2s;" title="Thu nhỏ / Phóng to">−</button>
          <button id="ce-btn-close" style="width:24px; height:24px; background:#cc3300; color:#fff; border:none; border-radius:3px; cursor:pointer; font-size:12px; font-weight:bold; padding:0; transition:0.2s;" title="Đóng">✖</button>
      </div>
  </div>
`;

const getScanSelectorsUI = () => `
  <div style="display:flex; gap:5px; margin-bottom:10px; flex-shrink:0;">
      <select id="ce-scan-mode" style="background:#333; color:#00ff88; border:1px solid #555; padding:6px; width:60%; outline:none; font-weight:bold;">
          <option value="exact">🎯 Quét Chính Xác</option>
          <option value="trend">📈 Quét Tăng/Giảm (Game Idle)</option>
          <option value="encrypted">👻 Quét Mã Hóa (Biến XOR)</option>
      </select>
      <select id="ce-data-type" style="background:#333; color:#fff; border:1px solid #555; padding:6px; width:40%; outline:none;">
          <option value="i32">Int32 (4B)</option>
          <option value="f64">Double (8B)</option>
          <option value="f32">Float (4B)</option>
      </select>
  </div>
`;

const getExactScanAreaUI = () => `
  <div id="area-exact" style="flex-shrink:0;">
      <button id="ce-btn-redraw" style="width: 100%; margin-bottom: 8px; background: #444; color: #fff; border: 1px solid #666; padding: 6px 10px; cursor: pointer; border-radius: 2px; transition: background 0.2s;">
          🔲 Chọn Lại Vùng
      </button>
      <div style="display:flex; gap:5px; margin-bottom:10px;">
          <button id="ce-btn-first" style="flex:1; background:#007acc; color:#fff; border:none; padding:8px; cursor:pointer; font-weight:bold; border-radius:2px;">First Scan</button>
          <button id="ce-btn-next" style="flex:1; background:#005999; color:#fff; border:none; padding:8px; cursor:pointer; font-weight:bold; border-radius:2px;">Next Scan</button>
      </div>
  </div>
`;

const getTrendScanAreaUI = () => `
  <div id="area-trend" style="display:none; flex-shrink:0;">
      <button id="ce-btn-snap-trend" style="width:100%; background:#d97706; color:#fff; border:none; padding:8px; margin-bottom:8px; cursor:pointer; font-weight:bold; border-radius:2px;">📸 1. Chụp Ảnh RAM (Bắt đầu)</button>
      <div style="display:flex; gap:5px; margin-bottom:10px;">
          <button id="ce-btn-increased" style="flex:1; background:#9333ea; color:#fff; border:none; padding:8px; cursor:pointer; font-weight:bold; border-radius:2px;">📈 Tăng Lên</button>
          <button id="ce-btn-decreased" style="flex:1; background:#be123c; color:#fff; border:none; padding:8px; cursor:pointer; font-weight:bold; border-radius:2px;">📉 Giảm Đi</button>
      </div>
  </div>
`;

const getEncryptedScanAreaUI = () => `
  <div id="area-encrypted" style="display:none; flex-shrink:0;">
      <button id="ce-btn-snap-enc" style="width:100%; background:#d97706; color:#fff; border:none; padding:8px; margin-bottom:8px; cursor:pointer; font-weight:bold; border-radius:2px;">📸 1. Chụp Ảnh RAM (Bắt đầu)</button>
      <div style="display:flex; gap:5px; margin-bottom:10px;">
          <button id="ce-btn-changed" style="flex:1; background:#059669; color:#fff; border:none; padding:8px; cursor:pointer; font-weight:bold; border-radius:2px;">≠ Đã Thay Đổi</button>
          <button id="ce-btn-unchanged" style="flex:1; background:#2563eb; color:#fff; border:none; padding:8px; cursor:pointer; font-weight:bold; border-radius:2px;">= Đứng Im</button>
      </div>
  </div>
`;

const getWriteAndFreezeUI = () => `
  <div style="border-top:1px dashed #555; padding-top:10px; margin-bottom:10px; flex-shrink:0;">
      <div id="ce-target-status" style="text-align:center; padding:5px; margin-bottom:8px; background:#331111; border:1px solid #cc3300; color:#ff6666; font-size:11px; font-weight:bold; border-radius:2px; transition:0.3s;">
          ❌ CHƯA CÓ MỤC TIÊU (0)
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
          <input id="ce-replace-val" type="number" placeholder="Giá trị mới (VD: 99999)..." style="background:#442222; color:#fff; border:1px solid #cc3300; padding:5px; width:65%; outline:none;">
          <button id="ce-btn-write" style="background:#cc3300; color:#fff; border:none; padding:5px 10px; cursor:pointer; font-weight:bold; border-radius:2px; width:30%;">GHI ĐÈ</button>
      </div>
      <label style="font-size:13px; cursor:pointer; display:flex; align-items:center; gap:5px; color:#aaa;">
          <input type="checkbox" id="ce-cb-freeze" style="cursor:pointer;"> Đóng băng giá trị mới
      </label>
  </div>
`;

const getConsoleLogUI = () => `
  <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:10px; margin-bottom:2px; flex-shrink:0;">
      <span style="font-size:11px; color:#aaa; font-weight:bold;">CONSOLE LOG</span>
      <span id="ce-btn-clear" style="cursor:pointer; font-size:11px; color:#ff4444; font-weight:bold; padding:2px 5px; border:1px solid #ff4444; border-radius:3px;">🔄 New Scan</span>
  </div>
  <div id="ce-log" style="padding:8px; background:#111; font-family:monospace; font-size:12px; height:60px; min-height:40px; overflow-y:auto; border-radius:3px; border:1px inset #333; resize:vertical; flex-grow:1;">
      <div style="color:#888;">[System] UI Ready. Hãy nhập số và Scan.</div>
  </div>
`;

// Hàm khởi tạo Giao diện chính
globalThis.initModMenu = function () {
  if (document.getElementById("wasm-ce-ui")) return;

  const ui = document.createElement("div");
  ui.id = "wasm-ce-ui";
  // Đã thêm: resize: both; min-width, min-height để không bị co rúm quá mức
  ui.style.cssText = `
        position:fixed; top:20px; left:20px; width:320px; min-width:250px; min-height:220px;
        background:#1e1e1e; border:1px solid #444; border-radius:5px; 
        box-shadow:0 10px 25px rgba(0,0,0,0.8); z-index:9999999; 
        color:#fff; font-family:sans-serif; overflow:hidden; 
        resize:both; display:flex; flex-direction:column;
    `;

  ui.innerHTML = `
      ${getHeaderUI()}
      <div id="ce-body" style="padding:15px; display:flex; flex-direction:column; flex-grow:1; overflow:hidden;">
          ${getScanSelectorsUI()}
          ${getExactScanAreaUI()}
          ${getTrendScanAreaUI()}
          ${getEncryptedScanAreaUI()}
          ${getWriteAndFreezeUI()}
          ${getConsoleLogUI()}
      </div>
  `;

  document.body.appendChild(ui);
  bindUIEvents();
};

globalThis.updateTargetStatus = function (count) {
  const statusBox = document.getElementById("ce-target-status");
  if (!statusBox) return;

  if (count === 1) {
    // Đã khóa 1 mục tiêu -> Sáng đèn Xanh rực rỡ
    statusBox.innerHTML = "🎯 ĐÃ KHÓA 1 MỤC TIÊU! SẴN SÀNG!";
    statusBox.style.background = "#114411";
    statusBox.style.borderColor = "#00ff88";
    statusBox.style.color = "#00ff88";
    statusBox.style.boxShadow = "0 0 10px rgba(0, 255, 136, 0.3)"; // Đổ bóng viền phát sáng
  } else if (count > 1) {
    // Còn nhiều kết quả -> Đèn Vàng cảnh báo
    statusBox.innerHTML = `⚠️ TÌM THẤY ${count} MỤC TIÊU. HÃY LỌC TIẾP!`;
    statusBox.style.background = "#443311";
    statusBox.style.borderColor = "#ffcc00";
    statusBox.style.color = "#ffcc00";
    statusBox.style.boxShadow = "none";
  } else {
    // Mất dấu -> Đèn Đỏ
    statusBox.innerHTML = "❌ MẤT DẤU / CHƯA CÓ MỤC TIÊU (0)";
    statusBox.style.background = "#331111";
    statusBox.style.borderColor = "#cc3300";
    statusBox.style.color = "#ff6666";
    statusBox.style.boxShadow = "none";
  }
};

// Hàm ghi log trực tiếp trên UI
globalThis.logStatus = function (msg, type = "info") {
  const logBox = document.getElementById("ce-log");
  if (!logBox) return;

  const colorMap: Record<string, string> = {
    error: "color: #ff4444; font-weight: bold;",
    success: "color: #00ff88;",
    warning: "color: #ffcc00; font-weight: bold;",
    info: "color: #cccccc;",
    critical: "color:#fff; background:#cc3300; padding:2px; font-weight:bold;",
    freeze:
      "color:#00ffff; font-weight:bold; border-left:2px solid #00ffff; padding-left:5px;",
  };

  const css = colorMap[type] || colorMap.info;

  const div = document.createElement("div");
  div.style.cssText =
    css +
    " margin-bottom: 4px; border-bottom: 1px solid #333; padding-bottom: 2px;";
  div.innerHTML = msg;

  logBox.appendChild(div);

  logBox.scrollTop = logBox.scrollHeight;
};

function setupUIDraggable() {
  const ui = document.getElementById("wasm-ce-ui");
  const header = document.getElementById("ce-header");
  if (!ui || !header) return;

  let isDragging = false,
    startX: number,
    startY: number,
    initialX: number,
    initialY: number;

  header.addEventListener("mousedown", (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    initialX = Number.parseInt(globalThis.getComputedStyle(ui).left, 10) || 0;
    initialY = Number.parseInt(globalThis.getComputedStyle(ui).top, 10) || 0;
    ui.style.transition = "none";
  });

  globalThis.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    let newX = initialX + (e.clientX - startX);
    let newY = initialY + (e.clientY - startY);

    newX = Math.max(0, newX);
    newY = Math.max(0, newY);

    const maxX = window.innerWidth - ui.offsetWidth;
    const maxY = window.innerHeight - ui.offsetHeight;
    newX = Math.min(newX, maxX);
    newY = Math.min(newY, maxY);

    ui.style.left = `${newX}px`;
    ui.style.top = `${newY}px`;
  });

  globalThis.addEventListener("mouseup", () => {
    isDragging = false;
    ui.style.transition = "0.2s";
  });
}

function getParams() {
  const typeSelect = document.getElementById(
    "ce-data-type",
  ) as HTMLSelectElement | null;

  return {
    type: typeSelect?.value || "i32",
  };
}

function lockUIForScanning(isLocked: boolean) {
  const dataTypeSelect = document.getElementById(
    "ce-data-type",
  ) as HTMLSelectElement | null;
  const scanModeSelect = document.getElementById(
    "ce-scan-mode",
  ) as HTMLSelectElement | null;

  if (!dataTypeSelect || !scanModeSelect) return;

  dataTypeSelect.disabled = isLocked;
  scanModeSelect.disabled = isLocked;

  dataTypeSelect.style.opacity = isLocked ? "0.5" : "1";
  scanModeSelect.style.opacity = isLocked ? "0.5" : "1";
}

function setupButtonHandlers() {
  const quickScan = (scanType: string) => {
    const { type } = getParams();
    if (typeof globalThis.executeScan === "function") {
      globalThis.executeScan(scanType, type);
    }
  };

  const snapAction = () => {
    lockUIForScanning(true);
    const { type } = getParams();
    if (typeof globalThis.executeScan === "function") {
      globalThis.executeScan("unknown_initial", type);
    }
  };

  // Các nút Core
  const btnFirstScan = document.getElementById("ce-btn-first");
  btnFirstScan?.addEventListener("click", () => {
    lockUIForScanning(true);

    const p = getParams();
    if (typeof globalThis.executeScan === "function") {
      globalThis.executeScan("first", p.type);
    }
  });

  const btnNextScan = document.getElementById("ce-btn-next");
  btnNextScan?.addEventListener("click", () => {
    const p = getParams();
    if (typeof globalThis.executeScan === "function") {
      globalThis.executeScan("next", p.type);
    }
  });

  const btnRedraw = document.getElementById("ce-btn-redraw");
  btnRedraw?.addEventListener("click", () => {
    // Chỉ cần xóa sạch biến nhớ toàn cục này, Mắt Thần sẽ tự hiểu là phải bắt người dùng khoanh lại ở lần Scan tiếp theo
    globalThis.visionBox = null;
    document.getElementById("ce-persistent-box")?.remove();
    globalThis.logStatus(
      "🗑️ Đã xóa vùng cắt cũ. Hãy bấm Scan để khoanh vùng mới!",
      "info",
    );
  });

  const btnUnknownScan = document.getElementById("ce-btn-unknown");
  btnUnknownScan?.addEventListener("click", () => {
    lockUIForScanning(true);

    const params = getParams();

    if (typeof globalThis.executeScan === "function") {
      globalThis.executeScan("unknown_initial", params.type);
    }
  });

  const btnIncreased = document.getElementById("ce-btn-increased");
  btnIncreased?.addEventListener("click", () => {
    const { type } = getParams();
    if (typeof globalThis.executeScan === "function") {
      globalThis.executeScan("increased", type);
    }
  });

  const btnDecreased = document.getElementById("ce-btn-decreased");
  btnDecreased?.addEventListener("click", () => {
    const { type } = getParams();
    if (typeof globalThis.executeScan === "function") {
      globalThis.executeScan("decreased", type);
    }
  });

  const btnChanged = document.getElementById("ce-btn-changed");
  btnChanged?.addEventListener("click", () => quickScan("changed"));

  const btnUnchanged = document.getElementById("ce-btn-unchanged");
  btnUnchanged?.addEventListener("click", () => quickScan("unchanged"));

  const btnSnapTrend = document.getElementById("ce-btn-snap-trend");
  btnSnapTrend?.addEventListener("click", snapAction);

  const btnSnapEncryption = document.getElementById("ce-btn-snap-enc");
  btnSnapEncryption?.addEventListener("click", snapAction);

  // Các nút chức năng khác
  const btnWrite = document.getElementById("ce-btn-write");
  btnWrite?.addEventListener("click", () => {
    const replaceVal = Number(
      (document.getElementById("ce-replace-val") as HTMLInputElement)?.value,
    );
    const { type } = getParams();
    globalThis.writeValue(replaceVal, type);
  });

  const cbFreeze = document.getElementById("ce-cb-freeze");
  cbFreeze?.addEventListener("change", (e) => {
    const isChecked = (e.target as HTMLInputElement).checked;
    const { type } = getParams();

    if (isChecked) {
      // Nếu startFreeze thất bại (trả về false), tự động bỏ tick
      const success = globalThis.startFreeze(type);
      if (!success) {
        (e.target as HTMLInputElement).checked = false;
      }
    } else {
      globalThis.stopFreeze();
    }
  });

  const btnClear = document.getElementById("ce-btn-clear");
  btnClear?.addEventListener("click", () => {
    lockUIForScanning(false);

    const logBox = document.getElementById("ce-log");
    if (logBox) {
      logBox.innerHTML =
        '<div style="color:#888;">[System] Đã dọn dẹp log.</div>';
    }
  });

  // Nút điều khiển Window (Đóng / Thu nhỏ)
  const btnClose = document.getElementById("ce-btn-close");
  btnClose?.addEventListener("click", () =>
    document.getElementById("wasm-ce-ui")?.remove(),
  );

  const btnMin = document.getElementById("ce-btn-min");
  btnMin?.addEventListener("click", () => {
    const body = document.getElementById("ce-body");
    const ui = document.getElementById("wasm-ce-ui");
    const titleName = document.getElementById("ce-title-name");

    if (!body || !ui || !titleName || !btnMin) return;

    const isMinimized = body.style.display === "none";

    if (isMinimized) {
      // TRẠNG THÁI: PHÓNG TO (MỞ RỘNG)
      body.style.display = "flex";
      titleName.style.display = "inline"; // Hiện lại chữ "WASM Engine"
      ui.style.resize = "both"; // Trả lại khả năng resize
      ui.style.width = ui.dataset.oldWidth || "320px"; // Khôi phục chiều rộng cũ
      ui.style.minHeight = "220px";
      btnMin.innerHTML = "−"; // Đổi icon thành dấu Trừ
      btnMin.style.fontSize = "14px";
    } else {
      // TRẠNG THÁI: THU NHỎ
      ui.dataset.oldWidth = ui.style.width; // Lưu lại chiều rộng trước khi thu nhỏ
      body.style.display = "none";
      titleName.style.display = "none"; // Ẩn chữ đi, chỉ chừa lại icon 🧰 để làm chỗ cầm kéo
      ui.style.resize = "none"; // Tắt resize khi thu gọn
      ui.style.width = "auto"; // Co chiều rộng lại cho ôm sát nút
      ui.style.minHeight = "auto";
      ui.style.height = "auto";
      btnMin.innerHTML = "◻"; // Đổi icon thành ô vuông (Maximize)
      btnMin.style.fontSize = "18px"; // Chữ ô vuông hơi nhỏ nên tăng size lên tí cho cân
    }
  });
}

function bindUIEvents() {
  const dataTypeSelect = document.getElementById(
    "ce-data-type",
  ) as HTMLSelectElement | null;
  const scanModeSelect = document.getElementById(
    "ce-scan-mode",
  ) as HTMLSelectElement | null;
  const newScanBtn = document.getElementById("ce-btn-clear");

  if (!dataTypeSelect || !scanModeSelect || !newScanBtn) return;

  newScanBtn.innerHTML = "🔄 New Scan";
  newScanBtn.style.color = "#00ff88";
  newScanBtn.style.borderColor = "#00ff88";

  newScanBtn.addEventListener("click", () => {
    dataTypeSelect.disabled = false;
    scanModeSelect.disabled = false;
    dataTypeSelect.style.opacity = "1";
    scanModeSelect.style.opacity = "1";

    const logBox = document.getElementById("ce-log");
    if (logBox) logBox.innerHTML = "";

    if (typeof globalThis.resetScanSession === "function") {
      globalThis.resetScanSession();
    }
  });

  scanModeSelect?.addEventListener("change", (e) => {
    const target = e.target as HTMLSelectElement;
    const mode = target.value;

    const areaExact = document.getElementById("area-exact");
    const areaTrend = document.getElementById("area-trend");
    const areaEncrypted = document.getElementById("area-encrypted");

    if (areaExact)
      areaExact.style.display = mode === "exact" ? "block" : "none";
    if (areaTrend)
      areaTrend.style.display = mode === "trend" ? "block" : "none";
    if (areaEncrypted)
      areaEncrypted.style.display = mode === "encrypted" ? "block" : "none";

    console.log("Đã chuyển sang chế độ:", mode);
  });

  setupUIDraggable();
  setupButtonHandlers();
}

// 2. HÀM GỌI GIAO DIỆN (Trả về Promise để luồng quét đứng chờ)
globalThis.showTrainingUI = function (
  digits: BinaryTemplate[],
  guesses: string[],
): Promise<boolean> {
  return new Promise((resolve) => {
    let modal = document.getElementById(
      "ce-train-modal",
    ) as HTMLDivElement | null;
    if (!modal) {
      const trainingModalHTML = `
        <div id="ce-train-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); z-index: 9999999; justify-content: center; align-items: center; font-family: monospace;">
          <div style="background: #222; border: 2px solid #00ff88; border-radius: 8px; padding: 20px; width: 80%; max-width: 600px; box-shadow: 0 0 20px rgba(0, 255, 136, 0.3);">
            <h3 style="color: #00ff88; margin-top: 0; text-align: center;">🧠 MẮT THẦN: HUẤN LUYỆN FONT CHỮ LẠ</h3>
            <p style="color: #ccc; font-size: 13px; text-align: center;">Vui lòng nhập số tương ứng cho từng hình. Nhập chữ <b>x</b> để bỏ qua.</p>
            
            <div id="ce-train-container" style="display: flex; gap: 15px; flex-wrap: wrap; justify-content: center; margin: 20px 0; max-height: 50vh; overflow-y: auto; padding: 10px;">
              </div>
            
            <div style="display: flex; gap: 10px; justify-content: center;">
              <button id="ce-btn-train-save" style="background: #007acc; color: white; border: none; padding: 10px 20px; cursor: pointer; border-radius: 4px; font-weight: bold;">💾 LƯU & TIẾP TỤC QUÉT</button>
              <button id="ce-btn-train-cancel" style="background: #444; color: white; border: none; padding: 10px 20px; cursor: pointer; border-radius: 4px;">❌ HỦY LỆNH</button>
            </div>
          </div>
        </div>
      `;

      const modalWrapper = document.createElement("div");
      modalWrapper.innerHTML = trainingModalHTML;
      document.body.appendChild(modalWrapper); // Gắn vào body

      // Lấy lại reference chuẩn sau khi đã gắn vào DOM
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

    container.innerHTML = ""; // Xóa dữ liệu cũ

    // Render từng mảnh cắt thành một thẻ Flashcard
    digits.forEach((digit, index) => {
      const card = document.createElement("div");
      card.style.cssText =
        "background: #111; padding: 10px; border: 1px solid #444; border-radius: 6px; display: flex; flex-direction: column; align-items: center; gap: 10px;";

      // Tạo thẻ Canvas để vẽ mảng binary thành hình ảnh trắng đen
      const canvas = document.createElement("canvas");
      canvas.width = digit.width;
      canvas.height = digit.height;
      // Phóng to ảnh lên 3 lần cho dễ nhìn (Pixel Art style)
      canvas.style.cssText =
        "width: " +
        digit.width * 3 +
        "px; height: " +
        digit.height * 3 +
        "px; image-rendering: pixelated; border: 1px dashed #666;";

      const ctx = canvas.getContext("2d");
      if (ctx) {
        const imgData = ctx.createImageData(digit.width, digit.height);

        const pixelArray = digit.pixels;
        // Biến số 1 thành màu vàng (vùng sáng), số 0 thành trong suốt (nền đen)
        for (let i = 0; i < pixelArray.length; i++) {
          const val = pixelArray[i] === 1 ? 255 : 0;
          const px = i * 4;
          imgData.data[px] = val; // R (Vàng)
          imgData.data[px + 1] = val; // G (Vàng)
          imgData.data[px + 2] = 0; // B
          imgData.data[px + 3] = val === 255 ? 255 : 0; // Alpha
        }
        ctx.putImageData(imgData, 0, 0);
      }

      // Ô nhập số
      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 1; // Chỉ cho nhập 1 ký tự
      input.dataset.index = index.toString(); // Gắn ID để lúc lưu biết là của hình nào

      input.value = guesses[index] || "";
      input.style.color = guesses[index] ? "#00ff88" : "#ffffff";
      input.style.cssText +=
        "width: 30px; text-align: center; font-size: 18px; font-weight: bold; background: #333; border: 1px solid #007acc; border-radius: 4px; padding: 4px;";

      card.appendChild(canvas);
      card.appendChild(input);
      container.appendChild(card);
    });

    modal.style.display = "flex";

    // 3. XỬ LÝ SỰ KIỆN NÚT BẤM
    const cleanup = () => {
      modal.style.display = "none";
      btnSave.onclick = null;
      btnCancel.onclick = null;
    };

    btnCancel.onclick = () => {
      cleanup();
      resolve(false); // Báo cáo: Người dùng hủy
    };

    btnSave.onclick = () => {
      const inputs = container.querySelectorAll("input");
      inputs.forEach((input) => {
        const char = input.value.trim().toLowerCase();
        const idx = Number.parseInt(input.dataset.index || "0", 10);

        if (char && char !== "x") {
          // Bơm thẳng dữ liệu vào NÃO BỘ (Map visionTemplates)
          // Giả định hàm train của bạn nhận (BinaryData, Character)
          globalThis.BinaryMatcher.train(char, digits[idx]);
        }
      });
      cleanup();
      resolve(true); // Báo cáo: Học xong, chạy tiếp đi!
    };
  });
};
