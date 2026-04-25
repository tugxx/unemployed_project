globalThis.scanResults = [];
globalThis.memorySnapshot = null;
globalThis.activeScanDataType = null;

const yieldToMain = () => new Promise((resolve) => setTimeout(resolve, 0));

globalThis.getMemoryView = function getMemoryView(type) {
  if (!globalThis.wasmMemoryObject) throw new Error("Chưa bắt được RAM!");

  const buffer = globalThis.wasmMemoryObject.buffer;
  if (buffer.byteLength === 0) throw new Error("RAM bị lỗi (Detached/Rỗng)!");

  switch (type) {
    case "i32":
      return new Int32Array(buffer);
    case "f32":
      return new Float32Array(buffer);
    case "f64":
      return new Float64Array(buffer);
    default:
      return new Float64Array(buffer);
  }
};

type TypedArrayView = Int32Array | Float32Array | Float64Array;
const CHUNK_SIZE = 2000000;

async function performExactScan(
  scanType: string,
  val: number,
  view: TypedArrayView,
  typeTag: string,
  len: number,
) {
  if (scanType === "first") {
    globalThis.scanResults = [];

    for (let i = 0; i < len; i += CHUNK_SIZE) {
      const end = Math.min(i + CHUNK_SIZE, len);
      for (let j = i; j < end; j++) {
        if (view[j] === val) globalThis.scanResults.push(j);
      }
      await yieldToMain();
    }
    globalThis.logStatus(
      `🔎 ${typeTag} First Scan: ${globalThis.scanResults.length} kết quả.`,
      "info",
    );

    return;
  }

  if (globalThis.scanResults.length === 0)
    throw new Error("Chưa có kết quả First Scan!");

  let newCount = 0;
  const oldResults = globalThis.scanResults;
  const oldLen = oldResults.length;

  for (let i = 0; i < oldLen; i++) {
    const addr = oldResults[i];
    if (addr < len && view[addr] === val) {
      oldResults[newCount++] = addr;
    }
  }
  oldResults.length = newCount;

  globalThis.logStatus(
    `🎯 ${typeTag} Next Scan: Còn ${globalThis.scanResults.length} kết quả.`,
    "success",
  );
}

function checkDiffMatch(
  scanType: string,
  current: number,
  old: number,
): boolean {
  switch (scanType) {
    // DÀNH CHO BIẾN MÃ HÓA (XOR, Obfuscated) - Như bạn đã nói
    case "changed":
      return current !== old;
    case "unchanged":
      return current === old;

    // DÀNH CHO BIẾN THƯỜNG (Game Idle F64) - Lọc cực nhanh
    case "increased":
      return current > old;
    case "decreased":
      return current < old;

    default:
      return false;
  }
}

async function filterFromScratch(
  scanType: string,
  view: TypedArrayView,
  len: number,
) {
  globalThis.logStatus(`⏳ Đang đối chiếu ảnh chụp...`, "warning");
  // Thêm dấu ! ở cuối để thề với TypeScript là biến này chắc chắn không null
  const snapshot = globalThis.memorySnapshot!;

  for (let i = 0; i < len; i += CHUNK_SIZE) {
    const end = Math.min(i + CHUNK_SIZE, len);
    for (let j = i; j < end; j++) {
      if (checkDiffMatch(scanType, view[j], snapshot[j])) {
        globalThis.scanResults.push(j);
      }
    }
    await yieldToMain();
  }
}

function filterFromOldResults(
  scanType: string,
  view: TypedArrayView,
  len: number,
) {
  let newCount = 0;
  const oldResults = globalThis.scanResults;
  const oldLen = oldResults.length;
  const snapshot = globalThis.memorySnapshot!;

  for (let i = 0; i < oldLen; i++) {
    const addr = oldResults[i];
    if (addr >= len) continue;

    if (checkDiffMatch(scanType, view[addr], snapshot[addr])) {
      oldResults[newCount++] = addr;
    }
  }
  oldResults.length = newCount;
}

async function performDifferenceScan(
  scanType: string,
  view: TypedArrayView,
  typeTag: string,
  len: number,
) {
  if (!globalThis.memorySnapshot)
    throw new Error('Bạn phải quét "Unknown Initial" trước để chụp ảnh!');

  // Lần lọc đầu tiên sau khi chụp
  if (globalThis.scanResults.length === 0) {
    await filterFromScratch(scanType, view, len);
  } else {
    filterFromOldResults(scanType, view, len);
  }

  globalThis.memorySnapshot = view.slice();
  globalThis.logStatus(
    `🎯 ${typeTag} Lọc (${scanType}): Còn ${globalThis.scanResults.length} kết quả.`,
    "success",
  );
}

function resolveAndLockDataType(scanType: string, type?: string): string {
  if (scanType === "first" || scanType === "unknown_initial") {
    if (!type)
      throw new Error("First Scan bắt buộc phải có kiểu dữ liệu (Data Type)!");
    globalThis.activeScanDataType = type;
    return type;
  }

  if (!globalThis.activeScanDataType)
    throw new Error("Vui lòng First Scan trước!");
  return globalThis.activeScanDataType;
}

function validateExactValue(val?: number | null): asserts val is number {
  if (typeof val !== "number" || Number.isNaN(val)) {
    throw new TypeError("Giá trị quét không hợp lệ hoặc bị bỏ trống!");
  }
}

type SupportedView = Int32Array | Float32Array | Float64Array;

async function processAutoExactScan(
  scanType: string,
  view: SupportedView,
  typeTag: string,
  len: number,
) {
  globalThis.logStatus("🤖 Mắt Thần đang đọc số trên màn hình...", "info");

  // KHÔNG CẦN QUAN TÂM NGƯỜI DÙNG NHẬP GÌ, ÉP BUỘC ĐỌC TỪ BOX
  const autoVal = await globalThis.autoReadScreenValue();

  if (autoVal === null) {
    throw new Error("Không nhận diện được số từ vùng đã khoanh! Hủy quét.");
  }

  globalThis.logStatus(`👁️ Mắt Thần chốt sổ: ${autoVal}`, "success");

  validateExactValue(autoVal);
  await performExactScan(scanType, autoVal, view, typeTag, len);
}

globalThis.executeScan = async function executeScan(
  scanType: string,
  type?: string,
) {
  try {
    const resolvedType = resolveAndLockDataType(scanType, type);
    const view = globalThis.getMemoryView(resolvedType);
    const len = view.length;
    const typeTag = `[${resolvedType.toUpperCase()}]`;

    if (scanType === "first" || scanType === "next") {
      await processAutoExactScan(scanType, view, typeTag, len);
    } else if (scanType === "unknown_initial") {
      globalThis.scanResults = [];
      globalThis.memorySnapshot = view.slice();
      globalThis.logStatus(
        `📸 ${typeTag} Chụp ảnh RAM thành công. Hãy đổi giá trị!`,
        "info",
      );
    } else if (
      scanType === "changed" ||
      scanType === "unchanged" ||
      scanType === "increased" ||
      scanType === "decreased"
    ) {
      await performDifferenceScan(scanType, view, typeTag, len);
    }

    if (typeof globalThis.updateTargetStatus === "function") {
      globalThis.updateTargetStatus(globalThis.scanResults.length);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    globalThis.logStatus(`❌ Lỗi Quét: ${errorMessage}`, "error");
    if (typeof globalThis.updateTargetStatus === "function")
      globalThis.updateTargetStatus(0);
  }
};

globalThis.resetScanSession = function () {
  globalThis.scanResults = [];
  globalThis.memorySnapshot = null;
  globalThis.activeScanDataType = null;
  if (typeof globalThis.updateTargetStatus === "function")
    globalThis.updateTargetStatus(0);
  globalThis.logStatus(`🔄 Đã khởi tạo phiên quét mới!`, "warning");
};

document.addEventListener("WASM_HACKER_SHUTDOWN", () => {
  if (globalThis.scanResults) globalThis.scanResults.length = 0;
  globalThis.memorySnapshot = null;
  globalThis.activeScanDataType = null;
});
