// ============================================================
// WildSaura Pro Studio — 24-Hour Edit History (Firebase)
// Saves edited images to Firebase Storage for 24 hours,
// then auto-deletes on next app load.
// ============================================================

import { db, storage } from './firebase';
import {
  ref,
  push,
  set,
  get,
  remove,
} from 'firebase/database';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';

export interface EditRecord {
  id?: string;
  fileName: string;
  downloadUrl: string;
  storagePath: string;
  width: number;
  height: number;
  fileSize: number;
  preset: string;
  createdAt: number;
  expiresAt: number;
}

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

/**
 * Save an edited image to Firebase Storage + metadata to RTDB.
 * The image will be available for 24 hours.
 */
export async function saveEdit(
  userId: string,
  blob: Blob,
  fileName: string,
  width: number,
  height: number,
  preset: string,
): Promise<EditRecord> {
  const timestamp = Date.now();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `edits/${userId}/${timestamp}_${safeName}`;
  const sRef = storageRef(storage, path);

  await uploadBytes(sRef, blob);
  const downloadUrl = await getDownloadURL(sRef);

  const record: EditRecord = {
    fileName: safeName,
    downloadUrl,
    storagePath: path,
    width,
    height,
    fileSize: blob.size,
    preset,
    createdAt: timestamp,
    expiresAt: timestamp + TWENTY_FOUR_HOURS,
  };

  const editsRef = ref(db, `edits/${userId}`);
  const newRef = push(editsRef);
  await set(newRef, record);
  record.id = newRef.key!;

  return record;
}

/**
 * Fetch all saved edits for a user (newest first).
 */
export async function getUserEdits(userId: string): Promise<EditRecord[]> {
  const editsRef = ref(db, `edits/${userId}`);
  const snapshot = await get(editsRef);
  if (!snapshot.exists()) return [];

  const records: EditRecord[] = [];
  snapshot.forEach((child) => {
    records.push({ id: child.key!, ...child.val() });
  });

  return records.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Delete a single edit (storage file + RTDB entry).
 */
export async function deleteEdit(userId: string, edit: EditRecord): Promise<void> {
  // Delete from Firebase Storage
  try {
    const sRef = storageRef(storage, edit.storagePath);
    await deleteObject(sRef);
  } catch (e) {
    console.warn('Failed to delete storage file:', edit.storagePath, e);
  }

  // Delete from Realtime Database
  if (edit.id) {
    const editRef = ref(db, `edits/${userId}/${edit.id}`);
    await remove(editRef);
  }
}

/**
 * Clean up all expired edits (older than 24 hours).
 * Call this on app load.
 * Returns the number of deleted records.
 */
export async function cleanupExpiredEdits(userId: string): Promise<number> {
  const edits = await getUserEdits(userId);
  const now = Date.now();
  let deleted = 0;

  for (const edit of edits) {
    if (edit.expiresAt <= now) {
      await deleteEdit(userId, edit);
      deleted++;
    }
  }

  return deleted;
}

/**
 * Returns remaining time string like "23h 45m" or "Expired".
 */
export function getTimeRemaining(expiresAt: number): string {
  const now = Date.now();
  const diff = expiresAt - now;
  if (diff <= 0) return 'Expired';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
