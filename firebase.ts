import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithCredential, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendEmailVerification, sendPasswordResetEmail, fetchSignInMethodsForEmail } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer, collection, query, where, getDocs, onSnapshot, setDoc, updateDoc, deleteDoc, addDoc, Timestamp } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import firebaseConfig from './firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
// Initialize Firebase Analytics safely
let analyticsInstance = null;
if (typeof window !== 'undefined') {
  try {
    analyticsInstance = getAnalytics(app);
  } catch (e) {
    console.warn('Firebase Analytics failed to initialize. This is common in some restricted browser environments.', e);
  }
}
export const analytics = analyticsInstance;

// Use initializeFirestore with long-polling to bypass potential WebSocket issues in restricted environments
// If firestoreDatabaseId is empty, it will default to "(default)"
export const db = firebaseConfig.firestoreDatabaseId 
  ? initializeFirestore(app, { experimentalForceLongPolling: true, ignoreUndefinedProperties: true }, firebaseConfig.firestoreDatabaseId)
  : initializeFirestore(app, { experimentalForceLongPolling: true, ignoreUndefinedProperties: true });

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Connection to Firestore
async function testConnection() {
  try {
    // Attempt a simple read to check connectivity
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful.");
  } catch (error: any) {
    console.error("Firestore Connection Test Error:", {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    
    if(error.message?.includes('the client is offline') || error.code === 'unavailable') {
      console.error("Firestore connection failed. This might be due to network restrictions, an unprovisioned database, or incorrect configuration.");
    } else if (error.code === 'permission-denied') {
      console.warn("Firestore connection reached but permission was denied. This is expected if rules are set up and you are not logged in.");
    }
  }
}
testConnection();

// Check for redirect result on web platform initialization
if (!Capacitor.isNativePlatform() && typeof window !== 'undefined') {
  getRedirectResult(auth).catch((err) => {
    console.warn("Redirect result check:", err);
  });
}

export const loginWithGoogle = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await FirebaseAuthentication.signInWithGoogle();
      
      const idToken = result.credential?.idToken;
      if (idToken) {
        const credential = GoogleAuthProvider.credential(idToken);
        const userCred = await signInWithCredential(auth, credential);
        return userCred.user;
      } else if (auth.currentUser) {
        return auth.currentUser;
      }
      return null;
    } catch (nativeErr: any) {
      console.error('Native Google Sign-In error:', nativeErr);

      if (
        nativeErr?.message?.toLowerCase().includes('cancel') ||
        nativeErr?.code === '12501' ||
        nativeErr === 'USER_CANCELLED' ||
        nativeErr?.message?.includes('12501')
      ) {
        console.warn('User canceled native Google Sign-In.');
        return null;
      }

      // DO NOT fall back to signInWithPopup on native platform.
      // Browser-based auth in native webviews loses initial state and fails with 'missing initial state'.
      let errMsg = nativeErr?.message || 'Native Google Sign-In failed.';
      if (nativeErr?.code === '10' || nativeErr?.message?.includes('10') || nativeErr?.message?.toLowerCase().includes('developer_error')) {
        errMsg = 'Google Sign-In Developer Error (Code 10): Firebase Console me Android App (com.jaislinc.billmax) ka SHA-1 Key missing hai. Firebase Console me SHA-1 Key add karke naya google-services.json download karein.';
      }
      throw new Error(errMsg);
    }
  }

  // Web platform only (not native Android/iOS):
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      console.warn('Authentication popup was closed by the user.');
      return null;
    }

    if (error.code === 'auth/popup-blocked' || error.message?.includes('missing initial state')) {
      console.warn('Popup blocked or missing initial state, attempting redirect flow...');
      await signInWithRedirect(auth, googleProvider);
      return null;
    }

    console.error('Login Error:', error);
    throw error;
  }
};

export const sendUserVerificationEmail = async (user: any) => {
  if (!user) return;
  // Primary: Native Firebase Auth Email Verification
  await sendEmailVerification(user);

  // Secondary: Brevo API Integration if BREVO_API_KEY is configured on server
  try {
    await fetch('/api/brevo/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toEmail: user.email,
        toName: user.displayName || user.email,
        subject: 'Verify your BillMax Account Email',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
            <div style="text-align: center; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9;">
              <h1 style="color: #0f172a; font-size: 24px; margin: 0;">BillMax by Jaislinc</h1>
            </div>
            <div style="padding: 24px 0;">
              <h2 style="color: #1e293b; font-size: 18px; margin-top: 0;">Welcome, ${user.displayName || 'Valued User'}!</h2>
              <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                Thank you for creating an account on BillMax. A verification link has been sent to your email address by Firebase Security.
              </p>
              <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                Please check your inbox (and spam/junk folder) for the verification link to complete your registration and log in.
              </p>
            </div>
            <div style="text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px;">
              © ${new Date().getFullYear()} BillMax. All rights reserved.
            </div>
          </div>
        `
      })
    });
  } catch (e) {
    console.warn('Brevo secondary email delivery skipped or error:', e);
  }
};

export const signUpWithEmail = async (email: string, pass: string, name?: string) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  if (userCredential.user && name) {
    try {
      await updateProfile(userCredential.user, { displayName: name.trim() });
    } catch (e) {
      console.warn('Could not update profile name:', e);
    }
  }
  return userCredential.user;
};

export const loginWithEmail = async (email: string, pass: string) => {
  const userCredential = await signInWithEmailAndPassword(auth, email.trim(), pass);
  return userCredential.user;
};

export const logout = async () => {
  try {
    if (Capacitor.isNativePlatform()) {
      try {
        await FirebaseAuthentication.signOut();
      } catch (e) {
        console.warn('Native signOut error:', e);
      }
    }
    localStorage.clear(); // Clear all local state on logout
    await signOut(auth);
    window.location.reload(); // Hard reload to ensure fresh state
  } catch (error) {
    console.error('Logout Error:', error);
    throw error;
  }
};

export const resetPasswordForEmail = async (email: string) => {
  await sendPasswordResetEmail(auth, email.trim());
};

export const checkSignInMethods = async (email: string) => {
  try {
    return await fetchSignInMethodsForEmail(auth, email.trim());
  } catch (e) {
    console.warn('Error fetching sign in methods:', e);
    return [];
  }
};
