declare const __DEV__: boolean;

export const logger = {
  info: (...args: unknown[]) => {
    // Nếu đang build ở chế độ Dev, thì in ra bình thường
    if (__DEV__) {
      console.log("🟢 [HACK-DEV]:", ...args);
    }
    // Nếu ở chế độ Prod (Release), ngậm miệng lại (hoặc gửi log đi chỗ khác an toàn)
  },

  warn: (...args: unknown[]) => {
    if (__DEV__) {
      console.warn("🟡 [HACK-WARN]:", ...args);
    }
  },

  error: (...args: unknown[]) => {
    if (__DEV__) {
      console.error("🔴 [HACK-ERROR]:", ...args);
    } else {
      // PRO-TIP: Ở bản Release, nếu có lỗi nặng, ném nó sang Background Script để đọc!
      // Bọn Anti-cheat ở Web Game không thể nhìn thấy console của Background!
      try {
        globalThis.dispatchEvent(
          new CustomEvent("RELAY_LOG_TO_BG", {
            detail: { type: "error", msg: args.map(String).join(" ") },
          }),
        );
      } catch {
        /* empty */
      }
    }
  },
};
