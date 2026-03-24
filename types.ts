// ============================================================
// WildSaura Pro Studio — Type Definitions
// ============================================================

// === EXISTING TYPES ===

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

// === NEW TYPES — Pro Studio Edit Engine ===

export interface EditAdjustments {
  // Light
  exposure: number;    // -100 to 100
  contrast: number;    // -100 to 100
  highlights: number;  // -100 to 100
  shadows: number;     // -100 to 100
  whites: number;      // -100 to 100
  blacks: number;      // -100 to 100
  // Color
  temperature: number; // -100 to 100
  tint: number;        // -100 to 100
  vibrance: number;    // -100 to 100
  saturation: number;  // -100 to 100
  // Details
  clarity: number;     // 0 to 100
  sharpness: number;   // 0 to 100
  denoise: number;     // 0 to 100
  // Creative
  vignette: number;    // 0 to 100
  grain: number;       // 0 to 100
  fog: number;         // 0 to 100
}

export interface HSLAdjustment {
  hue: number;        // -180 to 180
  saturation: number; // -100 to 100
  luminance: number;  // -100 to 100
}

export interface HSLState {
  red: HSLAdjustment;
  orange: HSLAdjustment;
  yellow: HSLAdjustment;
  green: HSLAdjustment;
  cyan: HSLAdjustment;
  blue: HSLAdjustment;
  purple: HSLAdjustment;
  magenta: HSLAdjustment;
}

export const DEFAULT_ADJUSTMENTS: EditAdjustments = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  temperature: 0,
  tint: 0,
  vibrance: 0,
  saturation: 0,
  clarity: 0,
  sharpness: 0,
  denoise: 0,
  vignette: 0,
  grain: 0,
  fog: 0,
};

export const DEFAULT_HSL_ADJUSTMENT: HSLAdjustment = {
  hue: 0,
  saturation: 0,
  luminance: 0,
};

export const DEFAULT_HSL_STATE: HSLState = {
  red: { ...DEFAULT_HSL_ADJUSTMENT },
  orange: { ...DEFAULT_HSL_ADJUSTMENT },
  yellow: { ...DEFAULT_HSL_ADJUSTMENT },
  green: { ...DEFAULT_HSL_ADJUSTMENT },
  cyan: { ...DEFAULT_HSL_ADJUSTMENT },
  blue: { ...DEFAULT_HSL_ADJUSTMENT },
  purple: { ...DEFAULT_HSL_ADJUSTMENT },
  magenta: { ...DEFAULT_HSL_ADJUSTMENT },
};

export type CropAspect = 'free' | '1:1' | '4:3' | '3:2' | '16:9' | '9:16' | '5:4';

export interface CropRect {
  x: number;      // 0-1 percentage from left
  y: number;      // 0-1 percentage from top
  width: number;  // 0-1 percentage width
  height: number; // 0-1 percentage height
}

export interface CropState {
  rect: CropRect;
  aspect: CropAspect;
  isActive: boolean;
}

export const DEFAULT_CROP_RECT: CropRect = { x: 0, y: 0, width: 1, height: 1 };
export const DEFAULT_CROP_STATE: CropState = { rect: { ...DEFAULT_CROP_RECT }, aspect: 'free', isActive: false };
