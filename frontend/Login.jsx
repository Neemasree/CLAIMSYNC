import { useState } from "react";
import "./Signup.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function Login({ initialEmail = "", notice = "", onAuthenticated, onSwitchToSignup }) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Unable to log in. Please try again.");
      }

      onAuthenticated(data.token, data.user);
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? "Unable to connect to CLAIMSYNC. Check that the API server is running."
          : requestError.message || "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="signup-page">
      <section className="signup-story" aria-label="About CLAIMSYNC">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">C</span>
          <span>CLAIMSYNC</span>
        </div>
        <div className="story-copy">
          <p className="story-eyebrow">Your claims workspace</p>
          <h1>Every claim deserves <span>the right attention.</span></h1>
          <p className="story-description">
            Sign in to keep important cases visible, monitor service deadlines,
            and help your team act on the claims that need attention first.
          </p>
          <ul className="story-points">
            <li><span className="point-check" aria-hidden="true">✓</span> One place for your claims work</li>
            <li><span className="point-check" aria-hidden="true">✓</span> Clearer priorities and deadlines</li>
            <li><span className="point-check" aria-hidden="true">✓</span> A smoother team workflow</li>
          </ul>
        </div>
        <footer className="story-footer">Built for clearer, more thoughtful claims operations.</footer>
      </section>

      <section className="signup-panel">
        <div className="signup-card">
          <div className="brand mobile-brand">
            <span className="brand-mark" aria-hidden="true">C</span>
            <span>CLAIMSYNC</span>
          </div>
          <header className="signup-heading">
            <p className="eyebrow">Welcome back</p>
            <h2>Log in to CLAIMSYNC</h2>
            <p>Enter your account details to continue to your workspace.</p>
          </header>

          {notice && <p className="form-message success" role="status">{notice}</p>}

          <form className="signup-form login-form" onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => { setEmail(event.target.value); setError(""); }}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => { setPassword(event.target.value); setError(""); }}
                required
              />
            </div>

            {error && <p className="form-message error" role="alert">{error}</p>}

            <button className="signup-button" type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Log in"}
              {!loading && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <p className="auth-switch">New to CLAIMSYNC? <button type="button" onClick={onSwitchToSignup}>Create an account</button></p>
          <p className="signup-legal">Your account is protected by password verification and a signed session token.</p>
        </div>
      </section>
    </main>
  );
}
