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

// Kiểm tra trạng thái từ Storage trước khi tiêm Tool
chrome.storage.local.get(['isWasmEnabled'], async function(result) {
  if (result.isWasmEnabled) {
    console.log('🧰 WASM Hacker được BẬT. Bắt đầu tiêm mã...');
    await injectScript('core_controller.js');
    await injectScript('ui_view.js');
  } else {
    console.log('🧰 WASM Hacker đang TẮT. Bỏ qua.');
  }
});