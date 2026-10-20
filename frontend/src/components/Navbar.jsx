import { Link, useNavigate } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();
  const authed = Boolean(localStorage.getItem("aeqdf_token"));

  function logout() {
    localStorage.removeItem("aeqdf_token");
    navigate("/login");
  }

  return (
    <nav className="border-b bg-white">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="font-bold text-lg text-slate-800">AEQDF</Link>
        <div className="flex gap-4 text-sm">
          {authed ? (
            <>
              <Link to="/scan" className="hover:underline">Scan</Link>
              <Link to="/dashboard" className="hover:underline">Dashboard</Link>
              <button onClick={logout} className="text-red-600 hover:underline">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="hover:underline">Login</Link>
              <Link to="/signup" className="hover:underline">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
