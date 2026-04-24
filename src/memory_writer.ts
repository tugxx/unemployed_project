globalThis.freezeInterval = null;
globalThis.freezeInterval = globalThis.freezeInterval || null;

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

globalThis.toggleFreeze = function (isFreeze, val, type) {
  if (isFreeze) {
    if (globalThis.scanResults?.length !== 1) {
      globalThis.logStatus(
        `⚠️ TỪ CHỐI: Đang có ${
          globalThis.scanResults.length
        } kết quả. Hãy Next Scan để lọc còn ĐÚNG 1 kết quả tránh sập game!`,
        "warning",
      );
      return false; // Trả về false để UI biết đường tự động bỏ tick
    }

    // Clear cái cũ trước khi tạo cái mới để tránh chồng chéo
    if (globalThis.freezeInterval) clearInterval(globalThis.freezeInterval);

    globalThis.freezeInterval = setInterval(() => {
      // Không in log khi Freeze để tránh spam đầy bảng log
      try {
        const view = getMemoryView(type);
        const targetIndex = globalThis.scanResults[0];
        if (targetIndex < view.length) view[targetIndex] = val;
      } catch (e) {
        clearInterval(globalThis.freezeInterval ?? undefined);
        globalThis.freezeInterval = null;
        globalThis.logStatus(
          `❌ Freeze bị lỗi, đã tự động ngắt! ${e}`,
          "error",
        );

        const cb = document.getElementById(
          "ce-cb-freeze",
        ) as HTMLInputElement | null;
        if (cb) cb.checked = false;
      }
    }, 200);
    globalThis.logStatus("❄️ Đã ĐÓNG BĂNG giá trị!", "info");
    return true;
  } else {
    if (globalThis.freezeInterval) clearInterval(globalThis.freezeInterval);
    globalThis.freezeInterval = null;
    globalThis.logStatus("🔥 Đã rã đông.", "info");
    return true;
  }
};

document.addEventListener("WASM_HACKER_SHUTDOWN", () => {
  // Nhận được lệnh Tắt -> Dọn dẹp máy bơm (Freeze)
  if (globalThis.freezeInterval) {
    clearInterval(globalThis.freezeInterval);
    globalThis.freezeInterval = null;
    console.log("🔥 [CORE] Đã rút phích cắm hệ thống Đóng băng!");
  }
});
