import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./ui";
import { useApp } from "../store";

/* Live-camera capture modal (getUserMedia; works on http://localhost).
   onCapture(file) fires per shot; onClose closes. Lets you pick a device (phone-as-webcam). */
export default function CameraModal({ onCapture, onClose }) {
  const { toast } = useApp();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState(null);

  async function startStream(id) {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = await navigator.mediaDevices.getUserMedia({
      video: id ? { deviceId: { exact: id } } : { facingMode: "environment" }, audio: false,
    });
    if (videoRef.current) videoRef.current.srcObject = streamRef.current;
  }

  useEffect(() => {
    let alive = true;
    startStream(null)
      .then(async () => {
        const list = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
        if (alive) setDevices(list);
      })
      .catch((e) => { toast("Camera unavailable: " + (e.message || e) + " — use drag & drop or file picker.", "err", 6000); onClose(); });
    return () => { alive = false; if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (deviceId) startStream(deviceId); /* eslint-disable-next-line */ }, [deviceId]);

  function shoot() {
    const v = videoRef.current; if (!v) return;
    const cv = document.createElement("canvas");
    cv.width = v.videoWidth || 720; cv.height = v.videoHeight || 960;
    cv.getContext("2d").drawImage(v, 0, 0, cv.width, cv.height);
    cv.toBlob((blob) => { if (blob) { onCapture(new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" })); toast("Photo captured", "ok"); } }, "image/jpeg", 0.9);
  }

  return createPortal(
    <div className="fixed inset-0 z-[120] bg-black/90 flex flex-col items-center justify-center gap-4 p-4">
      <div className="w-full max-w-[400px] flex items-center justify-between text-white">
        <span className="font-headline-sm text-headline-sm">Live capture</span>
        <button className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center" onClick={onClose}><Icon name="close" /></button>
      </div>
      {devices.length > 1 && (
        <select className="w-full max-w-[400px] bg-surface-container-lowest border border-outline-variant rounded-lg p-2 font-body-md text-body-md"
          value={deviceId || ""} onChange={(e) => setDeviceId(e.target.value)}>
          {devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || "Camera " + (i + 1)}</option>)}
        </select>
      )}
      <video ref={videoRef} autoPlay playsInline className="w-full max-w-[400px] rounded-lg bg-black aspect-[3/4] object-cover" />
      <div className="flex items-center gap-3">
        <button className="bg-amber-action text-near-black font-label-bold text-label-bold py-3 px-6 rounded-full flex items-center gap-2" onClick={shoot}><Icon name="camera" /> Capture</button>
        <button className="text-white/80 font-label-md text-label-md underline" onClick={onClose}>Done</button>
      </div>
      <p className="text-white/60 font-label-md text-label-md max-w-[400px] text-center">Tip: to use your phone as the camera, connect it as a webcam (USB / IP-webcam app) and pick it in the dropdown.</p>
    </div>,
    document.body
  );
}
