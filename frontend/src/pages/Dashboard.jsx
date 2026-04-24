import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import api from "../api";
import "../styles/dashboard.css";

function LineGraph({ data }) {
  const W = 600, H = 180, PAD = { top: 20, right: 20, bottom: 30, left: 40 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  if (data.length < 2) return (
    <div className="graph-placeholder">Play at least 2 sessions to see your trend</div>
  );

  const xStep = innerW / (data.length - 1);
  const toX = (i) => PAD.left + i * xStep;
  const toY = (v) => PAD.top + innerH - (v / 100) * innerH;

  const points = data.map((r, i) => [toX(i), toY(r.accuracy)]);
  const polyline = points.map((p) => p.join(",")).join(" ");

  // Filled area under the line
  const areaPoints = [
    `${PAD.left},${PAD.top + innerH}`,
    ...points.map((p) => p.join(",")),
    `${PAD.left + innerW},${PAD.top + innerH}`,
  ].join(" ");

  // Y axis labels
  const yLabels = [0, 25, 50, 75, 100];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="line-graph">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4f8ef7" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#4f8ef7" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yLabels.map((v) => (
        <g key={v}>
          <line
            x1={PAD.left} y1={toY(v)} x2={PAD.left + innerW} y2={toY(v)}
            stroke="#2a2a2a" strokeWidth="1"
          />
          <text x={PAD.left - 6} y={toY(v) + 4} textAnchor="end" fontSize="10" fill="#555">
            {v}%
          </text>
        </g>
      ))}

      {/* Area fill */}
      <polygon points={areaPoints} fill="url(#areaGrad)" />

      {/* Line */}
      <polyline points={polyline} fill="none" stroke="#4f8ef7" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {/* Dots + tooltips */}
      {points.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="4" fill="#4f8ef7" stroke="#0f0f0f" strokeWidth="2" />
          <title>Session {data[i].sessionNum}: {data[i].accuracy.toFixed(1)}%</title>
        </g>
      ))}

      {/* X axis labels */}
      {data.map((r, i) => (
        <text key={i} x={toX(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#555">
          #{r.sessionNum}
        </text>
      ))}
    </svg>
  );
}

export default function Dashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [results, setResults] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    api.get("/me").then((r) => setUser(r.data));
    fetchResults();
  }, []);

  const fetchResults = () => api.get("/results").then((r) => setResults(r.data));

  const deleteOne = async (id) => {
    await api.delete(`/results/${id}`);
    setConfirmDelete(null);
    fetchResults();
  };

  const deleteAll = async () => {
    await api.delete("/results");
    setConfirmDelete(null);
    fetchResults();
  };

  // Oldest → newest for graph, last 10
  const graphData = [...results]
    .reverse()
    .slice(-10)
    .map((r, i, arr) => ({ ...r, sessionNum: results.length - arr.length + i + 1 }));

  // Overall stats
  const avgAccuracy = results.length
    ? (results.reduce((s, r) => s + r.accuracy, 0) / results.length).toFixed(1)
    : null;
  const best = results.length
    ? Math.max(...results.map((r) => r.accuracy)).toFixed(1)
    : null;

  return (
    <div className="dashboard">
      <header className="dash-header">
        <h1>👁 Peripheral Vision</h1>
        <div className="dash-user">
          {user && <span>Hi, {user.username}</span>}
          <button onClick={logout} className="btn-logout">Log out</button>
        </div>
      </header>

      <main className="dash-main">
        <h2>Train your peripheral vision</h2>
        <div className="dash-cards" style={{ margin: "0 auto 3rem" }}>
          <div className="dash-card" onClick={() => navigate("/distance-check/train")}>
            <div className="card-icon">🏋️</div>
            <h3>Train</h3>
            <p>Practice your peripheral vision with timed light sequences</p>
          </div>
        </div>

        {results.length > 0 && (
          <>
            {/* Overall stats */}
            <div className="dash-stats-row">
              <div className="stat-box">
                <span>{results.length}</span>
                <label>Sessions</label>
              </div>
              <div className="stat-box">
                <span>{avgAccuracy}%</span>
                <label>Avg Accuracy</label>
              </div>
              <div className="stat-box">
                <span>{best}%</span>
                <label>Best Score</label>
              </div>
            </div>

            {/* Line graph */}
            <div className="dash-analytics">
              <div className="analytics-header">
                <h3>Accuracy trend</h3>
                <span className="analytics-sub">last {graphData.length} sessions</span>
              </div>
              <LineGraph data={graphData} />
            </div>

            {/* History table */}
            <div className="dash-history">
              <div className="history-header">
                <h3>Session History</h3>
                <button className="btn-delete-all" onClick={() => setConfirmDelete("all")}>
                  Delete all
                </button>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Accuracy</th>
                    <th>Speed</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={r.id}>
                      <td>{results.length - i}</td>
                      <td>{new Date(r.timestamp).toLocaleDateString()}</td>
                      <td>
                        <span className={`acc-badge ${r.accuracy >= 80 ? "good" : r.accuracy >= 50 ? "mid" : "low"}`}>
                          {r.accuracy.toFixed(1)}%
                        </span>
                      </td>
                      <td>{r.speed_setting}</td>
                      <td>
                        <button className="btn-delete-row" onClick={() => setConfirmDelete(r.id)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {results.length === 0 && (
          <div className="dash-empty">No sessions yet. Start training!</div>
        )}
      </main>

      {confirmDelete !== null && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Delete {confirmDelete === "all" ? "all records" : "this record"}?</h3>
            <p>This cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn-confirm-delete"
                onClick={() => confirmDelete === "all" ? deleteAll() : deleteOne(confirmDelete)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
