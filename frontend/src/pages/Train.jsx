import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import "../styles/train.css";

const COLORS = ["red", "blue", "green", "yellow"];
const CORNER_KEYS = { q: "top-left", w: "top-right", a: "bottom-left", s: "bottom-right" };
const SPEED_MAP = { slow: 2000, medium: 1200, fast: 700 };
const SESSION_DURATION = 60;

// How far iris can move relative to eye width before triggering pause (0=center, 1=edge)

// Always returns 4 distinct colors assigned to corners, with centerColor guaranteed in one corner
function buildCornerColors(centerColor) {
  const others = COLORS.filter((c) => c !== centerColor);
  // shuffle others
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const four = [centerColor, others[0], others[1], others[2]];
  // shuffle all four positions
  for (let i = four.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [four[i], four[j]] = [four[j], four[i]];
  }
  const keys = ["top-left", "top-right", "bottom-left", "bottom-right"];
  const corners = {};
  keys.forEach((k, i) => { corners[k] = four[i]; });
  // find which corner has centerColor
  const target = keys.find((k) => corners[k] === centerColor);
  return { corners, target };
}

export default function Train() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const faceMeshRef = useRef(null);
  const cameraRef = useRef(null);
  const timerRef = useRef(null);
  const lightTimerRef = useRef(null);

  const [phase, setPhase] = useState("idle"); // idle | center | corners | paused | done
  const [centerColor, setCenterColor] = useState(null);
  const [cornerColors, setCornerColors] = useState(null);
  const [correctCorner, setCorrectCorner] = useState(null);
  const [speed, setSpeed] = useState("medium");
  const speedRef = useRef("medium");
  const [timeLeft, setTimeLeft] = useState(SESSION_DURATION);
  const [score, setScore] = useState({ attempts: 0, correct: 0 });
  const [paused, setPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [gazeOk, setGazeOk] = useState(true);
  const [gazeDebug, setGazeDebug] = useState({ h: 0, v: 0 });
  const [result, setResult] = useState(null);

  const gazeMissCount = useRef(0);
  const pausedRef = useRef(false);
  const phaseRef = useRef("idle");
  const scoreRef = useRef({ attempts: 0, correct: 0 });

  // Keep refs in sync
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { scoreRef.current = score; }, [score]);

  // --- Eye tracking setup ---
  useEffect(() => {
    let active = true;

    async function initEyeTracking() {
      // Load from CDN if not already loaded
      await new Promise((res, rej) => {
        if (window.FaceMesh) { res(); return; }
        if (document.querySelector('script[src*="face_mesh.js"]')) {
          const iv = setInterval(() => { if (window.FaceMesh) { clearInterval(iv); res(); } }, 100);
          return;
        }
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js";
        s.onload = () => { const iv = setInterval(() => { if (window.FaceMesh) { clearInterval(iv); res(); } }, 100); };
        s.onerror = rej;
        document.head.appendChild(s);
      });
      await new Promise((res, rej) => {
        if (window.Camera) { res(); return; }
        if (document.querySelector('script[src*="camera_utils.js"]')) {
          const iv = setInterval(() => { if (window.Camera) { clearInterval(iv); res(); } }, 100);
          return;
        }
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";
        s.onload = () => { const iv = setInterval(() => { if (window.Camera) { clearInterval(iv); res(); } }, 100); };
        s.onerror = rej;
        document.head.appendChild(s);
      });

      const faceMesh = new window.FaceMesh({
        locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
      });
      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      faceMesh.onResults((results) => {
        if (!active || phaseRef.current === "idle" || phaseRef.current === "done") return;
        if (!results.multiFaceLandmarks?.length) return;

        const lm = results.multiFaceLandmarks[0];

        const leftIris   = lm[468];
        const rightIris  = lm[473];
        if (!leftIris || !rightIris) {
          console.warn("Iris landmarks not available — refineLandmarks may not be working");
          return;
        }

        const leftEyeInner  = lm[133];
        const leftEyeOuter  = lm[33];
        const rightEyeInner = lm[362];
        const rightEyeOuter = lm[263];
        const leftEyeTop    = lm[159];
        const leftEyeBot    = lm[145];
        const rightEyeTop   = lm[386];
        const rightEyeBot   = lm[374];

        const leftEyeW  = Math.abs(leftEyeOuter.x  - leftEyeInner.x);
        const rightEyeW = Math.abs(rightEyeOuter.x - rightEyeInner.x);
        const leftH  = leftEyeW  > 0.001 ? (leftIris.x  - (leftEyeInner.x  + leftEyeOuter.x)  / 2) / leftEyeW  : 0;
        const rightH = rightEyeW > 0.001 ? (rightIris.x - (rightEyeInner.x + rightEyeOuter.x) / 2) / rightEyeW : 0;
        const horizGaze = (leftH + rightH) / 2;

        const leftEyeH  = Math.abs(leftEyeBot.y  - leftEyeTop.y);
        const rightEyeH = Math.abs(rightEyeBot.y - rightEyeTop.y);
        const leftV  = leftEyeH  > 0.001 ? (leftIris.y  - (leftEyeTop.y  + leftEyeBot.y)  / 2) / leftEyeH  : 0;
        const rightV = rightEyeH > 0.001 ? (rightIris.y - (rightEyeTop.y + rightEyeBot.y) / 2) / rightEyeH : 0;
        const vertGaze = (leftV + rightV) / 2;

        setGazeDebug({ h: horizGaze.toFixed(2), v: vertGaze.toFixed(2) });

        const HORIZ_THRESH = 0.11;
        const VERT_THRESH  = 0.11;
        const lookingAway  = Math.abs(horizGaze) > HORIZ_THRESH || Math.abs(vertGaze) > VERT_THRESH;

        setGazeOk(!lookingAway);

        if (lookingAway) {
          gazeMissCount.current += 1;
          if (gazeMissCount.current >= 4 && !pausedRef.current && phaseRef.current !== "idle" && phaseRef.current !== "done") {
            gazeMissCount.current = 0;
            triggerPauseRef.current?.("Focus on center");
          }
        } else {
          gazeMissCount.current = 0;
        }
      });

      faceMeshRef.current = faceMesh;

      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const camera = new window.Camera(videoRef.current, {
        onFrame: async () => { await faceMesh.send({ image: videoRef.current }); },
        width: 320, height: 240,
      });
      cameraRef.current = { camera, stream };
      camera.start();
    }

    initEyeTracking();
    return () => {
      active = false;
      cameraRef.current?.camera?.stop();
      cameraRef.current?.stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const triggerPauseRef = useRef(null);

  const triggerPause = useCallback((reason) => {
    pausedRef.current = true;
    setPaused(true);
    setPauseReason(reason);
    clearTimeout(lightTimerRef.current);
    clearInterval(timerRef.current);
  }, []);

  // Keep triggerPauseRef in sync so eye tracking closure always has latest version
  useEffect(() => { triggerPauseRef.current = triggerPause; }, [triggerPause]);

  const showCenterLight = useCallback(() => {
    if (pausedRef.current) return;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    setCenterColor(color);
    setCornerColors(null);
    setCorrectCorner(null);
    setPhase("center");

    lightTimerRef.current = setTimeout(() => {
      if (pausedRef.current) return;
      const { corners, target } = buildCornerColors(color);
      setCornerColors(corners);
      setCorrectCorner(target);
      setCenterColor(null);
      setPhase("corners");
      setScore((s) => ({ ...s, attempts: s.attempts + 1 }));

      lightTimerRef.current = setTimeout(() => {
        if (pausedRef.current) return;
        setPhase("idle");
        showCenterLight();
      }, SPEED_MAP[speedRef.current]);
    }, SPEED_MAP[speedRef.current]);
  }, []);

  const startSession = useCallback(() => {
    setScore({ attempts: 0, correct: 0 });
    setTimeLeft(SESSION_DURATION);
    setPhase("idle");
    setPaused(false);
    sessionEndedRef.current = false;

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          clearTimeout(lightTimerRef.current);
          endSession();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    setTimeout(() => showCenterLight(), 500);
  }, [showCenterLight]);

  const sessionEndedRef = useRef(false);

  const endSession = useCallback(() => {
    if (sessionEndedRef.current) return;
    sessionEndedRef.current = true;
    setPhase("done");
    cameraRef.current?.camera?.stop();
    cameraRef.current?.stream?.getTracks().forEach((t) => t.stop());
    const s = scoreRef.current;
    const accuracy = s.attempts > 0 ? (s.correct / s.attempts) * 100 : 0;
    const resultData = {
      total_attempts: s.attempts,
      correct_responses: s.correct,
      accuracy,
      speed_setting: speedRef.current,
    };
    setResult(resultData);
    api.post("/results", resultData).catch(console.error);
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (paused || phaseRef.current !== "corners") return;
    const key = e.key.toLowerCase();
    const corner = CORNER_KEYS[key];
    if (!corner) return;

    clearTimeout(lightTimerRef.current);
    if (corner === correctCorner) {
      setScore((s) => ({ ...s, correct: s.correct + 1 }));
    }
    setPhase("idle");
    setCornerColors(null);
    showCenterLight();
  }, [paused, correctCorner, showCenterLight]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleResume = () => {
    if (!gazeOk) return;
    // Update ref immediately — don't wait for React state update
    pausedRef.current = false;
    setPaused(false);
    gazeMissCount.current = 0;
    clearInterval(timerRef.current);
    clearTimeout(lightTimerRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          endSession();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    // Small delay so React state settles before starting lights
    setTimeout(() => showCenterLight(), 100);
  };

  if (result) {
    return (
      <div className="train-result">
        <h2>Session Complete</h2>
        <div className="result-stats">
          <div className="stat"><span>{result.accuracy.toFixed(1)}%</span><label>Accuracy</label></div>
          <div className="stat"><span>{result.correct_responses}/{result.total_attempts}</span><label>Correct</label></div>
          <div className="stat"><span>{result.speed_setting}</span><label>Speed</label></div>
        </div>
        <div className="result-actions">
          <button onClick={() => { setResult(null); startSession(); }}>Train Again</button>
          <button onClick={() => navigate("/")}>Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="train-page">
      {/* Hidden webcam for eye tracking */}
      <video ref={videoRef} style={{ display: "none" }} autoPlay muted playsInline />

      {phase === "idle" && !paused && (
        <div className="train-start">
          <h2>Training Session</h2>
          <p>Keep your eyes on the center light at all times.<br />
            When the corners light up, press the matching key:</p>
          <div className="key-guide">
            <span>Q = Top-left</span><span>W = Top-right</span>
            <span>A = Bottom-left</span><span>S = Bottom-right</span>
          </div>
          <div className="speed-control">
            <label>Speed:</label>
            {["slow", "medium", "fast"].map((s) => (
              <button
                key={s}
                className={`speed-btn ${speed === s ? "active" : ""}`}
                onClick={() => { setSpeed(s); speedRef.current = s; }}
              >{s}</button>
            ))}
          </div>
          <button className="btn-start" onClick={startSession}>Start (60s)</button>
        </div>
      )}

      {(phase === "center" || phase === "corners") && (
        <div className="train-arena">
          <div className="hud">
            <span>⏱ {timeLeft}s</span>
            <span>✓ {score.correct}/{score.attempts}</span>
            <span style={{ color: gazeOk ? "#2ecc71" : "#e74c3c", fontSize: "0.8rem" }}>
              gaze H:{gazeDebug.h} V:{gazeDebug.v}
            </span>
          </div>

          {/* Corner lights */}
          <div className={`corner top-left ${cornerColors ? "lit" : ""}`}
            style={{ background: cornerColors?.["top-left"] || "#222" }} />
          <div className={`corner top-right ${cornerColors ? "lit" : ""}`}
            style={{ background: cornerColors?.["top-right"] || "#222" }} />
          <div className={`corner bottom-left ${cornerColors ? "lit" : ""}`}
            style={{ background: cornerColors?.["bottom-left"] || "#222" }} />
          <div className={`corner bottom-right ${cornerColors ? "lit" : ""}`}
            style={{ background: cornerColors?.["bottom-right"] || "#222" }} />

          {/* Center light */}
          <div className="center-light"
            style={{ background: centerColor || "#222", boxShadow: centerColor ? `0 0 40px ${centerColor}` : "none" }} />
        </div>
      )}

      {paused && (
        <div className="pause-overlay">
          {/* Ghost center ring so user knows where to look */}
          <div className="pause-center-ring" />
          <div className="pause-card">
            <h2>⚠ {pauseReason}</h2>
            <p>Look back at the center dot, then resume.</p>
            <button disabled={!gazeOk} onClick={handleResume}>
              {gazeOk ? "Resume" : "Waiting for gaze..."}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
