import { useState } from "react";
import { QRCube, Stage, Tilt } from "./Stage3D";
import "./ScanView.css";

/**
 * Presentational scan page. Keep your existing logic in Scan.jsx and pass it in:
 *
 *   fileName     string | ""        name of the chosen image
 *   previewUrl   string | ""        URL.createObjectURL(file) for the preview
 *   decodedUrl   string | ""        the URL read from the QR
 *   onFile       (file: File) => void
 *   cameraOn     boolean
 *   onToggleCamera () => void
 *   cameraSlot   ReactNode          your existing camera/scanner component, shown when cameraOn
 *   canAnalyze   boolean            same condition that enables your button today
 *   loading      boolean
 *   error        string
 *   onAnalyze    () => void
 */
export default function ScanView({
  fileName = "",
  previewUrl = "",
  decodedUrl = "",
  onFile,
  cameraOn = false,
  onToggleCamera,
  cameraSlot = null,
  canAnalyze = false,
  loading = false,
  error = "",
  onAnalyze,
}) {
  const [dragging, setDragging] = useState(false);

  const pick = (file) => {
    if (file && file.type.startsWith("image/")) onFile?.(file);
  };

  return (
    <Stage>
      <div className="scanv">
        <header className="scanv__head">
          <QRCube size={72} />
          <h1>Scan a QR code</h1>
          <p>Upload a photo or use your camera. We read the link first, so you can check it before you ever open it.</p>
        </header>

        <Tilt className="scanv__card" max={4}>
          {cameraOn ? (
            <div className="scanv__camera">{cameraSlot}</div>
          ) : (
            <label
              className={`drop ${dragging ? "is-drag" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pick(e.dataTransfer.files?.[0]);
              }}
            >
              <input type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
              {previewUrl ? (
                <img src={previewUrl} alt="Selected QR code" />
              ) : (
                <>
                  <span className="drop__icon" aria-hidden="true">↑</span>
                  <strong>Drop a QR image here</strong>
                  <span className="drop__sub">or click to browse · PNG, JPG</span>
                </>
              )}
            </label>
          )}

          {fileName && !cameraOn && <p className="scanv__file">{fileName}</p>}

          {decodedUrl && (
            <div className="found">
              <span>Link found in the QR</span>
              <code>{decodedUrl}</code>
            </div>
          )}

          {error && <p className="scanv__error" role="alert">{error}</p>}

          <div className="scanv__actions">
            <button type="button" className="u-btn u-btn--ghost" onClick={onToggleCamera}>
              {cameraOn ? "Stop camera" : "Use live camera"}
            </button>
            <button type="button" className="u-btn u-btn--primary" disabled={!canAnalyze || loading} onClick={onAnalyze}>
              {loading ? (
                <>
                  <span className="u-spin" /> Analyzing…
                </>
              ) : (
                <>Analyze this URL →</>
              )}
            </button>
          </div>
        </Tilt>

        <ul className="scanv__tips">
          <li>Good light helps</li>
          <li>Keep the whole code in frame</li>
          <li>We never open the link for you</li>
        </ul>
      </div>
    </Stage>
  );
}
