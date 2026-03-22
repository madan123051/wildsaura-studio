import { storage } from './firebase';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';

export async function uploadProcessedImage(
  userId: string,
  blob: Blob,
  fileName: string
): Promise<string> {
  const timestamp = Date.now();
  const storageRef = ref(storage, `processed/${userId}/${timestamp}_${fileName}`);
  await uploadBytes(storageRef, blob);
  const downloadURL = await getDownloadURL(storageRef);
  return downloadURL;
}

export async function uploadThumbnail(
  userId: string,
  blob: Blob,
  fileName: string
): Promise<string> {
  const timestamp = Date.now();
  const storageRef = ref(storage, `thumbnails/${userId}/${timestamp}_${fileName}`);
  await uploadBytes(storageRef, blob);
  const downloadURL = await getDownloadURL(storageRef);
  return downloadURL;
}

export async function deleteStorageFile(path: string): Promise<void> {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error) {
    console.warn('Failed to delete storage file:', path, error);
  }
}
