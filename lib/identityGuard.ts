// =====================================================================
// WILDSAURA STUDIO — Identity Guard
// Checks WildSaura Identity verification status for logged-in users.
// If not verified, redirects to identity.wildsaura.com/verify with
// a ?return= param so the user is sent back after completing verification.
//
// Note: This file uses Firestore (not RTDB) because user verification
// records are stored in the shared wildsaura-1ef8a Firestore project.
// The existing RTDB db export in lib/firebase.ts is unchanged.
// =====================================================================
import { getApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

export const IDENTITY_VERIFY_URL = 'https://identity.wildsaura.com';

/**
 * Check Firestore users/{uid} for verification status.
 * Returns true if verified, false otherwise.
 * Fails open (returns true) on network/permission errors to avoid
 * blocking users due to transient Firestore issues.
 */
export async function isIdentityVerified(uid: string): Promise<boolean> {
  try {
    const app = getApp(); // Reuse already-initialized Firebase app
    const firestore = getFirestore(app);
    const snap = await getDoc(doc(firestore, 'users', uid));
    if (!snap.exists()) return false;
    const d = snap.data();
    return (
      d?.verificationStatus === 'verified' ||
      d?.verified === true ||
      d?.isVerified === true
    );
  } catch {
    return true; // Fail-open
  }
}

/**
 * Redirect to identity.wildsaura.com/verify with a ?return= param
 * pointing back to the current page.
 */
export function redirectToIdentityVerify(): void {
  const returnUrl = encodeURIComponent(window.location.href);
  window.location.href = `${IDENTITY_VERIFY_URL}/verify?return=${returnUrl}`;
}
