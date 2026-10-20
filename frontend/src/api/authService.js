import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { auth, firebaseReady } from "./firebase";

function requireAuth() {
  if (!firebaseReady || !auth) {
    const err = new Error("Sign-in is not configured yet. Add the Firebase keys to frontend/.env.");
    err.code = "app/not-configured";
    throw err;
  }
  return auth;
}

/** Normalised result handed to the page. idToken is what your backend verifies. */
async function pack(user, method) {
  const idToken = await user.getIdToken();
  return {
    method,
    idToken,
    user: {
      uid: user.uid,
      name: user.displayName || "",
      email: user.email || "",
      phone: user.phoneNumber || "",
      photo: user.photoURL || "",
    },
  };
}

export async function loginWithGoogle() {
  const a = requireAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const cred = await signInWithPopup(a, provider);
  return pack(cred.user, "google");
}

export async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(requireAuth(), email, password);
  return pack(cred.user, "email");
}

export async function signupWithEmail(name, email, password) {
  const cred = await createUserWithEmailAndPassword(requireAuth(), email, password);
  if (name) await updateProfile(cred.user, { displayName: name });
  return pack(cred.user, "email");
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(requireAuth(), email);
}

/* ---------- Mobile number + OTP ---------- */
let verifier = null;
let confirmation = null;

export function resetRecaptcha() {
  try {
    verifier?.clear();
  } catch {
    /* ignore */
  }
  verifier = null;
}

/** phoneE164 example: "+919876543210". Needs <div id="recaptcha-container" /> on the page. */
export async function sendOtp(phoneE164) {
  const a = requireAuth();
  if (!verifier) verifier = new RecaptchaVerifier(a, "recaptcha-container", { size: "invisible" });
  confirmation = await signInWithPhoneNumber(a, phoneE164, verifier);
}

export async function verifyOtp(code) {
  if (!confirmation) {
    const err = new Error("Please request a new code first.");
    err.code = "app/no-otp";
    throw err;
  }
  const cred = await confirmation.confirm(code);
  return pack(cred.user, "phone");
}

/* ---------- friendly messages ---------- */
const MESSAGES = {
  "auth/invalid-credential": "Wrong email or password.",
  "auth/wrong-password": "Wrong email or password.",
  "auth/user-not-found": "No account found with this email. Try creating one.",
  "auth/email-already-in-use": "An account with this email already exists. Try logging in.",
  "auth/weak-password": "Use at least 6 characters for the password.",
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/popup-closed-by-user": "Google sign-in was cancelled.",
  "auth/cancelled-popup-request": "Google sign-in was cancelled.",
  "auth/popup-blocked": "Your browser blocked the Google pop-up. Allow pop-ups and try again.",
  "auth/invalid-phone-number": "Enter a valid mobile number.",
  "auth/missing-phone-number": "Enter your mobile number.",
  "auth/too-many-requests": "Too many attempts. Please wait a bit and try again.",
  "auth/invalid-verification-code": "That code is wrong. Check it and try again.",
  "auth/code-expired": "That code expired. Request a new one.",
  "auth/captcha-check-failed": "Security check failed. Refresh the page and try again.",
  "auth/network-request-failed": "Network problem. Check your connection.",
  "auth/operation-not-allowed": "This sign-in method isn't enabled in Firebase yet.",
  "auth/unauthorized-domain": "This domain isn't authorised in Firebase. Add it under Authentication > Settings.",
};

export function friendlyError(err) {
  if (err?.code && MESSAGES[err.code]) return MESSAGES[err.code];
  return err?.message || "Something went wrong. Please try again.";
}
