const url = window.location.href;
const isTrashFrame =
    /googleads|googlesyndication|adtrafficquality|doubleclick|2mdn\.net|recaptcha|safeframe|xd_handler|pixel|analytics|about:blank|about:srcdoc/i
        .test(url);

if (!isTrashFrame) {
  function injectScript(file) {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(file);
      script.onload = () => {
        script.remove();
        resolve();
      };
      (document.head || document.documentElement).appendChild(script);
    });
  }


  chrome.storage.local.get(['isWasmEnabled'], (result) => {
    if (result.isWasmEnabled === true) {
      console.log(`🧰 WASM Hacker [ON]: Đang bẫy RAM tại -> ${
          window.location.hostname}`);

      injectScript('core_controller.js').then(() => injectScript('ui_view.js'));
    } else {
      console.log(`🧰 WASM Hacker [OFF]: Đang ngủ đông tại -> ${
          window.location.hostname}`);
    }
  });


  chrome.storage.onChanged.addListener((changes) => {
    if (changes.isWasmEnabled) {
      if (changes.isWasmEnabled.newValue === true) {
        // ĐANG OFF -> BẬT LÊN: Reload lại trang
        if (window === window.top) {
          console.log(`🧰 WASM Hacker [ACTION]: Đang tải lại trang -> ${
              window.location.hostname}`);
          window.location.reload();
        }
      } else {
        // ĐANG ON -> TẮT ĐI: Tự tay xóa UI và bắn tín hiệu ngầm

        // 1. Xóa giao diện trực tiếp qua DOM (Cực kỳ an toàn)
        const ui = document.getElementById('wasm-ce-ui');
        if (ui) ui.remove();

        // 2. Bắn một Event xuyên qua rào cản thế giới để báo cho file Core
        document.dispatchEvent(new CustomEvent('WASM_HACKER_SHUTDOWN'));

        console.log(
            `🧰 WASM Hacker [OFF]: Đã gỡ UI và ngắt bẫy tại -> ${
                window.location.hostname}`);
      }
    }
  });
}