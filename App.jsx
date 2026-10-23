import { useEffect, useState } from "react";
import Signup from "./frontend/Signup.jsx";
import Login from "./frontend/Login.jsx";
import Dashboard from "./frontend/Dashboard.jsx";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function App() {
  const [view, setView] = useState("checking");
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [initialEmail, setInitialEmail] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const savedToken = sessionStorage.getItem("claimsync_token");
      if (!savedToken) {
        if (!cancelled) setView("signup");
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/me`, {
          headers: { Authorization: `Bearer ${savedToken}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error("Session expired");

        if (!cancelled) {
          setToken(savedToken);
          setUser(data.user);
          setView("dashboard");
        }
      } catch {
        sessionStorage.removeItem("claimsync_token");
        if (!cancelled) setView("login");
      }
    }

    restoreSession();
    return () => { cancelled = true; };
  }, []);

  function handleSignupSuccess(email) {
    setInitialEmail(email);
    setNotice("Account created successfully. Log in with the email and password you just registered.");
    setView("login");
  }

  function handleAuthenticated(newToken, authenticatedUser) {
    sessionStorage.setItem("claimsync_token", newToken);
    setToken(newToken);
    setUser(authenticatedUser);
    setNotice("");
    setView("dashboard");
  }

  function handleLogout() {
    sessionStorage.removeItem("claimsync_token");
    setToken("");
    setUser(null);
    setInitialEmail(user?.email || "");
    setNotice("You've been logged out. Sign in again to continue.");
    setView("login");
  }

  if (view === "checking") {
    return <main className="auth-loading" aria-live="polite">Loading your CLAIMSYNC workspace…</main>;
  }

  if (view === "dashboard" && user && token) {
    return <Dashboard user={user} token={token} onLogout={handleLogout} />;
  }

  if (view === "login") {
    return (
      <Login
        initialEmail={initialEmail}
        notice={notice}
        onAuthenticated={handleAuthenticated}
        onSwitchToSignup={() => { setNotice(""); setView("signup"); }}
      />
    );
  }

  return (
    <Signup
      onSignupSuccess={handleSignupSuccess}
      onSwitchToLogin={() => { setNotice(""); setView("login"); }}
    />
  );
}
