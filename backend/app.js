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
      if (cleanEmail.length > 254 || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(cleanEmail)) {
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
      const match = authorization.match(/^Bearer\\s+(.+)$/i);
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

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  });

  return app;
}
