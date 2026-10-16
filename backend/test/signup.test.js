import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../app.js";

function setup({ queryImplementation, hashImplementation } = {}) {
  const queries = [];
  const pool = {
    async query(sql, values = []) {
      queries.push({ sql, values });
      if (queryImplementation) return queryImplementation(sql, values);
      if (sql === "SELECT 1") return { rows: [{ "?column?": 1 }] };
      return {
        rows: [{
          id: "user-123",
          name: values[0],
          email: values[1],
          role: "agent",
          created_at: "2026-10-16T00:00:00.000Z",
        }],
      };
    },
  };

  const passwordHasher = {
    async hash(password, rounds) {
      if (hashImplementation) return hashImplementation(password, rounds);
      return `test-hash-${password}-rounds-${rounds}`;
    },
  };

  return { app: createApp({ pool, passwordHasher }), queries };
}

const validUser = {
  name: "Neema Sree",
  email: "  NEEMA@example.com ",
  password: "correct-horse",
};

test("GET /health responds when the database can be reached", async () => {
  const { app } = setup();
  const response = await request(app).get("/health");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: "ok", database: "connected" });
});

test("POST /signup rejects missing fields before touching the database", async () => {
  const { app, queries } = setup();
  const response = await request(app).post("/signup").send({ email: "a@b.com" });

  assert.equal(response.status, 400);
  assert.match(response.body.message, /required/i);
  assert.equal(queries.length, 0);
});

test("POST /signup rejects an invalid email", async () => {
  const { app, queries } = setup();
  const response = await request(app).post("/signup").send({
    name: "Neema",
    email: "not-an-email",
    password: "correct-horse",
  });

  assert.equal(response.status, 400);
  assert.match(response.body.message, /valid email/i);
  assert.equal(queries.length, 0);
});

test("POST /signup rejects a short password", async () => {
  const { app, queries } = setup();
  const response = await request(app).post("/signup").send({
    name: "Neema",
    email: "neema@example.com",
    password: "short",
  });

  assert.equal(response.status, 400);
  assert.match(response.body.message, /8 and 128/i);
  assert.equal(queries.length, 0);
});

test("POST /signup normalizes email, hashes the password, and uses SQL parameters", async () => {
  const { app, queries } = setup();
  const response = await request(app).post("/signup").send(validUser);

  assert.equal(response.status, 201);
  assert.equal(response.body.user.email, "neema@example.com");
  assert.equal(response.body.user.role, "agent");
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /VALUES \(\$1, \$2, \$3\)/);
  assert.deepEqual(queries[0].values, [
    "Neema Sree",
    "neema@example.com",
    "test-hash-correct-horse-rounds-12",
  ]);
  assert.equal(JSON.stringify(response.body).includes("correct-horse"), false);
});

test("POST /signup returns 409 when the email is already registered", async () => {
  const duplicateError = Object.assign(new Error("duplicate"), { code: "23505" });
  const { app } = setup({
    queryImplementation: async () => { throw duplicateError; },
  });

  const response = await request(app).post("/signup").send(validUser);

  assert.equal(response.status, 409);
  assert.match(response.body.message, /already exists/i);
});

test("POST /signup does not expose database error details", async () => {
  const { app } = setup({
    queryImplementation: async () => { throw new Error("secret database detail"); },
  });

  const response = await request(app).post("/signup").send(validUser);

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    message: "Something went wrong. Please try again.",
  });
});
