import { logger } from "./utils/logger";

const url = globalThis.location.href;
const isTrashFrame =
  /googleads|googlesyndication|adtrafficquality|doubleclick|2mdn\.net|recaptcha|safeframe|xd_handler|pixel|analytics|about:blank|about:srcdoc/i.test(
    url,
  );

// Nếu là iframe rác, bắt nó tự hủy luôn, không cho chạy xuống dưới!
if (!isTrashFrame) {
  function injectAntiPause() {
    if (globalThis.__antiPauseInjected) return;
    globalThis.__antiPauseInjected = true;

    logger.info("🚀 Từ antipause gọi background để kích hoạt Khiên CDP...");

    globalThis.dispatchEvent(new CustomEvent("RELAY_ENABLE_CDP"));

    // ==========================================
    // LỚP ĐẶC TRỊ: GAME DISTRIBUTION SDK (Hooking)
    // ==========================================

    // Lưu giữ giá trị hiện tại (nếu có)
    let _gdsdk = globalThis.gdsdk;

    Object.defineProperty(globalThis, "gdsdk", {
      get: () => _gdsdk,
      // TypeScript tự nhận diện val chính là cái { pause?: () => void }
      set: (val: typeof globalThis.gdsdk) => {
        if (val) {
          // Đánh tráo hàm pause ngay lúc Game đang nạp SDK
          val.pause = () => {
            logger.info("🛡️ GD SDK Pause (Intercepted) -> Blocked!");
          };
        }
        _gdsdk = val; // Cất vào kho
      },
      configurable: true,
    });

    // Đề phòng trường hợp SDK đã load trước khi ta giăng bẫy
    if (globalThis.gdsdk && typeof globalThis.gdsdk.pause === "function") {
      globalThis.gdsdk.pause = () => {
        logger.info("🛡️ GD SDK Pause (Overwritten) -> Blocked!");
      };
    }
  }

  injectAntiPause();
}
