import { IOcrEngine } from "./vision/IOcrEngine";
// import { TesseractEngine } from "./TesseractEngine";

export {};

export interface BinaryTemplate {
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
  var currentOcrEngine: IOcrEngine;
  var IS_DEBUG_VISION: boolean;

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
    init: () => Promise<void>;
    binarize: (imageData: ImageData, threshold?: number) => Uint8Array;
    segmentDigits: (
      binaryData: Uint8Array,
      width: number,
      height: number,
    ) => BinaryTemplate[];
    addValidatedDigit: (
      digits: BinaryTemplate[],
      binaryData: Uint8Array,
      width: number,
      height: number,
      startX: number,
      endX: number,
    ) => void;
    match: (target: BinaryTemplate) => string;
    train: (label: string, template: BinaryTemplate) => void;
    recognize: (imageData: ImageData) => Promise<number | null>;
    ensureTrained: (digits: BinaryTemplate[]) => Promise<boolean>;
  };
  var startScreenSelection: () => Promise<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>;
  var autoReadScreenValue: () => Promise<number | null>;
  var showTrainingUI: (
    digits: BinaryTemplate[],
    guesses: string[],
  ) => Promise<boolean>;
}
