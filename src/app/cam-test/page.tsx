"use client";
import { useState, useRef } from "react";

export default function CamTest() {
  const [msg, setMsg] = useState<string>("Click Start to request camera.");
  const videoRef = useRef<HTMLVideoElement>(null);
  let stream: MediaStream | null = null;

  async function start() {
    setMsg("Starting…");
    if (window.top !== window.self) {
      setMsg("Running inside an iframe. Open this page in a new tab/window.");
      return;
    }
    if (!window.isSecureContext) {
      setMsg("Needs HTTPS or localhost.");
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
      setMsg("Camera OK.");
    } catch (e: any) {
      setMsg(`getUserMedia failed: ${e?.name || "Unknown"} — ${e?.message || ""}`);
    }
  }

  function stop() {
    const s = videoRef.current?.srcObject as MediaStream | null;
    s?.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setMsg("Stopped.");
  }

  return (
    <div style={{padding:16}}>
      <h1>Camera Test</h1>
      <p>{msg}</p>
      <div style={{display:"flex", gap:8, marginBottom:12}}>
        <button onClick={start}>Start</button>
        <button onClick={stop}>Stop</button>
      </div>
      <video ref={videoRef} playsInline muted style={{width: "100%", maxWidth: 480, borderRadius: 12}} />
    </div>
  );
}