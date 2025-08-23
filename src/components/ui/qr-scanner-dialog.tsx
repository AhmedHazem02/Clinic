import { useEffect, useRef, useState } from "react";

export default function QrScannerDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  const isIframe = typeof window !== "undefined" && window.top !== window.self;
  const isSecure = typeof window !== "undefined" && window.isSecureContext;

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function start() {
      setError(null);

      if (!isOpen) return;

      if (isIframe) {
        setError("لا يمكن فتح الكاميرا داخل iframe بدون السماح 'allow=\"camera\"'. افتح الصفحة في تبويب مستقل.");
        return;
      }
      if (!isSecure) {
        setError("الوصول للكاميرا يتطلب HTTPS أو localhost. افتح الموقع على دومين آمن.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } }, 
          audio: false
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e: any) {
        console.error("Error accessing camera:", e); // Log the actual error object to help debug the [object Object] issue
        const map: Record<string,string> = {
          NotAllowedError: "Permission denied. Allow camera in browser settings.",
          NotFoundError: "No camera found on this device.",
          NotReadableError: "Camera is in use by another app.",
          OverconstrainedError: "Requested camera constraints not available.",
          SecurityError: "Blocked by browser security policy (HTTPS/iframe).",
        };
        setError(map[e?.name] ?? `Unable to start camera: ${e?.name || "Unknown"} — ${e?.message || ""}`);
      }
    }

    start();

    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
      }
    };
  }, [isOpen]);

  return (
    <div className="dialog">
      <h3>Scan QR Code</h3>
      {error ? <p style={{color:"#c00"}}>{error}</p> : null}
      <video
        ref={videoRef}
        playsInline
        autoPlay
        muted
        style={{ width: "100%", borderRadius: 12 }}
      />
    </div>
  );
}
