import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import jsQR from "jsqr";
import { Html5Qrcode } from "html5-qrcode";
import { scans } from "../api/client.js";
import { QRCube } from "../components/Stage3D.jsx";

export default function Scan() {
  const [decodedUrl, setDecodedUrl] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const canvasRef = useRef(null);
  const html5QrRef = useRef(null);
  const navigate = useNavigate();

  // ---- Upload + jsQR decode ----
  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError("");
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code) {
        setDecodedUrl(code.data);
      } else {
        setError("Could not detect a QR code in this image.");
      }
    };
    img.src = URL.createObjectURL(file);
  }

  // ---- Live camera scan ----
  useEffect(() => {
    if (!cameraOn) return;
    const qr = new Html5Qrcode("camera-view");
    html5QrRef.current = qr;
    qr.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      (text) => {
        setDecodedUrl(text);
        qr.stop().catch(() => {});
        setCameraOn(false);
      },
      () => {} // ignore per-frame scan failures
    ).catch((err) => setError("Camera error: " + err.message));

    return () => {
      qr.stop().catch(() => {});
    };
  }, [cameraOn]);

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const result = await scans.submit(decodedUrl);
      navigate("/result", { state: result });
    } catch (err) {
      setError(err.response?.data?.error || "Scan submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="glass-card max-w-lg mx-auto">
      <div className="flex flex-col items-center text-center mb-6">
        <QRCube size={64} />
        <h2 className="mt-4 text-2xl font-bold text-slate-900">Scan a QR code</h2>
        <p className="mt-1 text-sm text-slate-500">
          Upload an image or use your camera. We check the link before you open it.
        </p>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Upload an image</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="block w-full rounded-xl border border-slate-200 bg-white/70 p-2 text-sm text-slate-600
                       file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-slate-800
                       file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
          />
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div>
          <button
            onClick={() => setCameraOn((v) => !v)}
            className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-medium
                       text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
          >
            {cameraOn ? "Stop camera" : "Use live camera"}
          </button>
          {cameraOn && (
            <div id="camera-view" className="mt-3 w-full max-w-xs mx-auto overflow-hidden rounded-xl" />
          )}
        </div>

        {decodedUrl && (
          <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-3 text-sm break-all text-slate-700">
            <span className="font-semibold">Decoded URL:</span> {decodedUrl}
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          disabled={!decodedUrl || submitting}
          onClick={handleSubmit}
          className="w-full rounded-xl bg-gradient-to-b from-slate-700 to-slate-900 px-5 py-3 font-semibold
                     text-white shadow-lg transition hover:-translate-y-0.5
                     disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300
                     disabled:shadow-none disabled:hover:translate-y-0"
        >
          {submitting ? "Analyzing..." : "Analyze this URL"}
        </button>
      </div>
    </div>
  );
}