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

  chrome.storage.local.get(["isWasmEnabled"], async (result) => {
    if (result.isWasmEnabled === true) {
      console.log(
        `🧰 WASM Hacker [ON]: Đang bẫy RAM tại -> ${
          globalThis.location.hostname
        }`,
      );

      const manifest = chrome.runtime.getManifest();
      const webResources = manifest.web_accessible_resources as
        | Array<{ resources: string[] }>
        | undefined;
      const injectScripts = webResources?.[0]?.resources || [];
      // console.log("🎯 Danh sách file cần tiêm:", injectScripts); sonar

      // Vòng lặp này giờ sẽ chỉ chạy đúng 1 lần cho cái file injected_main.bundle.js
      for (const scriptPath of injectScripts) {
        // console.log(`💉 Đang bắt đầu tiêm: ${scriptPath}`); sonar
        await injectScript(scriptPath);
        // console.log(`✅ Tiêm xong: ${scriptPath}`); sonar
      }
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

// Trong file Content Script (nơi chứa injectScript)
window.addEventListener("message", (event) => {
  // 1. Chỉ nhận tin nhắn từ chính trang web hiện tại
  if (
    event.origin !== globalThis.window.location.origin ||
    event.source !== globalThis.window
  ) {
    return;
  }

  // 2. Nhận yêu cầu chụp ảnh từ Mắt Thần (Main World)
  if (event.data?.action === "REQUEST_SCREENSHOT") {
    const messageId = event.data.messageId; // Nhớ ID để trả đúng người

    // 3. Gọi Background (Vì Content Script có quyền dùng chrome.runtime)
    chrome.runtime.sendMessage({ action: "captureTab" }, (response) => {
      // 4. Quăng bức ảnh ngược trở lại Game
      window.postMessage(
        {
          action: "RESPONSE_SCREENSHOT",
          messageId: messageId,
          dataUrl: response.imgDataUrl,
          error: response?.error,
        },
        globalThis.window.location.origin,
      );
    });
  }
});
