import { useEffect, useRef, useState } from "react";
import { QRCube, Stage, Tilt } from "./Stage3D";
import {
  friendlyError,
  loginWithEmail,
  loginWithGoogle,
  resetPassword,
  resetRecaptcha,
  sendOtp,
  signupWithEmail,
  verifyOtp,
} from "../api/authService";
import "./AuthPage.css";

const COUNTRIES = [
  { code: "+91", label: "IN +91" },
  { code: "+1", label: "US +1" },
  { code: "+44", label: "UK +44" },
  { code: "+61", label: "AU +61" },
  { code: "+971", label: "AE +971" },
  { code: "+65", label: "SG +65" },
  { code: "+977", label: "NP +977" },
  { code: "+880", label: "BD +880" },
  { code: "+92", label: "PK +92" },
  { code: "+94", label: "LK +94" },
];

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3a7.2 7.2 0 0 1-10.7-3.78H1.4v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.36 14.31a7.2 7.2 0 0 1 0-4.62v-3.1H1.4a12 12 0 0 0 0 10.82l3.96-3.1z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.58 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.4 6.59l3.96 3.1A7.2 7.2 0 0 1 12 4.75z" />
    </svg>
  );
}

function OtpInput({ digits, onChange, disabled }) {
  const refs = useRef([]);
  const setAt = (i, v) => {
    const next = [...digits];
    next[i] = v;
    onChange(next);
  };
  const handleChange = (i, e) => {
    const v = e.target.value.replace(/\D/g, "").slice(-1);
    setAt(i, v);
    if (v && i < 5) refs.current[i + 1]?.focus();
  };
  const handleKey = (i, e) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };
  const handlePaste = (e) => {
    const t = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!t) return;
    e.preventDefault();
    onChange(Array.from({ length: 6 }, (_, k) => t[k] || ""));
    refs.current[Math.min(t.length, 5)]?.focus();
  };
  return (
    <div className="otp" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          value={d}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}

/**
 * Props:
 *   defaultMode      "login" | "signup"  (email form)
 *   onAuthenticated  async ({ method, idToken, user }) => void   (Google / Mobile via Firebase)
 *                    Send idToken to your backend here. Throw an Error to show a message.
 *   onEmailSubmit    async ({ mode, name, email, password }) => void   (optional)
 *                    When given, Email login/signup uses YOUR backend instead of Firebase.
 */
export default function AuthPage({ defaultMode = "login", onAuthenticated, onEmailSubmit }) {
  const [method, setMethod] = useState("email"); // "email" | "phone"
  const [mode, setMode] = useState(defaultMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // email
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  // phone
  const [cc, setCc] = useState("+91");
  const [number, setNumber] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [digits, setDigits] = useState(Array(6).fill(""));
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => setMode(defaultMode), [defaultMode]);
  useEffect(() => () => resetRecaptcha(), []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const clearMsgs = () => {
    setError("");
    setInfo("");
  };

  async function run(fn) {
    clearMsgs();
    setBusy(true);
    try {
      const session = await fn();
      if (session) await onAuthenticated?.(session);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  const submitEmail = (e) => {
    e.preventDefault();
    run(async () => {
      // If the page supplies its own email handler (your existing backend), use it instead of Firebase.
      if (onEmailSubmit) {
        await onEmailSubmit({ mode, name: name.trim(), email: email.trim(), password });
        return null;
      }
      return mode === "signup"
        ? signupWithEmail(name.trim(), email.trim(), password)
        : loginWithEmail(email.trim(), password);
    });
  };

  async function forgot() {
    clearMsgs();
    if (!email.trim()) return setError("Type your email above first, then tap Forgot password.");
    try {
      await resetPassword(email.trim());
      setInfo("Password reset link sent. Check your inbox.");
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  async function requestOtp(e) {
    e?.preventDefault();
    clearMsgs();
    const clean = number.replace(/\D/g, "");
    if (clean.length < 6 || clean.length > 14) return setError("Enter a valid mobile number.");
    setBusy(true);
    try {
      await sendOtp(`${cc}${clean}`);
      setOtpSent(true);
      setDigits(Array(6).fill(""));
      setCooldown(30);
      setInfo(`Code sent to ${cc} ${clean}`);
    } catch (err) {
      resetRecaptcha();
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  const submitOtp = (e) => {
    e.preventDefault();
    const code = digits.join("");
    if (code.length < 6) return setError("Enter the 6-digit code.");
    run(() => verifyOtp(code));
  };

  const changeNumber = () => {
    resetRecaptcha();
    setOtpSent(false);
    setDigits(Array(6).fill(""));
    clearMsgs();
  };

  const isSignup = mode === "signup";

  return (
    <Stage>
      <div className="auth">
        <Tilt className="auth__card" max={4}>
          <div className="auth__brand">
            <QRCube size={60} />
            <h1>{isSignup ? "Create your account" : "Welcome back"}</h1>
            <p>Sign in to save your scans and see your dashboard.</p>
          </div>

          <button type="button" className="auth__google" onClick={() => run(loginWithGoogle)} disabled={busy}>
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="auth__or"><span>or use</span></div>

          <div className="seg" data-active={method} role="tablist" aria-label="Sign-in method">
            <span className="seg__thumb" aria-hidden="true" />
            <button type="button" role="tab" aria-selected={method === "email"} onClick={() => { setMethod("email"); clearMsgs(); }}>
              Email
            </button>
            <button type="button" role="tab" aria-selected={method === "phone"} onClick={() => { setMethod("phone"); clearMsgs(); }}>
              Mobile number
            </button>
          </div>

          {method === "email" ? (
            <form onSubmit={submitEmail} className="auth__form" noValidate>
              {isSignup && (
                <label className="field">
                  <span>Name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
                </label>
              )}
              <label className="field">
                <span>Email</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
              </label>
              <label className="field">
                <span>Password</span>
                <div className="pw">
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    required
                  />
                  <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "Hide password" : "Show password"}>
                    {showPw ? "Hide" : "Show"}
                  </button>
                </div>
              </label>
              {!isSignup && !onEmailSubmit && (
                <div className="auth__row">
                  <button type="button" className="linkbtn" onClick={forgot}>Forgot password?</button>
                </div>
              )}
              <button type="submit" className="u-btn u-btn--primary auth__submit" disabled={busy}>
                {busy ? <span className="u-spin" /> : isSignup ? "Create account" : "Log in"}
              </button>
              <p className="auth__switch">
                {isSignup ? "Already have an account? " : "New to AEQDF? "}
                <button type="button" className="linkbtn" onClick={() => { setMode(isSignup ? "login" : "signup"); clearMsgs(); }}>
                  {isSignup ? "Log in" : "Create an account"}
                </button>
              </p>
            </form>
          ) : !otpSent ? (
            <form onSubmit={requestOtp} className="auth__form" noValidate>
              <label className="field">
                <span>Mobile number</span>
                <div className="phone">
                  <select value={cc} onChange={(e) => setCc(e.target.value)} aria-label="Country code">
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={number}
                    onChange={(e) => setNumber(e.target.value.replace(/[^\d\s]/g, ""))}
                    placeholder="98765 43210"
                    autoComplete="tel-national"
                  />
                </div>
              </label>
              <button type="submit" className="u-btn u-btn--primary auth__submit" disabled={busy}>
                {busy ? <span className="u-spin" /> : "Send code"}
              </button>
              <p className="auth__hint">We'll text you a 6-digit code. Message rates may apply.</p>
            </form>
          ) : (
            <form onSubmit={submitOtp} className="auth__form" noValidate>
              <span className="field__label">Enter the 6-digit code</span>
              <OtpInput digits={digits} onChange={setDigits} disabled={busy} />
              <button type="submit" className="u-btn u-btn--primary auth__submit" disabled={busy}>
                {busy ? <span className="u-spin" /> : "Verify and continue"}
              </button>
              <div className="auth__row auth__row--split">
                <button type="button" className="linkbtn" onClick={changeNumber}>Change number</button>
                <button type="button" className="linkbtn" onClick={requestOtp} disabled={cooldown > 0 || busy}>
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </button>
              </div>
            </form>
          )}

          {error && <p className="auth__msg auth__msg--err" role="alert">{error}</p>}
          {info && !error && <p className="auth__msg auth__msg--ok" role="status">{info}</p>}

          {/* invisible reCAPTCHA mounts here for phone sign-in */}
          <div id="recaptcha-container" />
        </Tilt>
      </div>
    </Stage>
  );
}
