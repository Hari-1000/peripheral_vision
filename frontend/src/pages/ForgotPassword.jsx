import { useState } from "react";
import api from "../api";
import "../styles/auth.css";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/forgot-password", { email });
      setMessage(res.data.message);
      // In dev mode the token is returned directly so user can copy it
      if (res.data.reset_token) setToken(res.data.reset_token);
    } catch {
      setMessage("Something went wrong.");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Reset password</h2>
        <p className="auth-sub">Enter your email to get a reset token</p>
        {message && <div className="auth-info">{message}</div>}
        {token && (
          <div className="auth-token-box">
            <p>Your reset token (dev mode):</p>
            <code>{token}</code>
            <p>Use this at <a href="/reset-password">/reset-password</a></p>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <input
            type="email" placeholder="Email" required
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit">Get Reset Token</button>
        </form>
      </div>
    </div>
  );
}
