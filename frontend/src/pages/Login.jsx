import { useNavigate } from "react-router-dom";
import AuthPage from "../components/AuthPage";
import { auth } from "../api/client.js";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function Login({ mode = "login" }) {
  const navigate = useNavigate();

  // Email + password: your existing backend
 async function handleEmail({ mode, name, email, password }) {
  try {
    const { token } =
      mode === "signup"
        ? await auth.register({ name, email, password })
        : await auth.login({ email, password });
    localStorage.setItem("aeqdf_token", token);
  } catch (err) {
    console.error("Auth error:", err.response?.status, err.response?.data, err.message);
    throw new Error(
      err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        (mode === "signup" ? "Sign up failed" : "Login failed")
    );
  }
  navigate("/scan");
}

  // Google / Mobile: connects through Firebase
  async function handleFirebase({ idToken }) {
    const res = await fetch(`${API}/api/auth/firebase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Sign-in failed. Please try again.");
    localStorage.setItem("aeqdf_token", data.token);
    navigate("/scan");
  }

  return <AuthPage defaultMode={mode} onEmailSubmit={handleEmail} onAuthenticated={handleFirebase} />;
}