export function updateDebugView(
  data: Uint8Array | ImageData,
  width: number,
  height: number,
  label: string = "AI Vision",
) {
  // Chỉ chạy khi bật cờ Debug từ console (F12)
  if (!globalThis.IS_DEBUG_VISION) {
    const debugUI = document.getElementById("ce-debug-vision");
    if (debugUI) debugUI.style.display = "none";
    return;
  }

  const debugCanvas = document.createElement("canvas");
  debugCanvas.width = width;
  debugCanvas.height = height;
  const dctx = debugCanvas.getContext("2d");
  if (!dctx) return;

  if (data instanceof ImageData) {
    // 1. Dành cho Tesseract (Ảnh gốc vừa crop)
    dctx.putImageData(data, 0, 0);
  } else {
    // 2. Dành cho Binary Matcher (Mảng nhị phân vàng/đen)
    const dImgData = dctx.createImageData(width, height);
    for (let i = 0; i < data.length; i++) {
      const color = data[i] === 1 ? 255 : 0;
      const p = i * 4;
      dImgData.data[p] = color;
      dImgData.data[p + 1] = color;
      dImgData.data[p + 2] = 0;
      dImgData.data[p + 3] = 255;
    }
    dctx.putImageData(dImgData, 0, 0);
  }

  // Quản lý Element hiển thị (y hệt code của bạn)
  let debugUI = document.getElementById("ce-debug-vision") as HTMLImageElement;
  if (!debugUI) {
    debugUI = document.createElement("img");
    debugUI.id = "ce-debug-vision";
    debugUI.style.cssText = `
      position: fixed; bottom: 10px; right: 10px; z-index: 9999999; 
      border: 2px solid #ff0055; background: #000; width: 250px; 
      image-rendering: pixelated; pointer-events: none;
      box-shadow: 0 0 15px rgba(255, 0, 85, 0.5);
    `;
    document.body.appendChild(debugUI);
  }

  debugUI.style.display = "block";
  debugUI.src = debugCanvas.toDataURL();
  console.log(`👁️ [${label}] Đã cập nhật ảnh X-Ray (${width}x${height})`);
}
