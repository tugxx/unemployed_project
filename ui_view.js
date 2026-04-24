// ==========================================
// FILE: ui_view.js (Chỉ xử lý Giao diện & Tương tác)
// ==========================================

// Hàm khởi tạo Giao diện chính
window.initModMenu = function() {
  if (document.getElementById('wasm-ce-ui')) return;

  const ui = document.createElement('div');
  ui.id = 'wasm-ce-ui';
  // Đã thêm: resize: both; min-width, min-height để không bị co rúm quá mức
  ui.style.cssText = `
        position:fixed; top:20px; left:20px; width:320px; min-width:250px; min-height:220px;
        background:#1e1e1e; border:1px solid #444; border-radius:5px; 
        box-shadow:0 10px 25px rgba(0,0,0,0.8); z-index:9999999; 
        color:#fff; font-family:sans-serif; overflow:hidden; 
        resize:both; display:flex; flex-direction:column;
    `;

  ui.innerHTML = `
        <div id="ce-header" style="background:#2d2d30; padding:10px; cursor:move; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #444; flex-shrink:0;">
            <b id="ce-title-text" style="color:#00ff88; font-size:14px; user-select:none;">🧰 <span id="ce-title-name">WASM Engine V5</span></b>
            
            <div style="display:flex; gap:6px;">
                <button id="ce-btn-min" style="width:24px; height:24px; background:#444; color:#fff; border:none; border-radius:3px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:bold; padding:0; transition:0.2s;" title="Thu nhỏ / Phóng to">
                    −
                </button>
                <button id="ce-btn-close" style="width:24px; height:24px; background:#cc3300; color:#fff; border:none; border-radius:3px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold; padding:0; transition:0.2s;" title="Đóng">
                    ✖
                </button>
            </div>
        </div>

        <div id="ce-body" style="padding:15px; display:flex; flex-direction:column; flex-grow:1; overflow:hidden;">
            <div style="margin-bottom:10px; display:flex; justify-content:space-between; flex-shrink:0;">
                <select id="ce-data-type" style="background:#333; color:#fff; border:1px solid #555; padding:5px; width:48%; outline:none;">
                    <option value="f64">Double (8 Bytes)</option>
                    <option value="f32">Float (4 Bytes)</option>
                    <option value="i32">Int32 (4 Bytes)</option>
                </select>
                <input id="ce-input-val" type="number" placeholder="Giá trị quét..." style="background:#333; color:#fff; border:1px solid #555; padding:5px; width:48%; outline:none;">
            </div>
            
            <div style="display:flex; gap:5px; margin-bottom:10px; flex-shrink:0;">
                <button id="ce-btn-first" style="flex:1; background:#007acc; color:#fff; border:none; padding:8px; cursor:pointer; font-weight:bold; border-radius:2px;">First Scan</button>
                <button id="ce-btn-next" style="flex:1; background:#007acc; color:#fff; border:none; padding:8px; cursor:pointer; font-weight:bold; border-radius:2px;">Next Scan</button>
            </div>
            
            <div style="border-top:1px dashed #555; padding-top:10px; margin-bottom:10px; flex-shrink:0;">
                <div id="ce-target-status" style="text-align:center; padding:5px; margin-bottom:8px; background:#331111; border:1px solid #cc3300; color:#ff6666; font-size:11px; font-weight:bold; border-radius:2px; transition:0.3s;">
                    ❌ CHƯA CÓ MỤC TIÊU (0)
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <input id="ce-replace-val" type="number" placeholder="Giá trị mới (VD: 99999)..." style="background:#442222; color:#fff; border:1px solid #cc3300; padding:5px; width:65%; outline:none;">
                    <button id="ce-btn-write" style="background:#cc3300; color:#fff; border:none; padding:5px 10px; cursor:pointer; font-weight:bold; border-radius:2px; width:30%;">GHI ĐÈ</button>
                </div>
                <label style="font-size:13px; cursor:pointer; display:flex; align-items:center; gap:5px; color:#aaa;">
                    <input type="checkbox" id="ce-cb-freeze" style="cursor:pointer;"> Đóng băng giá trị mới này
                </label>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:10px; margin-bottom:2px; flex-shrink:0;">
                <span style="font-size:11px; color:#aaa; font-weight:bold;">CONSOLE LOG</span>
                <span id="ce-btn-clear" style="cursor:pointer; font-size:11px; color:#ff4444; font-weight:bold; padding:2px 5px; border:1px solid #ff4444; border-radius:3px;">🗑️ Clear</span>
            </div>
            <div id="ce-log" style="padding:8px; background:#111; font-family:monospace; font-size:12px; height:60px; min-height:40px; overflow-y:auto; border-radius:3px; border:1px inset #333; resize:vertical; flex-grow:1;">
                <div style="color:#888;">[System] UI Ready. Hãy nhập số và Scan.</div>
            </div>
        </div>
    `;
  document.body.appendChild(ui);
  bindUIEvents();
};

// Hàm ghi log trực tiếp trên UI
window.logStatus = function(msg, type = 'info') {
  const logBox = document.getElementById('ce-log');
  if (!logBox) return;

  let css = '';
  switch (type) {
    case 'error':
      css = 'color:#ff4444;';
      break;
    case 'success':
      css = 'color:#00ff88;';
      break;
    case 'warning':
      css = 'color:#ffcc00; font-weight:bold;';
      break;  // Vàng nổi bật
    case 'critical':
      css = 'color:#fff; background:#cc3300; padding:2px; font-weight:bold;';
      break;  // Đỏ nền
    case 'freeze':
      css =
          'color:#00ffff; font-weight:bold; border-left:2px solid #00ffff; padding-left:5px;';
      break;  // Xanh ngọc mờ
    default:
      css = 'color:#aaaaaa;';
  }

  logBox.innerHTML += `<div style="${css} margin-top:4px;">> ${msg}</div>`;
  logBox.scrollTop = logBox.scrollHeight;
};

// Khai báo sự kiện (Liên kết tới core_controller.js)
function bindUIEvents() {
  function getParams() {
    return {
      val: Number(document.getElementById('ce-input-val').value),
      type: document.getElementById('ce-data-type').value
    };
  }

  document.getElementById('ce-btn-first').addEventListener('click', () => {
    let p = getParams();
    window.executeScan('first', p.val, p.type);
  });

  document.getElementById('ce-btn-next').addEventListener('click', () => {
    let p = getParams();
    window.executeScan('next', p.val, p.type);
  });

  document.getElementById('ce-btn-write').addEventListener('click', () => {
    let replaceVal = Number(document.getElementById('ce-replace-val').value);
    let type = document.getElementById('ce-data-type').value;
    window.writeValue(replaceVal, type);
  });

  document.getElementById('ce-cb-freeze').addEventListener('change', (e) => {
    let replaceVal = Number(document.getElementById('ce-replace-val').value);
    let type = document.getElementById('ce-data-type').value;

    // Nhận kết quả từ hàm toggleFreeze (Core)
    let isSuccess = window.toggleFreeze(e.target.checked, replaceVal, type);

    // Nếu Core từ chối Đóng băng (trả về false), Ép bỏ tick ô vuông trên UI
    if (isSuccess === false) {
      e.target.checked = false;
    }
  });

  document.getElementById('ce-btn-clear').addEventListener('click', () => {
    const logBox = document.getElementById('ce-log');
    if (logBox) {
      logBox.innerHTML =
          '<div style="color:#888;">[System] Đã dọn dẹp log.</div>';
    }
  });

  // Nút Đóng & Thu nhỏ
  document.getElementById('ce-btn-close')
      .addEventListener(
          'click', () => document.getElementById('wasm-ce-ui').remove());

  document.getElementById('ce-btn-min').addEventListener('click', () => {
    const body = document.getElementById('ce-body');
    const ui = document.getElementById('wasm-ce-ui');
    const btnMin = document.getElementById('ce-btn-min');
    const titleName = document.getElementById('ce-title-name');

    if (body.style.display === 'none') {
      // TRẠNG THÁI: PHÓNG TO (MỞ RỘNG)
      body.style.display = 'flex';
      titleName.style.display = 'inline';  // Hiện lại chữ "WASM Engine"

      ui.style.resize = 'both';  // Trả lại khả năng resize
      ui.style.width =
          ui.dataset.oldWidth || '320px';  // Khôi phục chiều rộng cũ
      ui.style.minHeight = '220px';

      btnMin.innerHTML = '−';  // Đổi icon thành dấu Trừ
      btnMin.style.fontSize = '14px';
    } else {
      // TRẠNG THÁI: THU NHỎ
      ui.dataset.oldWidth =
          ui.style.width;  // Lưu lại chiều rộng trước khi thu nhỏ

      body.style.display = 'none';
      titleName.style.display = 'none';  // Ẩn chữ đi, chỉ chừa lại icon
                                         // 🧰 để làm chỗ cầm kéo

      ui.style.resize = 'none';  // Tắt resize khi thu gọn
      ui.style.width = 'auto';   // Co chiều rộng lại cho ôm sát nút
      ui.style.minHeight = 'auto';
      ui.style.height = 'auto';

      btnMin.innerHTML = '◻';  // Đổi icon thành ô vuông (Maximize)
      btnMin.style.fontSize =
          '18px';  // Chữ ô vuông hơi nhỏ nên tăng size lên tí cho cân
    }
  });

  // Logic Kéo thả (Drag & Drop) siêu mượt
  const ui = document.getElementById('wasm-ce-ui');
  const header = document.getElementById('ce-header');
  let isDragging = false, startX, startY, initialX, initialY;

  header.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    initialX = ui.offsetLeft;
    initialY = ui.offsetTop;
    document.body.style.userSelect = 'none';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    ui.style.left = (initialX + e.clientX - startX) + 'px';
    ui.style.top = (initialY + e.clientY - startY) + 'px';
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.userSelect = '';
  });

  window.updateTargetStatus = function(count) {
    const statusBox = document.getElementById('ce-target-status');
    if (!statusBox) return;

    if (count === 1) {
      // Đã khóa 1 mục tiêu -> Sáng đèn Xanh rực rỡ
      statusBox.innerHTML = '🎯 ĐÃ KHÓA 1 MỤC TIÊU! SẴN SÀNG!';
      statusBox.style.background = '#114411';
      statusBox.style.borderColor = '#00ff88';
      statusBox.style.color = '#00ff88';
      statusBox.style.boxShadow =
          '0 0 10px rgba(0, 255, 136, 0.3)';  // Đổ bóng viền phát sáng
    } else if (count > 1) {
      // Còn nhiều kết quả -> Đèn Vàng cảnh báo
      statusBox.innerHTML =
          `⚠️ TÌM THẤY ${count} MỤC TIÊU. HÃY LỌC TIẾP!`;
      statusBox.style.background = '#443311';
      statusBox.style.borderColor = '#ffcc00';
      statusBox.style.color = '#ffcc00';
      statusBox.style.boxShadow = 'none';
    } else {
      // Mất dấu -> Đèn Đỏ
      statusBox.innerHTML = '❌ MẤT DẤU / CHƯA CÓ MỤC TIÊU (0)';
      statusBox.style.background = '#331111';
      statusBox.style.borderColor = '#cc3300';
      statusBox.style.color = '#ff6666';
      statusBox.style.boxShadow = 'none';
    }
  };
}