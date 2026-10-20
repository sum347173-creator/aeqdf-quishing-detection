import { useLocation, Link } from "react-router-dom";
import { Tilt } from "../components/Stage3D.jsx";

const bandStyle = {
  Safe: "bg-green-100/90 text-green-800 border-green-300",
  Suspicious: "bg-yellow-100/90 text-yellow-800 border-yellow-300",
  Malicious: "bg-red-100/90 text-red-800 border-red-300",
};

export default function Result() {
  const { state } = useLocation();

  if (!state) {
    return (
      <div className="glass-card max-w-lg mx-auto text-center">
        <p className="text-slate-700">No scan result to show.</p>
        <Link to="/scan" className="mt-3 inline-block font-semibold text-sky-600 hover:underline">
          Scan a QR code
        </Link>
      </div>
    );
  }

  const { url, verdict, riskScore, explanation = [] } = state;

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <Tilt max={5} className={`rounded-3xl border p-6 shadow-xl ${bandStyle[verdict] || "bg-white"}`}>
        <p className="text-sm opacity-70 break-all">{url}</p>
        <h2 className="mt-1 text-3xl font-bold">{verdict}</h2>
        <p className="mt-2">
          Risk score: <span className="font-semibold">{riskScore}</span> / 100
        </p>
      </Tilt>

      <div className="glass-card">
        <h3 className="font-semibold text-slate-900 mb-3">Why this verdict</h3>
        <ul className="space-y-2">
          {explanation.map((f, i) => (
            <li key={i} className="flex justify-between border-b border-slate-200/70 pb-2 text-sm">
              <span className="text-slate-800">{f.feature}</span>
              <span
                className={
                  f.direction?.includes("increases")
                    ? "font-medium text-red-600"
                    : "font-medium text-green-600"
                }
              >
                {f.direction}
              </span>
            </li>
          ))}
          {explanation.length === 0 && (
            <li className="text-sm text-slate-500">No explanation factors returned.</li>
          )}
        </ul>

        <Link
          to="/scan"
          className="mt-6 inline-block rounded-xl bg-gradient-to-b from-slate-700 to-slate-900 px-5 py-2.5
                     text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5"
        >
          Scan another
        </Link>
      </div>
    </div>
  );
}