// === EXISTING TYPES (keep exactly) ===
export interface ColorAdjustment {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  temperature?: number;
  tint?: number;
  shadows?: [number, number, number];
  midtones?: [number, number, number];
  highlights?: [number, number, number];
  fadeBlacks?: number;
  crushShadows?: number;
  grain?: number;
}

export interface LUTPreset {
  id: string;
  name: string;
  description: string;
  gradient: string;
  adjust: ColorAdjustment;
}

export interface CubeLUT {
  title: string;
  size: number;
  data: Float32Array;
}

export type ActiveLUT =
  | { type: 'preset'; presetId: string }
  | { type: 'cube'; lut: CubeLUT; name: string }
  | null;

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

export interface ConversionSettings {
  quality: number;
  lossless: boolean;
  resizeTo4K: boolean;
  preserveMetadata: boolean;
  autoConvert: boolean;
  smartNaming: boolean;
}

// === NEW TYPES ===
export type AppTab = 'catalog' | 'presets' | 'edit';

export interface ConversionRecord {
  id?: string;
  userId: string;
  fileName: string;
  originalSize: number;
  processedSize: number;
  width: number;
  height: number;
  preset: string;
  intensity: number;
  quality: number;
  savedPercentage: number;
  thumbnailUrl?: string;
  downloadUrl?: string;
  createdAt: number;
}

export interface UserStats {
  totalImages: number;
  totalSaved: number;
}
