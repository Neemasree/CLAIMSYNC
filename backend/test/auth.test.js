import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../app.js";

const user = {
  id: "user-123",
  name: "Neema Sree",
  email: "neema@example.com",
  role: "agent",
  password_hash: "stored-hash",
};

function makeApp() {
  const pool = {
    async query(sql) {
      if (sql.includes("WHERE email = $1")) return { rows: [user] };
      if (sql.includes("WHERE id = $1")) {
        return { rows: [{ id: user.id, name: user.name, email: user.email, role: user.role }] };
      }
      return { rows: [] };
    },
  };
  const passwordHasher = {
    async hash(value) { return `hash-${value}`; },
    async compare(value, hash) { return value === "correct-horse" && hash === "stored-hash"; },
  };
  return createApp({ pool, passwordHasher, jwtSecret: "test-only-jwt-secret" });
}

test("POST /login issues a JWT for valid credentials without exposing the password hash", async () => {
  const app = makeApp();
  const response = await request(app).post("/login").send({
    email: " NEEMA@example.com ",
    password: "correct-horse",
  });

  assert.equal(response.status, 200);
  assert.ok(response.body.token);
  assert.equal(response.body.user.email, "neema@example.com");
  assert.equal(JSON.stringify(response.body).includes("password_hash"), false);
});

test("POST /login rejects invalid credentials", async () => {
  const app = makeApp();
  const response = await request(app).post("/login").send({
    email: "neema@example.com",
    password: "wrong-password",
  });

  assert.equal(response.status, 401);
  assert.equal(response.body.message, "Invalid email or password.");
});

test("GET /me validates the JWT and returns the current user", async () => {
  const app = makeApp();
  const login = await request(app).post("/login").send({
    email: user.email,
    password: "correct-horse",
  });
  assert.equal(login.status, 200);

  const me = await request(app).get("/me")
    .set("Authorization", `Bearer ${login.body.token}`);
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, user.email);

  const invalid = await request(app).get("/me");
  assert.equal(invalid.status, 401);
});
