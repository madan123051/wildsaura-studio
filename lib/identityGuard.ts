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
 * Returns true if the user is verified OR has a pending review (already submitted).
 * Returns false only for not_started or rejected status.
 * Fails open (returns true) on network/permission errors to avoid
 * blocking users due to transient Firestore issues.
 *
 * Status flow: not_started → pending → verified | rejected
 * - not_started: user has never submitted → redirect to identity
 * - pending:     user submitted, waiting for admin review → allow through
 * - verified:    admin approved → allow through
 * - rejected:    admin rejected → redirect to identity to resubmit
 */
export async function isIdentityVerified(uid: string): Promise<boolean> {
  try {
    const app = getApp(); // Reuse already-initialized Firebase app
    const firestore = getFirestore(app);
    const snap = await getDoc(doc(firestore, 'users', uid));
    if (!snap.exists()) return false;
    const d = snap.data();
    const status = d?.verificationStatus;
    // Allow verified users and pending users (already submitted, awaiting review)
    return (
      status === 'verified' ||
      status === 'pending' ||
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
