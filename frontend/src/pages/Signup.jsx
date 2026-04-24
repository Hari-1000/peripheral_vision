import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import "../styles/auth.css";

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", username: "", password: "" });
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/signup", form);
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.detail || "Signup failed");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Create account</h2>
        <p className="auth-sub">Start training your peripheral vision</p>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <input
            type="text" placeholder="Username" required
            value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <input
            type="email" placeholder="Email" required
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            type="password" placeholder="Password" required
            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <button type="submit">Sign Up</button>
        </form>
        <div className="auth-links">
          <Link to="/login">Already have an account? Log in</Link>
        </div>
      </div>
    </div>
  );
}
