globalThis.wasmMemoryObject = null;
globalThis.maxWasmMemorySize = 0;
globalThis.maxWasmMemorySize = globalThis.maxWasmMemorySize || 0;

(function patchUnityKeyboardHijack() {
  const original = EventTarget.prototype.addEventListener;

  EventTarget.prototype.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) {
    if (
      (type === "keydown" ||
        type === "keyup" ||
        type === "keypress" ||
        type === "wheel" ||
        type === "mousedown") &&
      (this === globalThis || this === document)
    ) {
      const wrappedListener = (e: Event) => {
        const target = (e as KeyboardEvent).target as Element | null;
        // Nếu đang focus vào UI của mình thì bỏ qua, không cho Unity chạy
        if (target?.closest("#wasm-ce-ui")) return;
        if (typeof listener === "function") listener.call(this, e);
        else listener.handleEvent(e);
      };
      return original.call(this, type, wrappedListener, options);
    }
    return original.call(this, type, listener, options);
  };
})();

function lockTargetMemory(memory: WebAssembly.Memory, size: number) {
  globalThis.wasmMemoryObject = memory;
  globalThis.maxWasmMemorySize = size;

  const sizeMB = (size / (1024 * 1024)).toFixed(1);
  console.log(`[CORE] Đã khóa mục tiêu RAM: ${sizeMB} MB`);

  if (typeof globalThis.initModMenu === "function") {
    globalThis.initModMenu();

    if (typeof globalThis.logStatus === "function") {
      globalThis.logStatus("🔥 Bắt RAM thành công! Sẵn sàng quét.", "success");
    }
  }
}

function extractMemory(
  result:
    | { module: WebAssembly.Module; instance: WebAssembly.Instance }
    | WebAssembly.Instance,
) {
  try {
    const instance = "instance" in result ? result.instance : result;

    for (const key in instance.exports) {
      const exportedItem = instance.exports[key];

      if (!(exportedItem instanceof WebAssembly.Memory)) continue;

      const currentSize = exportedItem.buffer.byteLength;

      if (currentSize <= globalThis.maxWasmMemorySize) continue;

      lockTargetMemory(exportedItem, currentSize);
    }
  } catch (error) {
    console.error("Lỗi khi trích xuất RAM:", error);
  }
}

// Bịt 3 cửa API của WASM
const originalInstantiateStreaming = WebAssembly.instantiateStreaming;
if (originalInstantiateStreaming) {
  WebAssembly.instantiateStreaming = async function (req, importObject) {
    const result = await originalInstantiateStreaming(req, importObject);
    extractMemory(result);
    return result;
  };
}

const originalInstantiate = WebAssembly.instantiate;
WebAssembly.instantiate = async function (
  buffer: BufferSource | WebAssembly.Module,
  importObject?: WebAssembly.Imports,
) {
  const result = await originalInstantiate(buffer, importObject);
  extractMemory(result);
  return result;
} as typeof WebAssembly.instantiate;

const OriginalInstance = WebAssembly.Instance;
WebAssembly.Instance = function (
  module: WebAssembly.Module,
  importObject?: WebAssembly.Imports,
) {
  const instance = new OriginalInstance(module, importObject);
  extractMemory(instance);
  return instance;
} as unknown as typeof WebAssembly.Instance;

document.addEventListener("WASM_HACKER_SHUTDOWN", () => {
  globalThis.wasmMemoryObject = null;
  globalThis.maxWasmMemorySize = 0;
});
