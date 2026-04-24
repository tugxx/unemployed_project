// ==========================================
// FILE: core_controller.js (Core Logic)
// ==========================================

window.wasmMemoryObject = null;
window.scanResults = [];
window.freezeInterval = null;

// ==========================================
// 1. CORE INJECTION & MEMORY HOOKING
// ==========================================
function extractMemory(result) {
  try {
    let instance = result.instance || result;
    for (let key in instance.exports) {
      if (instance.exports[key] instanceof WebAssembly.Memory) {
        window.wasmMemoryObject = instance.exports[key];  // Lưu Object gốc

        if (typeof window.initModMenu === 'function') {
          window.initModMenu();
          window.logStatus('🔥 Bắt RAM thành công! Sẵn sàng quét.', 'success');
        }
      }
    }
  } catch (error) {
    console.error('Lỗi khi trích xuất RAM:', error);
  }
}

// Bịt 3 cửa API của WASM
const originalInstantiateStreaming = WebAssembly.instantiateStreaming;
if (originalInstantiateStreaming) {
  WebAssembly.instantiateStreaming = async function(req, importObject) {
    const result = await originalInstantiateStreaming(req, importObject);
    extractMemory(result);
    return result;
  };
}
const originalInstantiate = WebAssembly.instantiate;
WebAssembly.instantiate = async function(buffer, importObject) {
  const result = await originalInstantiate(buffer, importObject);
  extractMemory(result);
  return result;
};
const OriginalInstance = WebAssembly.Instance;
WebAssembly.Instance = function(module, importObject) {
  const instance = new OriginalInstance(module, importObject);
  extractMemory(instance);
  return instance;
};

// ==========================================
// 2. SCANNER LOGIC (Chống Detached Buffer)
// ==========================================
function getMemoryView(type) {
  if (!window.wasmMemoryObject) throw new Error('Chưa bắt được RAM!');

  const buffer = window.wasmMemoryObject.buffer;
  if (buffer.byteLength === 0) throw new Error('RAM bị lỗi (Detached/Rỗng)!');

  switch (type) {
    case 'i32':
      return new Int32Array(buffer);
    case 'f32':
      return new Float32Array(buffer);
    case 'f64':
      return new Float64Array(buffer);
    default:
      return new Float64Array(buffer);
  }
}

const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

window.executeScan = async function executeScan(scanType, val, type) {
  try {
    if (isNaN(val)) throw new Error('Giá trị không hợp lệ!');

    const view = getMemoryView(type);

    const len = view.length;

    if (scanType === 'first') {
      window.scanResults = [];
      const CHUNK_SIZE = 2000000;

      for (let i = 0; i < len; i += CHUNK_SIZE) {
        const end = Math.min(i + CHUNK_SIZE, len);

        for (let j = i; j < end; j++) {
          if (view[j] === val) window.scanResults.push(j);
        }

        await yieldToMain();
      }
      window.logStatus(
          `🔎 First Scan: ${window.scanResults.length} kết quả.`, 'info');

    } else if (scanType === 'next') {
      if (window.scanResults.length === 0)
        throw new Error('Chưa có kết quả First Scan!');

      let newCount = 0;
      const oldResults = window.scanResults;
      const oldLen = oldResults.length;

      for (let i = 0; i < oldLen; i++) {
        let addr = oldResults[i];
        if (addr < len && view[addr] === val) {
          oldResults[newCount++] = addr;  // Đẩy lên đầu mảng
        }
      }
      oldResults.length = newCount;

      window.logStatus(
          `🎯 Next Scan: Còn ${window.scanResults.length} kết quả.`, 'success');
    }

    if (typeof window.updateTargetStatus === 'function') {
      window.updateTargetStatus(window.scanResults.length);
    }
  } catch (error) {
    window.logStatus(`❌ Lỗi Quét: ${error.message}`, 'error');
    if (typeof window.updateTargetStatus === 'function')
      window.updateTargetStatus(0);
  }
};

window.writeValue = function writeValue(val, type) {
  try {
    if (window.scanResults.length === 0)
      throw new Error('Không có địa chỉ nào để bơm!');
    if (isNaN(val)) throw new Error('Giá trị bơm không hợp lệ!');

    const view = getMemoryView(type);

    for (let i of window.scanResults) {
      if (i < view.length) {  // Check an toàn Out-of-bounds
        view[i] = val;
      }
    }
    window.logStatus(
        `💸 Đã bơm ${val} vào ${window.scanResults.length} địa chỉ!`, 'success');

  } catch (error) {
    window.logStatus(`❌ Lỗi Bơm: ${error.message}`, 'error');
    // Nếu đang đóng băng mà bị lỗi (mất RAM), thì phải TỰ ĐỘNG tắt đóng băng
    if (window.freezeInterval) {
      clearInterval(window.freezeInterval);
      window.freezeInterval = null;
      window.logStatus(
          '⚠️ Đã tự động tắt Đóng Băng vì lỗi RAM.',
          'error');
    }
  }
};

window.toggleFreeze = function(isFreeze, val, type) {
  if (isFreeze) {
    if (window.scanResults.length !== 1) {
      window.logStatus(
          `⚠️ TỪ CHỐI: Đang có ${
              window.scanResults
                  .length} kết quả. Hãy Next Scan để lọc còn ĐÚNG 1 kết quả tránh sập game!`,
          'warning');
      return false;  // Trả về false để UI biết đường tự động bỏ tick
    }

    // Clear cái cũ trước khi tạo cái mới để tránh chồng chéo
    if (window.freezeInterval) clearInterval(window.freezeInterval);

    window.freezeInterval = setInterval(() => {
      // Không in log khi Freeze để tránh spam đầy bảng log
      try {
        const view = getMemoryView(type);
        const targetIndex = window.scanResults[0];
        if (targetIndex < view.length) view[targetIndex] = val;
      } catch (e) {
        clearInterval(window.freezeInterval);
        window.freezeInterval = null;
        window.logStatus('❌ Freeze bị lỗi, đã tự động ngắt!', 'error');

        const cb = document.getElementById('ce-cb-freeze');
        if (cb) cb.checked = false;
      }
    }, 200);
    window.logStatus('❄️ Đã ĐÓNG BĂNG giá trị!', 'info');
    return true;
  } else {
    if (window.freezeInterval) clearInterval(window.freezeInterval);
    window.freezeInterval = null;
    window.logStatus('🔥 Đã rã đông.', 'info');
    return true;
  }
};

document.addEventListener('WASM_HACKER_SHUTDOWN', () => {
  // Nhận được lệnh Tắt -> Dọn dẹp máy bơm (Freeze)
  if (window.freezeInterval) {
    clearInterval(window.freezeInterval);
    window.freezeInterval = null;
    console.log('🔥 [CORE] Đã rút phích cắm hệ thống Đóng băng!');
  }

  // (Tùy chọn) Xóa sạch các biến kết quả để giải phóng RAM
  window.scanResults = [];
  window.wasmMemoryObject = null;
});