import { Component, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const N = 21; // QR version 1 grid
const GAP = 1.08;

/** Deterministic QR-looking pattern: three finder squares + seeded noise. */
function buildCells() {
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const origins = [
    [0, 0],
    [N - 7, 0],
    [0, N - 7],
  ];
  const cells = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let finder = false;
      let dark = null;
      for (const [ox, oy] of origins) {
        const lx = x - ox;
        const ly = y - oy;
        if (lx >= -1 && lx <= 7 && ly >= -1 && ly <= 7) {
          if (lx < 0 || ly < 0 || lx > 6 || ly > 6) {
            dark = false; // quiet separator
          } else {
            const ring = lx === 0 || ly === 0 || lx === 6 || ly === 6;
            const core = lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4;
            dark = ring || core;
            finder = dark;
          }
        }
      }
      if (dark === null) dark = rnd() > 0.5;
      if (dark) {
        cells.push({
          x: (x - (N - 1) / 2) * GAP,
          z: (y - (N - 1) / 2) * GAP,
          finder,
        });
      }
    }
  }
  return cells;
}

const BASE = new THREE.Color("#1e293b");
const HOT = new THREE.Color("#22d3ee");
const SAFE = new THREE.Color("#34d399");

function Modules({ reduced }) {
  const mesh = useRef();
  const group = useRef();
  const beam = useRef();
  const cells = useMemo(buildCells, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const span = (N - 1) * GAP * 0.5 + 3;

  useFrame(({ clock, pointer }) => {
    const t = reduced ? 2.2 : clock.elapsedTime;
    // Sweep from -span to +span, then rest briefly before repeating.
    const cycle = (t * 0.38) % 1.35;
    const s = cycle > 1 ? span + 10 : -span + cycle * span * 2;

    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const d = c.z - s;
      const lift = Math.exp(-(d * d) / 3.2);
      const h = 0.35 + (c.finder ? 0.55 : 0) + lift * 1.5;
      dummy.position.set(c.x, h / 2, c.z);
      dummy.scale.set(0.9, h, 0.9);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);

      color.copy(BASE);
      if (c.z < s - 1.5) color.lerp(SAFE, 0.22); // already verified
      color.lerp(HOT, Math.min(1, lift * 1.2));
      mesh.current.setColorAt(i, color);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.instanceColor.needsUpdate = true;

    beam.current.position.z = s;
    beam.current.visible = cycle <= 1;

    const g = group.current;
    const targetY = -0.55 + (reduced ? 0 : pointer.x * 0.35) + (reduced ? 0 : Math.sin(t * 0.25) * 0.08);
    const targetX = 0.95 + (reduced ? 0 : -pointer.y * 0.18);
    g.rotation.y += (targetY - g.rotation.y) * 0.05;
    g.rotation.x += (targetX - g.rotation.x) * 0.05;
  });

  return (
    <group ref={group} rotation={[0.95, -0.55, 0]} position={[0, -0.6, 0]}>
      <instancedMesh ref={mesh} args={[undefined, undefined, cells.length]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial metalness={0.25} roughness={0.35} />
      </instancedMesh>

      {/* scan beam */}
      <mesh ref={beam} position={[0, 0.9, 0]}>
        <boxGeometry args={[N * GAP + 2, 2.6, 0.06]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.22} depthWrite={false} />
      </mesh>

      {/* base plate */}
      <mesh position={[0, -0.08, 0]}>
        <boxGeometry args={[N * GAP + 1.2, 0.16, N * GAP + 1.2]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.1} roughness={0.8} />
      </mesh>
    </group>
  );
}

class SceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function QRScene({ className }) {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div className={className} aria-hidden="true">
      <SceneBoundary fallback={<div className="scene-fallback" />}>
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 13, 21], fov: 34 }}
          gl={{ alpha: true, antialias: true }}
        >
          <ambientLight intensity={0.9} />
          <directionalLight position={[8, 14, 6]} intensity={1.4} />
          <pointLight position={[-10, 6, -8]} intensity={40} color="#22d3ee" />
          <Modules reduced={reduced} />
        </Canvas>
      </SceneBoundary>
    </div>
  );
}
