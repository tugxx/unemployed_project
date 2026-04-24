// Khởi tạo màu sắc ban đầu khi cài Extension
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({isWasmEnabled: false});
  chrome.action.setBadgeText({text: 'OFF'});
  chrome.action.setBadgeBackgroundColor({color: '#ff4444'});
});

// Lắng nghe cú Click trực tiếp vào Icon trên thanh Bar
chrome.action.onClicked.addListener((tab) => {
  chrome.storage.local.get(['isWasmEnabled'], (result) => {
    const newState = !result.isWasmEnabled;  // Đảo ngược trạng thái
    chrome.storage.local.set({isWasmEnabled: newState});

    // Đổi màu hiển thị trực quan ngay trên Icon
    if (newState) {
      chrome.action.setBadgeText({text: 'ON'});
      chrome.action.setBadgeBackgroundColor({color: '#00ff88'});
    } else {
      chrome.action.setBadgeText({text: 'OFF'});
      chrome.action.setBadgeBackgroundColor({color: '#ff4444'});
    }
  });
});