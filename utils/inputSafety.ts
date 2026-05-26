export const SUPPORTED_RAW_EXTENSIONS = new Set(['cr2', 'cr3', 'nef', 'arw', 'dng', 'raf']);
const SUPPORTED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'tif', 'tiff', 'webp', 'bmp', ...SUPPORTED_RAW_EXTENSIONS]);

export const PRESET_ID_FALLBACK = 'wildsaura_look';

export function normalizePresetId(value: string | null | undefined): string {
  if (typeof value !== 'string') return PRESET_ID_FALLBACK;
  const cleaned = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || PRESET_ID_FALLBACK;
}

export function sanitizeFileName(fileName: string | null | undefined): string {
  const safeName = (fileName || 'image.jpg').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const [namePart, ...rest] = safeName.split('.');
  const extRaw = rest.length ? rest.pop() as string : 'jpg';
  const ext = (extRaw || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const base = (namePart || 'image')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'image';
  return `${base}.${ext || 'jpg'}`;
}

export function isSupportedImageFile(file: File): { ok: boolean; reason?: string } {
  const name = sanitizeFileName(file?.name);
  const ext = name.includes('.') ? name.split('.').pop() || '' : '';
  const mime = (file?.type || '').toLowerCase();
  const mimeOk = mime.startsWith('image/');
  const extOk = SUPPORTED_IMAGE_EXTENSIONS.has(ext);
  if (!extOk && !mimeOk) return { ok: false, reason: 'unsupported_type' };
  if (!extOk) return { ok: false, reason: 'unsupported_extension' };
  return { ok: true };
}

export function safeJsonParse<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}
