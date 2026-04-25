// Khởi tạo màu sắc ban đầu khi cài Extension
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ isWasmEnabled: false });
  chrome.action.setBadgeText({ text: "OFF" });
  chrome.action.setBadgeBackgroundColor({ color: "#ff4444" });
});

// Lắng nghe cú Click trực tiếp vào Icon trên thanh Bar
chrome.action.onClicked.addListener((_tab) => {
  chrome.storage.local.get(["isWasmEnabled"], (result) => {
    const newState = !result.isWasmEnabled; // Đảo ngược trạng thái
    chrome.storage.local.set({ isWasmEnabled: newState });

    // Đổi màu hiển thị trực quan ngay trên Icon
    if (newState) {
      chrome.action.setBadgeText({ text: "ON" });
      chrome.action.setBadgeBackgroundColor({ color: "#00ff88" });
    } else {
      chrome.action.setBadgeText({ text: "OFF" });
      chrome.action.setBadgeBackgroundColor({ color: "#ff4444" });
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "captureTab") {
    // chrome.tabs.captureVisibleTab(
    //   { format: "jpeg", quality: 80 },
    //   (dataUrl) => {
    //     sendResponse({ imgDataUrl: dataUrl });
    //   },
    // );
    // Tuyệt chiêu chụp ảnh toàn bộ Tab hiện tại
    chrome.tabs.captureVisibleTab({ format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error("Lỗi Background:", chrome.runtime.lastError.message);
        sendResponse({ error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse({ imgDataUrl: dataUrl });
    });
    return true; // Bắt buộc phải có dòng này để báo hiệu sẽ trả kết quả bất đồng bộ
  }
});
