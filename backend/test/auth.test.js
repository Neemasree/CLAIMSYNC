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

function makeApp(jwtSecret = "test-only-jwt-secret") {
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
  return createApp({ pool, passwordHasher, jwtSecret });
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

test("security headers are included on API responses", async () => {
  const response = await request(makeApp()).get("/me");
  assert.equal(response.status, 401);
  assert.equal(response.headers["x-content-type-options"], "nosniff");
  assert.equal(response.headers["x-frame-options"], "DENY");
  assert.equal(response.headers["referrer-policy"], "strict-origin-when-cross-origin");
  assert.equal(response.headers["permissions-policy"], "camera=(), microphone=(), geolocation=()");
});

test("CORS rejects browser origins outside the configured allowlist", async () => {
  const previous = process.env.FRONTEND_ORIGINS;
  process.env.FRONTEND_ORIGINS = "https://app.example.com";
  try {
    const response = await request(makeApp()).get("/me").set("Origin", "https://attacker.example");
    assert.equal(response.status, 403);
    assert.equal(response.body.message, "This origin is not allowed.");
  } finally {
    if (previous === undefined) delete process.env.FRONTEND_ORIGINS;
    else process.env.FRONTEND_ORIGINS = previous;
  }
});


test("POST /login rejects missing or malformed credentials before querying users", async () => {
  const app = makeApp();

  for (const body of [{}, { email: "   ", password: "secret" }, { email: "neema@example.com" }, { email: 42, password: "secret" }]) {
    const response = await request(app).post("/login").send(body);
    assert.equal(response.status, 400);
    assert.equal(response.body.message, "Email and password are required.");
  }
});

test("GET /me rejects a token whose signature has been tampered with", async () => {
  const app = makeApp();
  const login = await request(app).post("/login").send({
    email: user.email,
    password: "correct-horse",
  });
  assert.equal(login.status, 200);

  const token = login.body.token;
  const [header, payload, signature] = token.split(".");
  const replacement = signature[0] === "a" ? "b" : "a";
  const tamperedToken = `${header}.${payload}.${replacement}${signature.slice(1)}`;
  const response = await request(app).get("/me")
    .set("Authorization", `Bearer ${tamperedToken}`);

  assert.equal(response.status, 401);
  assert.equal(response.body.message, "Please log in again.");
});

test("GET /me rejects a token signed with a different JWT secret", async () => {
  const issuingApp = makeApp("issuer-secret");
  const verifyingApp = makeApp("different-verifier-secret");
  const login = await request(issuingApp).post("/login").send({
    email: user.email,
    password: "correct-horse",
  });
  assert.equal(login.status, 200);

  const response = await request(verifyingApp).get("/me")
    .set("Authorization", `Bearer ${login.body.token}`);

  assert.equal(response.status, 401);
  assert.equal(response.body.message, "Please log in again.");
});


test("malformed JSON bodies return a safe 400 response", async () => {
  const response = await request(makeApp())
    .post("/login")
    .set("Content-Type", "application/json")
    .send('{"email":');
  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { message: "Request body must contain valid JSON." });
});
