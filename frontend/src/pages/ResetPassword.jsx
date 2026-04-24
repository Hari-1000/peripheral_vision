import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import "../styles/auth.css";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ token: "", new_password: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/reset-password", form);
      setSuccess(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || "Reset failed");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Set new password</h2>
        {success ? (
          <div className="auth-info">Password updated! Redirecting to login...</div>
        ) : (
          <>
            {error && <div className="auth-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <input
                type="text" placeholder="Reset token" required
                value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })}
              />
              <input
                type="password" placeholder="New password" required
                value={form.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })}
              />
              <button type="submit">Reset Password</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
