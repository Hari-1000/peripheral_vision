import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../styles/distance.css";

const IDEAL_DISTANCE_CM = 35;
const TOLERANCE_CM = 4;
const AVG_IPD_CM = 6.3;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      // Script tag exists but may not be fully executed yet — poll for the global
      const key = src.includes("face_mesh") ? "FaceMesh" : "Camera";
      if (window[key]) { resolve(); return; }
      const interval = setInterval(() => {
        if (window[key]) { clearInterval(interval); resolve(); }
      }, 100);
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.crossOrigin = "anonymous";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export default function DistanceCheck() {
  const { mode } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [distanceCm, setDistanceCm] = useState(null);

  useEffect(() => {
    let active = true;

    async function init() {
      // Load MediaPipe from CDN
      await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js");
      await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js");

      const faceMesh = new window.FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      faceMesh.onResults((results) => {
        if (!active) return;
        if (!results.multiFaceLandmarks?.length) {
          setStatus("detecting");
          setDistanceCm(null);
          return;
        }

        const landmarks = results.multiFaceLandmarks[0];
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ipdPixels = Math.abs(rightEye.x - leftEye.x) * canvas.width;
        const focalLength = canvas.width * 0.9;
        const distance = (focalLength * AVG_IPD_CM) / ipdPixels;

        setDistanceCm(Math.round(distance));
        if (distance < IDEAL_DISTANCE_CM - TOLERANCE_CM) setStatus("close");
        else if (distance > IDEAL_DISTANCE_CM + TOLERANCE_CM) setStatus("far");
        else setStatus("ok");
      });

      // Request webcam manually
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      canvasRef.current.width = 640;
      canvasRef.current.height = 480;

      const camera = new window.Camera(videoRef.current, {
        onFrame: async () => {
          canvasRef.current.width = videoRef.current.videoWidth || 640;
          canvasRef.current.height = videoRef.current.videoHeight || 480;
          await faceMesh.send({ image: videoRef.current });
        },
        width: 640,
        height: 480,
      });

      cameraRef.current = { camera, stream };
      camera.start();
      setStatus("detecting");
    }

    init().catch((err) => {
      console.error("DistanceCheck init error:", err);
      setStatus("error");
    });

    return () => {
      active = false;
      cameraRef.current?.camera?.stop();
      cameraRef.current?.stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleProceed = () => {
    cameraRef.current?.camera?.stop();
    cameraRef.current?.stream?.getTracks().forEach((t) => t.stop());
    if (mode === "train") navigate("/train");
  };

  const handleClose = () => {
    cameraRef.current?.camera?.stop();
    cameraRef.current?.stream?.getTracks().forEach((t) => t.stop());
    navigate("/");
  };

  const guidance = {
    loading:    { text: "Loading camera...", color: "#888" },
    detecting:  { text: "No face detected — look at the camera", color: "#f0a500" },
    close:      { text: "↑ Move back a bit", color: "#e74c3c" },
    far:        { text: "↓ Move closer to the screen", color: "#e74c3c" },
    ok:         { text: "✓ Perfect distance", color: "#2ecc71" },
    error:      { text: "Camera error — check browser permissions", color: "#e74c3c" },
  };

  return (
    <div className="distance-page">
      <div className="distance-card">
        <button className="distance-close" onClick={handleClose}>✕</button>
        <h2>Distance Check</h2>
        <p>We need to verify you're at the right distance before starting.</p>

        <div className="video-wrapper">
          <video ref={videoRef} className="webcam-feed" autoPlay muted playsInline />
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>

        <div className="distance-status" style={{ color: guidance[status]?.color }}>
          {guidance[status]?.text}
        </div>

        {distanceCm && (
          <div className="distance-value">
            ~{distanceCm} cm &nbsp;|&nbsp; Ideal: {IDEAL_DISTANCE_CM} cm
          </div>
        )}

        <button className="btn-proceed" disabled={status !== "ok"} onClick={handleProceed}>
          {status === "ok" ? "Proceed →" : "Waiting for correct distance..."}
        </button>
      </div>
    </div>
  );
}
