import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Scan from "./pages/Scan.jsx";
import Result from "./pages/Result.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Navbar from "./components/Navbar.jsx";
import { Stage } from "./components/Stage3D.jsx";

function isAuthed() {
  return Boolean(localStorage.getItem("aeqdf_token"));
}

function Protected({ children }) {
  return isAuthed() ? children : <Navigate to="/login" replace />;
}

function LandingRoute() {
  const navigate = useNavigate();
  return <Landing onScan={() => navigate("/scan")} />;
}

// Pages that fill the whole screen (they bring their own background)
const FULL_BLEED = ["/", "/login", "/signup"];

function Shell({ children }) {
  const { pathname } = useLocation();
  if (FULL_BLEED.includes(pathname)) return <>{children}</>;
  return (
    <Stage className="app-stage">
      <div className="max-w-4xl mx-auto px-4 py-10">{children}</div>
    </Stage>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Shell>
        <Routes>
          <Route path="/" element={<LandingRoute />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/scan" element={<Protected><Scan /></Protected>} />
          <Route path="/result" element={<Protected><Result /></Protected>} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}