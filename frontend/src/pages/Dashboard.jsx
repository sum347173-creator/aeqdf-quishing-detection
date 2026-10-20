import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { scans } from "../api/client.js";

const COLORS = { Safe: "#16a34a", Suspicious: "#ca8a04", Malicious: "#dc2626" };
const BADGE = {
  Safe: "bg-green-100 text-green-800",
  Suspicious: "bg-yellow-100 text-yellow-800",
  Malicious: "bg-red-100 text-red-800",
};

export default function Dashboard() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([scans.list(1), scans.stats()])
      .then(([listRes, statsRes]) => {
        setItems(listRes.items);
        setStats(statsRes);
      })
      .finally(() => setLoading(false));
  }, []);

  const chartData = Object.entries(stats).map(([name, value]) => ({ name, value }));

  if (loading) {
    return <div className="glass-card text-center text-slate-600">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Your scan history</h2>

      {chartData.length > 0 && (
        <div className="glass-card h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={90} label>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={COLORS[entry.name] || "#999"} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-slate-200 text-slate-500">
              <th className="py-2 font-medium">URL</th>
              <th className="font-medium">Verdict</th>
              <th className="font-medium">Risk</th>
              <th className="font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s._id} className="border-b border-slate-100">
                <td className="py-3 max-w-xs truncate text-slate-800">{s.url}</td>
                <td>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE[s.verdict] || "bg-slate-100"}`}
                  >
                    {s.verdict}
                  </span>
                </td>
                <td className="text-slate-700">{s.riskScore}</td>
                <td className="text-slate-500">{new Date(s.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-500">No scans yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}