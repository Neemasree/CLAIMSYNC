import "./Signup.css";

export default function Dashboard({ user, onLogout }) {
  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div className="brand dashboard-brand">
          <span className="brand-mark" aria-hidden="true">C</span>
          <span>CLAIMSYNC</span>
        </div>
        <button className="logout-button" type="button" onClick={onLogout}>Log out</button>
      </header>

      <section className="dashboard-content">
        <p className="story-eyebrow dashboard-eyebrow">Your workspace</p>
        <h1>Welcome back, {user.name.split(" ")[0]}.</h1>
        <p className="dashboard-intro">You're signed in to CLAIMSYNC. Your claims workspace starts here.</p>

        <div className="dashboard-grid">
          <article className="dashboard-tile">
            <span className="dashboard-tile-icon" aria-hidden="true">◎</span>
            <h2>Claims overview</h2>
            <p>Your claims overview will appear here as claim management is added.</p>
            <span className="tile-status">Coming next</span>
          </article>
          <article className="dashboard-tile">
            <span className="dashboard-tile-icon" aria-hidden="true">↗</span>
            <h2>Priority routing</h2>
            <p>Surface urgent claims using urgency, claim value, and SLA deadlines.</p>
            <span className="tile-status">Planned feature</span>
          </article>
          <article className="dashboard-tile">
            <span className="dashboard-tile-icon" aria-hidden="true">◷</span>
            <h2>SLA monitoring</h2>
            <p>Keep service deadlines visible and help teams act before they are missed.</p>
            <span className="tile-status">Planned feature</span>
          </article>
        </div>

        <section className="account-panel">
          <div>
            <p className="account-label">Signed in as</p>
            <strong>{user.name}</strong>
            <p>{user.email}</p>
          </div>
          <span className="role-pill">{user.role.replaceAll("_", " ")}</span>
        </section>
      </section>
    </main>
  );
}
