import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";

// Keeping app creation separate from app.listen() lets us test routes
// without starting a real server or connecting to a real database.
export function createApp({ pool, passwordHasher = bcrypt }) {
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

      const passwordHash = await passwordHasher.hash(password, 12);

      // Parameterized queries keep user-provided values out of SQL syntax.
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

  // Do not expose SQL details or stack traces to API clients.
  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({
      message: "Something went wrong. Please try again.",
    });
  });

  return app;
}
