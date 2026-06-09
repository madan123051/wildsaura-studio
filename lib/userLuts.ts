// ============================================================
// WildSaura Pro Studio — User LUT Cloud Storage
// Persists custom .cube LUT files per user to Firebase Storage
// + metadata in RTDB so they're available across sessions.
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

export interface UserLUTRecord {
  id?: string;
  name: string;
  fileName: string;
  storagePath: string;
  downloadUrl: string;
  lutSize: number;   // e.g. 33 (the LUT_3D_SIZE)
  fileSize: number;  // bytes of the .cube file
  createdAt: number;
}

/**
 * Upload a .cube file to Firebase Storage and save metadata to RTDB.
 */
export async function saveUserLut(
  userId: string,
  file: File,
  name: string,
  lutSize: number,
): Promise<UserLUTRecord> {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `luts/${userId}/${timestamp}_${safeName}`;
  const sRef = storageRef(storage, path);

  const buffer = await file.arrayBuffer();
  await uploadBytes(sRef, new Uint8Array(buffer), { contentType: 'text/plain' });
  const downloadUrl = await getDownloadURL(sRef);

  const record: UserLUTRecord = {
    name,
    fileName: safeName,
    storagePath: path,
    downloadUrl,
    lutSize,
    fileSize: file.size,
    createdAt: timestamp,
  };

  const lutsRef = ref(db, `luts/${userId}`);
  const newRef = push(lutsRef);
  await set(newRef, record);
  record.id = newRef.key!;

  return record;
}

/**
 * Fetch all saved LUT records for a user (newest first).
 */
export async function getUserLuts(userId: string): Promise<UserLUTRecord[]> {
  const lutsRef = ref(db, `luts/${userId}`);
  const snapshot = await get(lutsRef);
  if (!snapshot.exists()) return [];

  const records: UserLUTRecord[] = [];
  snapshot.forEach((child) => {
    records.push({ id: child.key!, ...child.val() });
  });

  return records.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Delete a user's LUT from Storage + RTDB.
 */
export async function deleteUserLut(userId: string, lut: UserLUTRecord): Promise<void> {
  try {
    const sRef = storageRef(storage, lut.storagePath);
    await deleteObject(sRef);
  } catch (e) {
    console.warn('Failed to delete LUT from storage:', e);
  }

  if (lut.id) {
    const lutRef = ref(db, `luts/${userId}/${lut.id}`);
    await remove(lutRef);
  }
}

/**
 * Fetch the raw text content of a .cube file from its download URL,
 * for use with parseCubeFile().
 */
export async function fetchLutText(downloadUrl: string): Promise<string> {
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`Failed to fetch LUT: ${res.status}`);
  return res.text();
}
