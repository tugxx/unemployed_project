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
          <option value="fuzzy">👻 Quét Mờ (Mã hóa)</option>
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
      <input id="ce-input-val" type="number" placeholder="Nhập giá trị cần tìm..." style="background:#222; color:#fff; border:1px solid #555; padding:8px; width:100%; box-sizing:border-box; margin-bottom:10px; outline:none;">
      <div style="display:flex; gap:5px; margin-bottom:10px;">
          <button id="ce-btn-first" style="flex:1; background:#007acc; color:#fff; border:none; padding:8px; cursor:pointer; font-weight:bold; border-radius:2px;">First Scan</button>
          <button id="ce-btn-next" style="flex:1; background:#005999; color:#fff; border:none; padding:8px; cursor:pointer; font-weight:bold; border-radius:2px;">Next Scan</button>
      </div>
  </div>
`;

const getFuzzyScanAreaUI = () => `
  <div id="area-fuzzy" style="display:none; flex-shrink:0;">
      <button id="ce-btn-unknown" style="width:100%; background:#d97706; color:#fff; border:none; padding:8px; margin-bottom:8px; cursor:pointer; font-weight:bold; border-radius:2px;">📸 1. Chụp Ảnh RAM (Bắt đầu)</button>
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
          ${getFuzzyScanAreaUI()}
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

function setupAntiGameSteal() {
  const preventGameSteal = (e: Event) => {
    const target = e.target as Element | null;

    if (target?.closest("#wasm-ce-ui")) {
      e.stopImmediatePropagation();
      e.stopPropagation();
    }
  };

  document.addEventListener("keydown", preventGameSteal, true);
  document.addEventListener("keyup", preventGameSteal, true);
  document.addEventListener("keypress", preventGameSteal, true);
  document.addEventListener("wheel", preventGameSteal, {
    capture: true,
    passive: false,
  });
}

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
    initialX = ui.offsetLeft;
    initialY = ui.offsetTop;
    document.body.style.userSelect = "none";
  });

  globalThis.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    ui.style.left = initialX + e.clientX - startX + "px";
    ui.style.top = initialY + e.clientY - startY + "px";
  });

  globalThis.addEventListener("mouseup", () => {
    isDragging = false;
    document.body.style.userSelect = "";
  });
}

function getParams() {
  const valInput = document.getElementById(
    "ce-input-val",
  ) as HTMLInputElement | null;
  const typeSelect = document.getElementById(
    "ce-data-type",
  ) as HTMLSelectElement | null;

  return {
    val: Number(valInput?.value),
    type: typeSelect?.value || "",
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
  const quickScan = (scanType: string, val: number | null = null) => {
    const { type } = getParams();
    if (typeof globalThis.executeScan === "function") {
      globalThis.executeScan(scanType, val, type);
    }
  };

  // Chuyển đổi UI khi đổi chế độ quét (Exact <-> Fuzzy)
  const scanModeSelect = document.getElementById("ce-scan-mode");
  scanModeSelect?.addEventListener("change", (e) => {
    const target = e.target as HTMLSelectElement;
    const isExact = target.value === "exact";

    const areaExact = document.getElementById("area-exact");
    const areaFuzzy = document.getElementById("area-fuzzy");

    if (areaExact) {
      areaExact.style.display = isExact ? "block" : "none";
    }

    if (areaFuzzy) {
      areaFuzzy.style.display = isExact ? "none" : "block";
    }
  });

  // Các nút Core
  const btnFirstScan = document.getElementById("ce-btn-first");
  btnFirstScan?.addEventListener("click", () => {
    lockUIForScanning(true);

    const p = getParams();
    if (typeof globalThis.executeScan === "function") {
      globalThis.executeScan("first", p.val, p.type);
    }
  });

  const btnNextScan = document.getElementById("ce-btn-next");
  btnNextScan?.addEventListener("click", () => {
    const p = getParams();
    if (typeof globalThis.executeScan === "function") {
      globalThis.executeScan("next", p.val, p.type);
    }
  });

  const btnUnknownScan = document.getElementById("ce-btn-unknown");
  btnUnknownScan?.addEventListener("click", () => {
    lockUIForScanning(true);

    const params = getParams();

    if (typeof globalThis.executeScan === "function") {
      globalThis.executeScan("unknown_initial", null, params.type);
    }
  });

  const btnChanged = document.getElementById("ce-btn-changed");
  btnChanged?.addEventListener("click", () => quickScan("changed"));

  const btnUnchanged = document.getElementById("ce-btn-unchanged");
  btnUnchanged?.addEventListener("click", () => quickScan("unchanged"));

  // Các nút chức năng khác
  const btnWrite = document.getElementById("ce-btn-write");
  btnWrite?.addEventListener("click", () => {
    const replaceVal = Number(
      (document.getElementById("ce-replace-val") as HTMLInputElement)?.value,
    );
    const { type } = getParams();
    globalThis.writeValue(replaceVal, type);
  });

  const btnFreeze = document.getElementById("ce-cb-freeze");
  btnFreeze?.addEventListener("change", (e) => {
    const replaceVal = Number(
      (document.getElementById("ce-replace-val") as HTMLInputElement)?.value,
    );
    const { type } = getParams();

    // Nhận kết quả từ hàm toggleFreeze (Core)
    const isSuccess = globalThis.toggleFreeze(
      (e.target as HTMLInputElement).checked,
      replaceVal,
      type,
    );

    // Nếu Core từ chối Đóng băng (trả về false), Ép bỏ tick ô vuông trên UI
    if (isSuccess === false) {
      (e.target as HTMLInputElement).checked = false;
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

  setupAntiGameSteal();
  setupUIDraggable();
  setupButtonHandlers();
}
