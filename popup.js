document.addEventListener('DOMContentLoaded', () => {
  const toggleSwitch = document.getElementById('toggleSwitch');
  const statusText = document.getElementById('statusText');

  // Mở popup lên thì đọc trạng thái cũ để hiển thị
  chrome.storage.local.get(['isWasmEnabled'], (result) => {
    const isEnabled = result.isWasmEnabled || false;
    toggleSwitch.checked = isEnabled;
    statusText.innerText = isEnabled ? 'ĐANG BẬT' : 'ĐANG TẮT';
    statusText.style.color = isEnabled ? '#00ff88' : '#ff4444';
  });

  // Khi gạt công tắc thì lưu lại
  toggleSwitch.addEventListener('change', (e) => {
    const isEnabled = e.target.checked;
    chrome.storage.local.set({isWasmEnabled: isEnabled});
    statusText.innerText = isEnabled ? 'ĐANG BẬT' : 'ĐANG TẮT';
    statusText.style.color = isEnabled ? '#00ff88' : '#ff4444';
  });
});