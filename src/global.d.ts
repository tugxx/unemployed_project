export {};

declare global {
  var wasmMemoryObject: WebAssembly.Memory | null;
  var maxWasmMemorySize: number;
  var scanResults: number[];
  var memorySnapshot: Int32Array | Float32Array | Float64Array | null;
  var activeScanDataType: string | null;
  var freezeInterval: number | null;

  var initModMenu: () => void;
  var executeScan: (
    scanType: string,
    val?: number | null,
    type?: string,
  ) => Promise<void>;
  var getMemoryView: (type: string) => Int32Array | Float32Array | Float64Array;
  var writeValue: (val: number, type: string) => void;
  var toggleFreeze: (isFreeze: boolean, val: number, type: string) => boolean;
  var resetScanSession: () => void;
  var logStatus: (msg: string, type: string) => void;
  var updateTargetStatus: (count: number) => void;
}
