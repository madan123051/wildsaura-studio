import { db } from './firebase';
import {
  ref,
  push,
  set,
  get,
  query,
  orderByChild,
  limitToLast,
  remove,
} from 'firebase/database';

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

export async function saveConversion(record: ConversionRecord): Promise<string | null> {
  const conversionsRef = ref(db, `conversions/${record.userId}`);
  const newRef = push(conversionsRef);
  const { id, ...data } = record;
  await set(newRef, data);
  return newRef.key;
}

export async function getUserConversions(
  userId: string,
  limit: number = 50
): Promise<ConversionRecord[]> {
  const conversionsRef = ref(db, `conversions/${userId}`);
  const q = query(conversionsRef, orderByChild('createdAt'), limitToLast(limit));
  const snapshot = await get(q);

  if (!snapshot.exists()) return [];

  const records: ConversionRecord[] = [];
  snapshot.forEach((child) => {
    records.push({ id: child.key!, ...child.val() });
  });

  // Reverse so newest first
  return records.reverse();
}

export async function deleteConversion(
  userId: string,
  conversionId: string
): Promise<void> {
  const conversionRef = ref(db, `conversions/${userId}/${conversionId}`);
  await remove(conversionRef);
}

export async function getUserStats(
  userId: string
): Promise<{ totalImages: number; totalSaved: number }> {
  const conversionsRef = ref(db, `conversions/${userId}`);
  const snapshot = await get(conversionsRef);

  if (!snapshot.exists()) return { totalImages: 0, totalSaved: 0 };

  let totalImages = 0;
  let totalSaved = 0;

  snapshot.forEach((child) => {
    const record = child.val() as ConversionRecord;
    totalImages++;
    totalSaved += record.originalSize - record.processedSize;
  });

  return { totalImages, totalSaved };
}

export async function saveUserSettings(
  userId: string,
  settings: Record<string, unknown>
): Promise<void> {
  const settingsRef = ref(db, `settings/${userId}`);
  await set(settingsRef, settings);
}

export async function getUserSettings(
  userId: string
): Promise<Record<string, unknown> | null> {
  const settingsRef = ref(db, `settings/${userId}`);
  const snapshot = await get(settingsRef);

  if (!snapshot.exists()) return null;
  return snapshot.val();
}
