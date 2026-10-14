import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT) || 5000;

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL. Copy backend/.env.example to backend/.env and configure PostgreSQL.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Hosted databases often require TLS. Configure provider-specific SSL
  // settings before deploying; do not blindly disable certificate checks.
});

const allowedOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: "10kb" }));

app.get("/health", async (_req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ status: "ok", database: "connected" });
  } catch (error) {
    next(error);
  }
});

app.post("/signup", async (req, res, next) => {
  try {
    const { name, email, password } = req.body ?? {};

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        message: "Name, email, and password are required.",
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || cleanName.length > 120) {
      return res.status(400).json({
        message: "Name must contain between 1 and 120 characters.",
      });
    }

    if (
      cleanEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    ) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }

    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({
        message: "Password must contain between 8 and 128 characters.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Never interpolate user input into SQL. Parameter placeholders protect
    // this query from SQL injection.
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, role, created_at`,
      [cleanName, cleanEmail, passwordHash]
    );

    return res.status(201).json({
      message: "Your account was created successfully.",
      user: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    return next(error);
  }
});

// Keep error details in server logs; do not send SQL or stack traces to clients.
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    message: "Something went wrong. Please try again.",
  });
});

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
