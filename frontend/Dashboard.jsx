import { useCallback, useEffect, useState } from "react";
import "./Signup.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function Dashboard({ user, token, onLogout }) {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    policyholder: "", policyNumber: "", claimType: "Health", claimValue: "0",
    urgency: "normal", slaDueAt: "", description: "",
  });

  const loadClaims = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/claims`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to load claims.");
      setClaims(data.claims || []);
    } catch (requestError) {
      setError(requestError instanceof TypeError
        ? "Cannot reach the claims API. Check the backend connection."
        : requestError.message || "Unable to load claims.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadClaims(); }, [loadClaims]);

  async function createClaim(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_BASE_URL}/claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          claimValue: Number(form.claimValue),
          slaDueAt: form.slaDueAt ? new Date(form.slaDueAt).toISOString() : null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to create claim.");
      setNotice("Claim created successfully.");
      setForm({ policyholder: "", policyNumber: "", claimType: "Health", claimValue: "0", urgency: "normal", slaDueAt: "", description: "" });
      await loadClaims();
    } catch (requestError) {
      setError(requestError instanceof TypeError
        ? "Cannot reach the claims API. Check the backend connection."
        : requestError.message || "Unable to create claim.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(claim, status) {
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_BASE_URL}/claims/${claim.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to update claim status.");
      setNotice(`Claim status updated to ${status.replaceAll("_", " ")}.`);
      await loadClaims();
    } catch (requestError) {
      setError(requestError instanceof TypeError
        ? "Cannot reach the claims API. Check the backend connection."
        : requestError.message || "Unable to update claim status.");
    }
  }

  const money = (value) => new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(Number(value || 0));

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div className="brand dashboard-brand">
          <span className="brand-mark" aria-hidden="true">C</span>
          <span>CLAIMSYNC</span>
        </div>
        <div className="dashboard-header-actions">
          <span className="role-pill">{user.role.replaceAll("_", " ")}</span>
          <button className="logout-button" type="button" onClick={onLogout}>Log out</button>
        </div>
      </header>

      <section className="dashboard-content">
        <p className="story-eyebrow dashboard-eyebrow">Claims operations</p>
        <h1>Welcome back, {user.name.split(" ")[0]}.</h1>
        <p className="dashboard-intro">Capture claims, prioritize urgent cases, and keep SLA deadlines visible.</p>

        <div className="claims-metrics" aria-label="Claims summary">
          <article><span>Total claims</span><strong>{claims.length}</strong></article>
          <article><span>Urgent</span><strong>{claims.filter((claim) => ["high", "critical"].includes(claim.urgency)).length}</strong></article>
          <article><span>Open</span><strong>{claims.filter((claim) => !["approved", "rejected", "closed"].includes(claim.status)).length}</strong></article>
        </div>

        {error && <p className="form-message error" role="alert">{error}</p>}
        {notice && <p className="form-message success" role="status">{notice}</p>}

        <section className="claims-panel">
          <div className="claims-section-heading">
            <div><p className="eyebrow">New intake</p><h2>Create a claim</h2></div>
            <p>Required fields are marked in the form.</p>
          </div>
          <form className="claim-form" onSubmit={createClaim}>
            <div className="field"><label htmlFor="claim-policyholder">Policyholder</label><input id="claim-policyholder" value={form.policyholder} onChange={(e) => setForm({ ...form, policyholder: e.target.value })} maxLength={120} required /></div>
            <div className="field"><label htmlFor="claim-policy-number">Policy number</label><input id="claim-policy-number" value={form.policyNumber} onChange={(e) => setForm({ ...form, policyNumber: e.target.value })} maxLength={80} required /></div>
            <div className="field"><label htmlFor="claim-type">Claim type</label><select id="claim-type" value={form.claimType} onChange={(e) => setForm({ ...form, claimType: e.target.value })} required><option>Health</option><option>Motor</option><option>Property</option><option>Life</option><option>Travel</option><option>Other</option></select></div>
            <div className="field"><label htmlFor="claim-value">Claim value (₹)</label><input id="claim-value" type="number" min="0" max="1000000000000" step="0.01" value={form.claimValue} onChange={(e) => setForm({ ...form, claimValue: e.target.value })} required /></div>
            <div className="field"><label htmlFor="claim-urgency">Urgency</label><select id="claim-urgency" value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></div>
            <div className="field"><label htmlFor="claim-sla">SLA deadline</label><input id="claim-sla" type="datetime-local" value={form.slaDueAt} onChange={(e) => setForm({ ...form, slaDueAt: e.target.value })} /></div>
            <div className="field claim-description"><label htmlFor="claim-description">Description</label><textarea id="claim-description" rows="3" maxLength={5000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <button className="signup-button claim-submit" type="submit" disabled={saving}>{saving ? "Saving claim…" : "Create claim"} <span aria-hidden="true">→</span></button>
          </form>
        </section>

        <section className="claims-panel claims-list-panel">
          <div className="claims-section-heading">
            <div><p className="eyebrow">Work queue</p><h2>Claims queue</h2></div>
            <button className="logout-button" type="button" onClick={loadClaims} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
          </div>
          {loading ? <p className="claims-empty">Loading claims…</p> : claims.length === 0 ? (
            <p className="claims-empty">No claims yet. Create the first claim using the form above.</p>
          ) : (
            <div className="claims-table-wrap">
              <table className="claims-table">
                <thead><tr><th>Policyholder</th><th>Type / Policy</th><th>Value</th><th>Priority score</th><th>Urgency</th><th>Status</th><th>SLA deadline</th>{["admin", "team_lead"].includes(user.role) && <th>Update</th>}</tr></thead>
                <tbody>{claims.map((claim) => <tr key={claim.id}>
                  <td><strong>{claim.policyholder}</strong><small>{claim.created_by_name || "Claim owner"}</small></td>
                  <td>{claim.claim_type}<small>{claim.policy_number}</small></td>
                  <td>{money(claim.claim_value)}</td>
                  <td><span className="claim-tag priority-score">{Number.isFinite(Number(claim.priority_score)) ? `${claim.priority_score}/100` : "—"}</span></td>
                  <td><span className={`claim-tag urgency-${claim.urgency}`}>{claim.urgency}</span></td>
                  <td><span className="claim-tag">{claim.status.replaceAll("_", " ")}</span></td>
                  <td>{claim.sla_due_at ? <><span>{new Date(claim.sla_due_at).toLocaleString()}</span><small className={new Date(claim.sla_due_at).getTime() < Date.now() && !["approved", "rejected", "closed"].includes(claim.status) ? "sla-overdue" : new Date(claim.sla_due_at).getTime() < Date.now() + 24 * 60 * 60 * 1000 && !["approved", "rejected", "closed"].includes(claim.status) ? "sla-due-soon" : "sla-on-track"}>{["approved", "rejected", "closed"].includes(claim.status) ? "Resolved" : new Date(claim.sla_due_at).getTime() < Date.now() ? "Overdue" : new Date(claim.sla_due_at).getTime() < Date.now() + 24 * 60 * 60 * 1000 ? "Due within 24 hours" : "On track"}</small></> : "Not set"}</td>
                  {["admin", "team_lead"].includes(user.role) && <td><select aria-label={`Status for ${claim.policyholder}`} value={claim.status} onChange={(e) => updateStatus(claim, e.target.value)}><option value="submitted">Submitted</option><option value="in_review">In review</option><option value="awaiting_information">Awaiting information</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="closed">Closed</option></select></td>}
                </tr>)}</tbody>
              </table>
            </div>
          )}
        </section>

        <section className="account-panel">
          <div><p className="account-label">Signed in as</p><strong>{user.name}</strong><p>{user.email}</p></div>
          <span className="role-pill">{user.role.replaceAll("_", " ")}</span>
        </section>
      </section>
    </main>
  );
}
