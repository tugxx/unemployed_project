globalThis.freezeInterval = null;
globalThis.freezeInterval = globalThis.freezeInterval ?? null;

globalThis.writeValue = function writeValue(val, type) {
  try {
    if (!globalThis.scanResults || globalThis.scanResults.length === 0)
      throw new Error("Không có địa chỉ nào để bơm!");
    if (Number.isNaN(val)) throw new Error("Giá trị bơm không hợp lệ!");

    const view = globalThis.getMemoryView(type);

    for (const i of globalThis.scanResults) {
      if (i < view.length) {
        // Check an toàn Out-of-bounds
        view[i] = val;
      }
    }
    globalThis.logStatus(
      `💸 Đã bơm ${val} vào ${globalThis.scanResults.length} địa chỉ!`,
      "success",
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    globalThis.logStatus(`❌ Lỗi Bơm: ${msg}`, "error");
    if (globalThis.freezeInterval) {
      clearInterval(globalThis.freezeInterval);
      globalThis.freezeInterval = null;
      globalThis.logStatus("⚠️ Đã tự động tắt Đóng Băng vì lỗi RAM.", "error");
    }
  }
};

globalThis.startFreeze = function (type: string): boolean {
  if (!globalThis.scanResults || globalThis.scanResults.length === 0) {
    globalThis.logStatus("⚠️ Không có địa chỉ nào để đóng băng!", "warning");
    return false;
  }

  if (globalThis.scanResults.length > 20) {
    globalThis.logStatus(
      `⚠️ Đang có ${globalThis.scanResults.length} kết quả. Hãy lọc bớt trước khi Freeze!`,
      "warning",
    );
    return false;
  }

  const view = getMemoryView(type);
  const activeFreezes = globalThis.scanResults.map((idx) => ({
    index: idx,
    lockedValue: view[idx], // Khóa bằng chính giá trị nó đang có
  }));

  // Clear cái cũ trước khi tạo cái mới
  if (globalThis.freezeInterval) clearInterval(globalThis.freezeInterval);

  globalThis.freezeInterval = setInterval(() => {
    try {
      const currentView = getMemoryView(type);
      activeFreezes.forEach((item) => {
        if (item.index < currentView.length) {
          currentView[item.index] = item.lockedValue;
        }
      });
    } catch (e) {
      globalThis.stopFreeze(); // Gọi hàm stop dọn dẹp
      globalThis.logStatus(`❌ Freeze bị lỗi, đã tự động ngắt! ${e}`, "error");

      const cb = document.getElementById(
        "ce-cb-freeze",
      ) as HTMLInputElement | null;
      if (cb) cb.checked = false;
    }
  }, 200);

  globalThis.logStatus("❄️ Đã ĐÓNG BĂNG giá trị!", "info");
  return true;
};

globalThis.stopFreeze = function (): boolean {
  if (globalThis.freezeInterval) clearInterval(globalThis.freezeInterval);
  globalThis.freezeInterval = null;
  globalThis.logStatus("🔥 Đã rã đông.", "info");
  return true;
};

document.addEventListener("WASM_HACKER_SHUTDOWN", () => {
  // Nhận được lệnh Tắt -> Dọn dẹp máy bơm (Freeze)
  if (globalThis.freezeInterval) {
    clearInterval(globalThis.freezeInterval);
    globalThis.freezeInterval = null;
    console.log("🔥 [CORE] Đã rút phích cắm hệ thống Đóng băng!");
  }
});
