export {};

interface BinaryTemplate {
  label: string;
  width: number;
  height: number;
  pixels: Uint8Array;
}

declare global {
  var wasmMemoryObject: WebAssembly.Memory | null;
  var maxWasmMemorySize: number;
  var scanResults: number[];
  var memorySnapshot: Int32Array | Float32Array | Float64Array | null;
  var activeScanDataType: string | null;
  var freezeInterval: number | null;
  var visionTemplates: Map<string, BinaryTemplate>;
  var visionBox: { x: number; y: number; width: number; height: number } | null;

  var initModMenu: () => void;
  var executeScan: (scanType: string, type?: string) => Promise<void>;
  var getMemoryView: (type: string) => Int32Array | Float32Array | Float64Array;
  var writeValue: (val: number, type: string) => void;
  var startFreeze: (type: string) => boolean;
  var stopFreeze: () => boolean;
  var resetScanSession: () => void;
  var logStatus: (msg: string, type: string) => void;
  var updateTargetStatus: (count: number) => void;
  var BinaryMatcher: {
    binarize: (imageData: ImageData, threshold?: number) => Uint8Array;
    segmentDigits: (
      binaryData: Uint8Array,
      width: number,
      height: number,
    ) => BinaryTemplate[];
    match: (target: BinaryTemplate) => string;
    train: (label: string, template: BinaryTemplate) => void;
  };
  var startScreenSelection: () => Promise<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>;
  var autoReadScreenValue: () => Promise<number | null>;
  var showTrainingUI: (digits: BinaryTemplate[]) => Promise<boolean>;
}
