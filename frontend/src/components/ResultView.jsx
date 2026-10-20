import { Stage, Tilt } from "./Stage3D";
import "./ResultView.css";

/**
 * Expected `result` shape (all fields except url/verdict/riskScore are optional):
 * {
 *   url: "https://www.python.org",
 *   verdict: "Safe" | "Suspicious" | "Phishing",   // "Malicious" is treated as "Phishing"
 *   riskScore: 16.1,                                // 0-100
 *   features: [
 *     { name: "LetterRatioInURL", value: 0.62, impact: 8.4 },      // impact: signed points
 *     { name: "NoOfSelfRef", value: 120, direction: "decreases" }  // or direction only
 *   ],
 *   redirectChain: [ { url: "https://bit.ly/abc", status: 301 }, { url: "https://www.python.org", status: 200 } ]
 * }
 */

const VERDICT_META = {
  Safe: { tone: "safe", icon: "✓", blurb: "No strong phishing signals found." },
  Suspicious: { tone: "warn", icon: "!", blurb: "Some signals look risky. Be careful." },
  Phishing: { tone: "danger", icon: "✕", blurb: "Likely phishing. Do not open or sign in." },
};
VERDICT_META.Malicious = VERDICT_META.Phishing;

function normalizeFeatures(features = []) {
  const items = features.map((f) => {
    const impact = typeof f.impact === "number" ? f.impact : null;
    const direction =
      impact !== null ? (impact >= 0 ? "increases" : "decreases") : f.direction === "increases" ? "increases" : "decreases";
    return { ...f, impact, direction };
  });
  const hasNumeric = items.some((i) => i.impact !== null);
  return hasNumeric ? [...items].sort((a, b) => Math.abs(b.impact ?? 0) - Math.abs(a.impact ?? 0)) : items;
}

function formatValue(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
}

function RiskGauge({ score, tone }) {
  const clamped = Math.max(0, Math.min(100, Number(score) || 0));
  const r = 52;
  const c = 2 * Math.PI * r;
  const arc = c * 0.75;
  const filled = (clamped / 100) * arc;
  return (
    <div className={`gauge gauge--${tone}`} role="img" aria-label={`Risk score ${clamped} out of 100`}>
      <svg viewBox="0 0 140 140">
        <circle className="gauge__track" cx="70" cy="70" r={r} strokeDasharray={`${arc} ${c}`} transform="rotate(135 70 70)" />
        <circle className="gauge__fill" cx="70" cy="70" r={r} strokeDasharray={`${filled} ${c}`} transform="rotate(135 70 70)" />
      </svg>
      <div className="gauge__label">
        <span className="gauge__num">{clamped.toFixed(1)}</span>
        <span className="gauge__den">/ 100</span>
      </div>
    </div>
  );
}

function RedirectChain({ chain }) {
  if (!chain || chain.length < 2) return null;
  return (
    <Tilt as="section" className="card" max={2.5} glare={false}>
      <h2 className="card__title">Redirect path</h2>
      <p className="card__sub">
        This link passed through {chain.length - 1} redirect{chain.length - 1 > 1 ? "s" : ""}. The final page was scanned.
      </p>
      <ol className="chain">
        {chain.map((hop, i) => {
          const last = i === chain.length - 1;
          return (
            <li key={i} className={`chain__item ${last ? "chain__item--final" : ""}`}>
              <span className="chain__dot" />
              <div className="chain__body">
                <span className="chain__url" title={hop.url}>{hop.url}</span>
                <span className="chain__meta">
                  {last ? "Final destination" : "Redirect"}
                  {hop.status ? ` · HTTP ${hop.status}` : ""}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </Tilt>
  );
}

function FeatureImpact({ features }) {
  const items = normalizeFeatures(features);
  const maxImpact = Math.max(1, ...items.map((i) => Math.abs(i.impact ?? 0)));
  return (
    <Tilt as="section" className="card" max={2.5} glare={false}>
      <h2 className="card__title">Why this verdict</h2>
      <p className="card__sub">Strongest signals first. Red pushes the score toward phishing, green pushes it toward safe.</p>
      <ul className="impacts">
        {items.map((f) => {
          const up = f.direction === "increases";
          const width = f.impact !== null ? (Math.abs(f.impact) / maxImpact) * 100 : 40;
          const val = formatValue(f.value);
          return (
            <li key={f.name} className="impact">
              <div className="impact__head">
                <span className="impact__name">{f.name}</span>
                <span className="impact__meta">
                  {val !== null && <span className="impact__val">value {val}</span>}
                  <span className={`impact__tag ${up ? "is-up" : "is-down"}`}>
                    {f.impact !== null ? `${up ? "+" : "−"}${Math.abs(f.impact).toFixed(1)} pts` : up ? "increases risk" : "decreases risk"}
                  </span>
                </span>
              </div>
              <div className="impact__bar">
                <div className={`impact__fill ${up ? "is-up" : "is-down"}`} style={{ width: `${width}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </Tilt>
  );
}

export default function ResultView({ result, onScanAnother }) {
  if (!result) return null;
  const meta = VERDICT_META[result.verdict] || VERDICT_META.Suspicious;
  const tone = meta.tone;

  return (
    <Stage>
      <main className="result">
        <Tilt as="section" className={`verdict verdict--${tone}`} max={6}>
          <div className="verdict__text">
            <span className="verdict__url" title={result.url}>{result.url}</span>
            <h1 className="verdict__title">
              <span className="verdict__icon" aria-hidden="true">{meta.icon}</span>
              {result.verdict}
            </h1>
            <p className="verdict__blurb">{meta.blurb}</p>
          </div>
          <RiskGauge score={result.riskScore} tone={tone} />
        </Tilt>

        <RedirectChain chain={result.redirectChain} />
        <FeatureImpact features={result.features} />

        <div className="result__actions">
          <button type="button" className="u-btn u-btn--primary" onClick={onScanAnother}>
            Scan another
          </button>
        </div>
      </main>
    </Stage>
  );
}
