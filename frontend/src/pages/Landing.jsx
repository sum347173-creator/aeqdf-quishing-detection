import { lazy, Suspense, useEffect, useRef } from "react";
import { useFullBleed } from "../components/Stage3D";
import "./Landing.css";




// The 3D scene is code-split so the page text paints immediately.
const QRScene = lazy(() => import("../components/QRScene.jsx"));

const STEPS = [
  { n: "01", title: "Scan", text: "Point your camera at a QR code or upload an image. The hidden URL is extracted before you ever open it." },
  { n: "02", title: "Analyse", text: "The link is checked against independent signals and combined into a single risk score from 0 to 100." },
  { n: "03", title: "Understand", text: "You get a verdict of Safe, Suspicious or Malicious, with the exact reasons behind it." },
];

const SIGNALS = [
  { icon: "Aa", title: "Lexical structure", text: "Character ratios, length and special symbols that phishing URLs tend to share." },
  { icon: "⏳", title: "Domain age", text: "Brand-new domains are a common mark of throwaway attack sites." },
  { icon: "🔒", title: "SSL certificate", text: "Certificate presence and validity, because a padlock alone is not proof of safety." },
  { icon: "◎", title: "DNS records", text: "Resolution behaviour and record health of the destination domain." },
  { icon: "⚑", title: "Known-threat lists", text: "Cross-checks against lists of reported malicious sites." },
  { icon: "✦", title: "Plain-language reasons", text: "Every feature shows whether it raised or lowered the risk, so nothing is a black box." },
];

function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const items = root.querySelectorAll("[data-reveal]");
    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.15 }
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

export default function Landing({ onScan }) {
  const root = useReveal();
  useFullBleed(root);

  return (
    <div className="landing" ref={root}>
      {/* ---------- Hero ---------- */}
      <section className="hero">
        <div className="hero__grid" aria-hidden="true" />
        <div className="hero__inner">
          <div className="hero__copy">
            <span className="pill">
              <span className="pill__dot" /> Explainable quishing detection
            </span>
            <h1 className="hero__title">
              Know where a QR code leads <em>before</em> you trust it.
            </h1>
            <p className="hero__lead">
              QR codes hide their destination until scanned. AEQDF checks the embedded URL against
              independent signals and explains exactly why a result is Safe, Suspicious or Malicious.
            </p>
            <div className="hero__cta">
              <button type="button" className="btn btn--primary" onClick={onScan}>
                Scan a QR code
                <span aria-hidden="true">→</span>
              </button>
              <a className="btn btn--ghost" href="#how">See how it works</a>
            </div>
            <ul className="hero__trust">
              <li>Explainable verdicts</li>
              <li>Risk score 0–100</li>
              <li>No sign-in needed to read results</li>
            </ul>
          </div>

          <div className="hero__scene">
            <Suspense fallback={<div className="scene-fallback" />}>
              <QRScene className="scene" />
            </Suspense>
            <div className="chip chip--a">
              <span className="chip__dot chip__dot--ok" /> Safe · 16.1
            </div>
            <div className="chip chip--b">
              <span className="chip__dot chip__dot--bad" /> LetterRatioInURL +8.4
            </div>
          </div>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="section" id="how">
        <div className="section__head" data-reveal>
          <span className="eyebrow">How it works</span>
          <h2>From a square of dots to a clear answer</h2>
        </div>
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s.n} className="step" data-reveal style={{ transitionDelay: `${i * 80}ms` }}>
              <span className="step__n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- Signals ---------- */}
      <section className="section section--tint">
        <div className="section__head" data-reveal>
          <span className="eyebrow">What AEQDF checks</span>
          <h2>Independent signals, one explained verdict</h2>
        </div>
        <div className="signals">
          {SIGNALS.map((s, i) => (
            <article key={s.title} className="signal" data-reveal style={{ transitionDelay: `${(i % 3) * 70}ms` }}>
              <span className="signal__icon" aria-hidden="true">{s.icon}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="cta" data-reveal>
        <h2>Scanned something suspicious?</h2>
        <p>Check it in seconds and see the reasons, not just a label.</p>
        <button type="button" className="btn btn--light" onClick={onScan}>
          Scan a QR code <span aria-hidden="true">→</span>
        </button>
      </section>

      <footer className="foot">AEQDF · Adaptive Explainable Quishing Detection</footer>
    </div>
  );
}
