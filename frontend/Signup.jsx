import { useState } from "react";
import "./Signup.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function Signup() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const name = formData.name.trim();
    const email = formData.email.trim();

    if (!name || !email || !formData.password) {
      setError("Please complete all fields.");
      return;
    }

    if (formData.password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password: formData.password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "We couldn't create your account. Please try again.");
      }

      setSuccess(data.message || "Your account was created successfully.");
      setFormData({ name: "", email: "", password: "" });
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? "Unable to connect to CLAIMSYNC. Please check that the server is running."
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
          <p className="story-eyebrow">Claims, handled intelligently</p>
          <h1>Make room for <span>what matters most.</span></h1>
          <p className="story-description">
            A smarter way for claims teams to stay organized, act on urgent
            cases, and keep service deadlines in view.
          </p>

          <ul className="story-points">
            <li><span className="point-check" aria-hidden="true">✓</span> Keep priority claims in focus</li>
            <li><span className="point-check" aria-hidden="true">✓</span> Track deadlines and service levels</li>
            <li><span className="point-check" aria-hidden="true">✓</span> Route work to the right team</li>
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
            <p className="eyebrow">Get started</p>
            <h2>Create your account</h2>
            <p>Set up your account to get started with CLAIMSYNC.</p>
          </header>

          <form className="signup-form" onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="signup-name">Full name</label>
              <input
                id="signup-name"
                type="text"
                name="name"
                placeholder="Enter your full name"
                autoComplete="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="signup-email">Work email</label>
              <input
                id="signup-email"
                type="email"
                name="email"
                placeholder="you@company.com"
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="signup-password">Password</label>
              <input
                id="signup-password"
                type="password"
                name="password"
                placeholder="Create a password"
                autoComplete="new-password"
                minLength={8}
                value={formData.password}
                onChange={handleChange}
                aria-describedby="password-hint"
                required
              />
              <span className="field-hint" id="password-hint">Use at least 8 characters.</span>
            </div>

            {error && (
              <p className="form-message error" role="alert">
                {error}
              </p>
            )}

            {success && (
              <p className="form-message success" role="status">
                {success}
              </p>
            )}

            <button className="signup-button" type="submit" disabled={loading}>
              {loading ? "Creating account…" : "Create account"}
              {!loading && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <p className="signup-legal">
            By creating an account, you agree to use CLAIMSYNC responsibly.
            Keep your login details secure.
          </p>
        </div>
      </section>
    </main>
  );
}

export default Signup;
