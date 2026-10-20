import { useEffect, useMemo, useRef } from "react";
import "./Stage3D.css";


export function useFullBleed(ref) {
  useEffect(() => {
    const el = ref?.current;
    if (!el) return;
    el.classList.add("full-bleed");
    return () => el.classList.remove("full-bleed");
  }, [ref]);
}
/* Floating CSS-3D cubes in the background. Positions are % of the stage. */
const CUBES = [
  { s: 54, x: "5%", y: "12%", d: 0, t: 18 },
  { s: 34, x: "88%", y: "9%", d: -4, t: 14 },
  { s: 70, x: "90%", y: "56%", d: -8, t: 22 },
  { s: 28, x: "3%", y: "60%", d: -2, t: 12, extra: true },
  { s: 44, x: "78%", y: "84%", d: -6, t: 16, extra: true },
  { s: 38, x: "13%", y: "85%", d: -10, t: 20, extra: true },
];
const FACES = ["f", "b", "r", "l", "t", "d"];

/** Page wrapper: soft gradient, glow blobs, perspective floor grid, floating cubes. */
export function Stage({ children, className = "" }) {
  return (
    <div className={`stage ${className}`}>
      <div className="stage__bg" aria-hidden="true">
        <div className="stage__glow stage__glow--a" />
        <div className="stage__glow stage__glow--b" />
        <div className="stage__floor" />
        {CUBES.map((c, i) => (
          <div
            key={i}
            className={`cube-wrap ${c.extra ? "cube-wrap--extra" : ""}`}
            style={{ "--s": `${c.s}px`, "--d": `${c.d}s`, "--t": `${c.t}s`, left: c.x, top: c.y }}
          >
            <div className="cube">
              {FACES.map((f) => (
                <i key={f} className={`cube__f cube__f--${f}`} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="stage__content">{children}</div>
    </div>
  );
}

/** Card that tilts toward the pointer. Children can use translateZ() to pop out. */
export function Tilt({ as: Tag = "div", max = 6, glare = true, className = "", children, ...rest }) {
  const ref = useRef(null);

  const onMove = (e) => {
    if (e.pointerType === "touch") return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--ry", `${((px - 0.5) * max * 2).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${(-(py - 0.5) * max * 2).toFixed(2)}deg`);
    el.style.setProperty("--gx", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--gy", `${(py * 100).toFixed(1)}%`);
  };
  const onEnter = () => ref.current?.classList.add("is-active");
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove("is-active");
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  return (
    <Tag
      ref={ref}
      className={`tilt ${className}`}
      onPointerEnter={onEnter}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      {...rest}
    >
      {children}
      {glare && <span className="tilt__glare" aria-hidden="true" />}
    </Tag>
  );
}

/* ---------- Spinning 3D cube whose faces are QR-looking patterns ---------- */
function qrUri(seed, n = 15) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const corners = [
    [0, 0],
    [n - 5, 0],
    [0, n - 5],
  ];
  let d = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let dark = null;
      for (const [ox, oy] of corners) {
        const lx = x - ox;
        const ly = y - oy;
        if (lx >= -1 && lx <= 5 && ly >= -1 && ly <= 5) {
          if (lx < 0 || ly < 0 || lx > 4 || ly > 4) dark = false;
          else dark = lx === 0 || ly === 0 || lx === 4 || ly === 4 || (lx === 2 && ly === 2);
        }
      }
      if (dark === null) dark = rnd() > 0.5;
      if (dark) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${n} ${n}' shape-rendering='crispEdges'><path fill='#0f172a' d='${d}'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function QRCube({ size = 72 }) {
  const faces = useMemo(() => [3, 5, 7, 9, 11, 13].map((s) => qrUri(s)), []);
  return (
    <div className="qrcube-scene" style={{ "--s": `${size}px` }} aria-hidden="true">
      <div className="qrcube">
        {faces.map((u, i) => (
          <i key={i} className={`qrcube__f qrcube__f--${FACES[i]}`} style={{ backgroundImage: u }} />
        ))}
      </div>
    </div>
  );
}
