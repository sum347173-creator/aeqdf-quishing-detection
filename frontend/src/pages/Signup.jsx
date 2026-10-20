import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth } from "../api/client.js";

export default function Signup() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token } = await auth.register(form);
      localStorage.setItem("aeqdf_token", token);
      navigate("/scan");
    } catch (err) {
      setError(err.response?.data?.error || "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-12">
      <h2 className="text-xl font-semibold mb-4">Create an account</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input className="w-full border rounded px-3 py-2" placeholder="Name"
               value={form.name} onChange={update("name")} required />
        <input className="w-full border rounded px-3 py-2" type="email" placeholder="Email"
               value={form.email} onChange={update("email")} required />
        <input className="w-full border rounded px-3 py-2" type="password" placeholder="Password"
               value={form.password} onChange={update("password")} required minLength={6} />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button disabled={loading} className="w-full bg-slate-800 text-white rounded py-2 disabled:opacity-50">
          {loading ? "Creating..." : "Sign up"}
        </button>
      </form>
      <p className="text-sm mt-3">
        Already have an account? <Link to="/login" className="text-blue-600 hover:underline">Log in</Link>
      </p>
    </div>
  );
}
