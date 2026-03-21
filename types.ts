export interface ImageFile {
  id: string;
  file: File;
  name: string;
  originalUrl: string;
  processedUrl: string | null;
  processedBlob: Blob | null;
  width: number;
  height: number;
  status: 'pending' | 'processing' | 'done' | 'error';
  sizeBefore: number;
  sizeAfter: number | null;
}

export interface LUTPreset {
  id: string;
  name: string;
  description: string;
  gradient: string;
  adjust: ColorAdjustment;
}

export interface ColorAdjustment {
  brightness?: number;      // -100 to 100
  contrast?: number;        // -100 to 100
  saturation?: number;      // -100 to 100
  temperature?: number;     // -100 (cool) to 100 (warm)
  tint?: number;            // -100 (green) to 100 (magenta)
  shadows?: [number, number, number];  // RGB lift
  midtones?: [number, number, number]; // RGB gamma
  highlights?: [number, number, number]; // RGB gain
  fadeBlacks?: number;      // 0 to 100 - lift black point
  crushShadows?: number;    // 0 to 100 - darken shadows
  grain?: number;           // 0 to 100
  vignette?: number;        // 0 to 100
}

export interface ConversionSettings {
  quality: number;
  lossless: boolean;
  resizeTo4K: boolean;
  preserveMetadata: boolean;
  autoConvert: boolean;
  smartNaming: boolean;
}

export interface CubeLUT {
  title: string;
  size: number;
  data: Float32Array;
}

export type ActiveLUT = {
  type: 'preset';
  presetId: string;
} | {
  type: 'cube';
  lut: CubeLUT;
  name: string;
} | null;
