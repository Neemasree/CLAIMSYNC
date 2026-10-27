import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { createHmac, timingSafeEqual } from "node:crypto";

const DEV_JWT_SECRET = "claimsync-local-development-secret-change-before-deploy";

function signToken(user, secret) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const now = Math.floor(Date.now() / 1000);
  const payload = encode({
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: now,
    exp: now + 60 * 60,
  });
  const unsignedToken = `${header}.${payload}`;
  const signature = createHmac("sha256", secret).update(unsignedToken).digest("base64url");
  return `${unsignedToken}.${signature}`;
}

function verifyToken(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const unsignedToken = `${parts[0]}.${parts[1]}`;
  const expected = createHmac("sha256", secret).update(unsignedToken).digest();
  let actual;

  try {
    actual = Buffer.from(parts[2], "base64url");
  } catch {
    return null;
  }

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (header.alg !== "HS256" || !payload.sub || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function createApp({
  pool,
  passwordHasher = bcrypt,
  jwtSecret = process.env.JWT_SECRET || (process.env.NODE_ENV === "production" ? "" : DEV_JWT_SECRET),
} = {}) {
  if (!pool) throw new Error("createApp requires a database pool.");
  const app = express();
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
        return res.status(400).json({ message: "Name, email, and password are required." });
      }

      const cleanName = name.trim();
      const cleanEmail = email.trim().toLowerCase();

      if (!cleanName || cleanName.length > 120) {
        return res.status(400).json({ message: "Name must contain between 1 and 120 characters." });
      }
      if (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ message: "Enter a valid email address." });
      }
      if (password.length < 8 || password.length > 128) {
        return res.status(400).json({ message: "Password must contain between 8 and 128 characters." });
      }

      const passwordHash = await passwordHasher.hash(password, 12);
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
        return res.status(409).json({ message: "An account with this email already exists." });
      }
      return next(error);
    }
  });

  app.post("/login", async (req, res, next) => {
    try {
      const { email, password } = req.body ?? {};
      if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
        return res.status(400).json({ message: "Email and password are required." });
      }
      if (!jwtSecret) {
        return res.status(500).json({ message: "Authentication is not configured on this server." });
      }

      const cleanEmail = email.trim().toLowerCase();
      const result = await pool.query(
        "SELECT id, name, email, role, password_hash FROM users WHERE email = $1 LIMIT 1",
        [cleanEmail]
      );
      const user = result.rows[0];
      const passwordMatches = user ? await passwordHasher.compare(password, user.password_hash) : false;

      if (!passwordMatches) {
        return res.status(401).json({ message: "Invalid email or password." });
      }

      const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
      return res.status(200).json({
        message: "Login successful.",
        token: signToken(safeUser, jwtSecret),
        user: safeUser,
      });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/me", async (req, res, next) => {
    try {
      const authorization = req.get("authorization") || "";
      const match = authorization.match(/^Bearer\s+(.+)$/i);
      const payload = match && jwtSecret ? verifyToken(match[1], jwtSecret) : null;
      if (!payload) return res.status(401).json({ message: "Please log in again." });

      const result = await pool.query(
        "SELECT id, name, email, role FROM users WHERE id = $1 LIMIT 1",
        [payload.sub]
      );
      if (!result.rows[0]) return res.status(401).json({ message: "Please log in again." });
      return res.status(200).json({ user: result.rows[0] });
    } catch (error) {
      return next(error);
    }
  });


  function authenticatedUser(req) {
    const authorization = req.get("authorization") || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return match && jwtSecret ? verifyToken(match[1], jwtSecret) : null;
  }

  app.get("/claims", async (req, res, next) => {
    try {
      const user = authenticatedUser(req);
      if (!user) return res.status(401).json({ message: "Please log in again." });
      const sharedQueue = user.role === "admin" || user.role === "team_lead";
      const sql = "SELECT c.*, creator.name AS created_by_name, (" +
        "CASE c.urgency WHEN 'critical' THEN 55 WHEN 'high' THEN 40 WHEN 'normal' THEN 25 ELSE 10 END + " +
        "CASE WHEN c.claim_value >= 100000 THEN 20 WHEN c.claim_value >= 25000 THEN 12 WHEN c.claim_value >= 5000 THEN 6 ELSE 0 END + " +
        "CASE WHEN c.sla_due_at IS NULL THEN 0 WHEN c.sla_due_at <= NOW() AND c.status NOT IN ('approved', 'rejected', 'closed') THEN 25 " +
        "WHEN c.sla_due_at <= NOW() + INTERVAL '24 hours' AND c.status NOT IN ('approved', 'rejected', 'closed') THEN 20 " +
        "WHEN c.sla_due_at <= NOW() + INTERVAL '72 hours' AND c.status NOT IN ('approved', 'rejected', 'closed') THEN 10 ELSE 0 END" +
        ") AS priority_score FROM claims c JOIN users creator ON creator.id = c.created_by " +
        (sharedQueue ? "" : "WHERE c.created_by = $1 OR c.assigned_to = $1 ") +
        "ORDER BY priority_score DESC, c.sla_due_at ASC NULLS LAST, c.created_at ASC";
      const result = sharedQueue ? await pool.query(sql) : await pool.query(sql, [user.sub]);
      return res.status(200).json({ claims: result.rows });
    } catch (error) { return next(error); }
  });

  app.post("/claims", async (req, res, next) => {
    try {
      const user = authenticatedUser(req);
      if (!user) return res.status(401).json({ message: "Please log in again." });
      const body = req.body ?? {};
      const policyholder = typeof body.policyholder === "string" ? body.policyholder.trim() : "";
      const policyNumber = typeof body.policyNumber === "string" ? body.policyNumber.trim() : "";
      const claimType = typeof body.claimType === "string" ? body.claimType.trim() : "";
      const description = typeof body.description === "string" ? body.description.trim() : "";
      const urgency = body.urgency ?? "normal";
      const claimValue = body.claimValue === undefined ? 0 : Number(body.claimValue);
      const slaDueAt = body.slaDueAt || null;
      if (!policyholder || policyholder.length > 120) return res.status(400).json({ message: "Policyholder must contain between 1 and 120 characters." });
      if (!policyNumber || policyNumber.length > 80) return res.status(400).json({ message: "Policy number must contain between 1 and 80 characters." });
      if (!claimType || claimType.length > 80) return res.status(400).json({ message: "Claim type must contain between 1 and 80 characters." });
      if (!["low", "normal", "high", "critical"].includes(urgency)) return res.status(400).json({ message: "Urgency must be low, normal, high, or critical." });
      if (!Number.isFinite(claimValue) || claimValue < 0 || claimValue > 1000000000000) return res.status(400).json({ message: "Claim value must be a non-negative number within the supported limit." });
      if (description.length > 5000) return res.status(400).json({ message: "Description must be at most 5000 characters." });
      if (slaDueAt && (typeof slaDueAt !== "string" || Number.isNaN(Date.parse(slaDueAt)))) return res.status(400).json({ message: "SLA deadline must be a valid date." });
      const result = await pool.query(
        "INSERT INTO claims (policyholder, policy_number, claim_type, description, claim_value, urgency, sla_due_at, created_by, assigned_to) " +
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, " +
        "(SELECT candidate.id FROM users candidate WHERE candidate.role = 'agent' " +
        "ORDER BY (SELECT COUNT(*) FROM claims active_claim " +
        "WHERE active_claim.assigned_to = candidate.id " +
        "AND active_claim.status NOT IN ('approved', 'rejected', 'closed')), candidate.created_at ASC, candidate.id ASC LIMIT 1)) RETURNING *",
        [policyholder, policyNumber, claimType, description || null, claimValue, urgency, slaDueAt, user.sub]
      );
      return res.status(201).json({ message: "Claim created successfully.", claim: result.rows[0] });
    } catch (error) {
      if (error.code === "23505") return res.status(409).json({ message: "A claim with this policy number already exists." });
      return next(error);
    }
  });

  app.patch("/claims/:id/status", async (req, res, next) => {
    try {
      const user = authenticatedUser(req);
      if (!user) return res.status(401).json({ message: "Please log in again." });
      if (!["admin", "team_lead"].includes(user.role)) return res.status(403).json({ message: "Only team leads and admins can update claim status." });
      const id = req.params.id;
      const status = req.body?.status;
      const allowedStatuses = ["submitted", "in_review", "awaiting_information", "approved", "rejected", "closed"];
      if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ message: "Invalid claim ID." });
      if (!allowedStatuses.includes(status)) return res.status(400).json({ message: "Choose a valid claim status." });
      const result = await pool.query("UPDATE claims SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *", [status, id]);
      if (!result.rows[0]) return res.status(404).json({ message: "Claim not found." });
      return res.status(200).json({ message: "Claim status updated successfully.", claim: result.rows[0] });
    } catch (error) { return next(error); }
  });

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  });

  return app;
}
