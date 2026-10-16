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

const app = createApp({ pool, passwordHasher: bcrypt });
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
