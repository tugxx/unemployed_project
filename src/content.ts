const url = globalThis.location.href;
const isTrashFrame =
  /googleads|googlesyndication|adtrafficquality|doubleclick|2mdn\.net|recaptcha|safeframe|xd_handler|pixel|analytics|about:blank|about:srcdoc/i.test(
    url,
  );

if (!isTrashFrame) {
  function injectScript(file: string): Promise<void> {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL(file);
      script.onload = () => {
        script.remove();
        resolve();
      };
      (document.head || document.documentElement).appendChild(script);
    });
  }

  chrome.storage.local.get(["isWasmEnabled"], (result) => {
    if (result.isWasmEnabled === true) {
      console.log(
        `🧰 WASM Hacker [ON]: Đang bẫy RAM tại -> ${
          globalThis.location.hostname
        }`,
      );

      injectScript("dist/memory_hooker.js")
        .then(() => injectScript("dist/scanner_engine.js"))
        .then(() => injectScript("dist/memory_writer.js"))
        .then(() => injectScript("dist/ui_view.js"));
    } else {
      console.log(
        `🧰 WASM Hacker [OFF]: Đang ngủ đông tại -> ${
          globalThis.location.hostname
        }`,
      );
    }
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.isWasmEnabled) {
      if (changes.isWasmEnabled.newValue === true) {
        // ĐANG OFF -> BẬT LÊN: Reload lại trang
        if (
          (globalThis as unknown as Window) ===
          (globalThis as unknown as Window).top
        ) {
          console.log(
            `🧰 WASM Hacker [ACTION]: Đang tải lại trang -> ${
              globalThis.location.hostname
            }`,
          );
          globalThis.location.reload();
        }
      } else {
        // ĐANG ON -> TẮT ĐI: Tự tay xóa UI và bắn tín hiệu ngầm

        // 1. Xóa giao diện trực tiếp qua DOM (Cực kỳ an toàn)
        const ui = document.getElementById("wasm-ce-ui");
        if (ui) ui.remove();

        // 2. Bắn một Event xuyên qua rào cản thế giới để báo cho file Core
        document.dispatchEvent(new CustomEvent("WASM_HACKER_SHUTDOWN"));

        console.log(
          `🧰 WASM Hacker [OFF]: Đã gỡ UI và ngắt bẫy tại -> ${
            globalThis.location.hostname
          }`,
        );
      }
    }
  });
}
