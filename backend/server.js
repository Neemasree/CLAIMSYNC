import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";
import { createApp } from "./app.js";

const { Pool } = pg;
const port = Number(process.env.PORT) || 5000;

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL. Copy backend/.env.example to backend/.env and configure PostgreSQL.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Configure provider-specific TLS settings before deploying to a hosted DB.
});

// Idempotent SLA monitor: one durable notification per recipient and breached claim.
export async function runSlaMonitor(database = pool) {
  const result = await database.query(
    "INSERT INTO notifications (user_id, claim_id, type, message) " +
    "SELECT recipients.id, c.id, 'sla_breached', " +
    "'SLA breached for claim ' || c.policy_number || ' (' || c.policyholder || ')' " +
    "FROM claims c CROSS JOIN LATERAL (" +
    "  SELECT c.assigned_to AS id WHERE c.assigned_to IS NOT NULL " +
    "  UNION SELECT u.id FROM users u WHERE u.role IN ('team_lead', 'admin')" +
    ") recipients " +
    "WHERE c.sla_due_at IS NOT NULL AND c.sla_due_at < NOW() " +
    "AND c.status NOT IN ('approved', 'rejected', 'closed') " +
    "ON CONFLICT (user_id, claim_id, type) DO NOTHING RETURNING id"
  );
  return result.rowCount ?? result.rows.length;
}

const app = createApp({ pool, passwordHasher: bcrypt });
const slaMonitorInterval = setInterval(() => {
  runSlaMonitor().catch((error) => console.error("SLA monitor failed:", error));
}, 60_000);
slaMonitorInterval.unref();
runSlaMonitor().catch((error) => console.error("Initial SLA monitor failed:", error));

const server = app.listen(port, () => {
  console.log(`CLAIMSYNC API listening on http://localhost:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
