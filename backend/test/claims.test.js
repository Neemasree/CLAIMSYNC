import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../app.js";

const users = {
  agent: { id: "11111111-1111-4111-8111-111111111111", name: "QA Agent", email: "agent@example.com", role: "agent", password_hash: "stored" },
  lead: { id: "22222222-2222-4222-8222-222222222222", name: "QA Lead", email: "lead@example.com", role: "team_lead", password_hash: "stored" },
};
const sampleClaim = {
  id: "33333333-3333-4333-8333-333333333333",
  policyholder: "Jordan Lee",
  policy_number: "POL-123",
  claim_type: "Health",
  description: null,
  claim_value: "1200.00",
  urgency: "critical",
  status: "submitted",
  sla_due_at: null,
  created_by: users.agent.id,
  assigned_to: null,
};

function setup() {
  const queries = [];
  const pool = {
    async query(sql, values = []) {
      queries.push({ sql, values });
      if (sql.includes("WHERE email = $1")) {
        const user = Object.values(users).find((item) => item.email === values[0]);
        return { rows: user ? [user] : [] };
      }
      if (sql.includes("INSERT INTO claims")) {
        return { rows: [{ ...sampleClaim, policyholder: values[0], policy_number: values[1], claim_type: values[2], description: values[3], claim_value: String(values[4]), urgency: values[5], sla_due_at: values[6], created_by: values[7] }] };
      }
      if (sql.includes("FROM claims")) return { rows: [sampleClaim] };
      if (sql.includes("WITH previous AS")) return { rows: [{ ...sampleClaim, status: values[0], audit_entries_written: "1" }] };
      if (sql.includes("FROM claim_audit")) return { rows: [{ id: "44444444-4444-4444-8444-444444444444", claim_id: values[0], action: "status_changed", previous_status: "submitted", new_status: "in_review", actor_name: "QA Lead" }] };
      return { rows: [] };
    },
  };
  const app = createApp({
    pool,
    passwordHasher: { async compare(password, hash) { return password === "correct-password" && hash === "stored"; }, async hash(value) { return value; } },
    jwtSecret: "claim-tests-only-secret",
  });
  return { app, queries };
}

async function tokenFor(app, email) {
  const response = await request(app).post("/login").send({ email, password: "correct-password" });
  assert.equal(response.status, 200);
  return response.body.token;
}

test("claims queue requires a valid bearer token", async () => {
  const { app } = setup();
  const response = await request(app).get("/claims");
  assert.equal(response.status, 401);
});

test("agent can create a claim with parameterized SQL and see the queue", async () => {
  const { app, queries } = setup();
  const token = await tokenFor(app, users.agent.email);
  const response = await request(app).post("/claims")
    .set("Authorization", `Bearer ${token}`)
    .send({ policyholder: " Jordan Lee ", policyNumber: "POL-123", claimType: "Health", claimValue: 1200, urgency: "critical" });

  assert.equal(response.status, 201);
  assert.equal(response.body.claim.policyholder, "Jordan Lee");
  const insert = queries.find((item) => item.sql.includes("INSERT INTO claims"));
  assert.ok(insert);
  assert.match(insert.sql, /assigned_to/);
  assert.match(insert.sql, /candidate\.role = 'agent'/);
  assert.match(insert.sql, /COUNT\(\*\)/);
  assert.equal(insert.values[7], users.agent.id);

  const queue = await request(app).get("/claims").set("Authorization", `Bearer ${token}`);
  assert.equal(queue.status, 200);
  assert.equal(queue.body.claims[0].urgency, "critical");
  const queueQuery = queries.find((item) => item.sql.includes("FROM claims c JOIN users"));
  assert.ok(queueQuery.sql.includes("AS priority_score"));
  assert.match(queueQuery.sql, /ORDER BY priority_score DESC/);
  assert.match(queueQuery.sql, /INTERVAL '24 hours'/);
});

test("claim creation validates urgency and value before database writes", async () => {
  const { app, queries } = setup();
  const token = await tokenFor(app, users.agent.email);
  const before = queries.filter((item) => item.sql.includes("INSERT INTO claims")).length;
  const badUrgency = await request(app).post("/claims")
    .set("Authorization", `Bearer ${token}`)
    .send({ policyholder: "Jordan Lee", policyNumber: "POL-124", claimType: "Health", urgency: "immediate", claimValue: 1 });
  const badValue = await request(app).post("/claims")
    .set("Authorization", `Bearer ${token}`)
    .send({ policyholder: "Jordan Lee", policyNumber: "POL-125", claimType: "Health", urgency: "high", claimValue: -1 });
  assert.equal(badUrgency.status, 400);
  assert.equal(badValue.status, 400);
  assert.equal(queries.filter((item) => item.sql.includes("INSERT INTO claims")).length, before);
});

test("only team leads and admins can update claim status", async () => {
  const { app } = setup();
  const agentToken = await tokenFor(app, users.agent.email);
  const denied = await request(app).patch(`/claims/${sampleClaim.id}/status`)
    .set("Authorization", `Bearer ${agentToken}`).send({ status: "in_review" });
  assert.equal(denied.status, 403);

  const leadToken = await tokenFor(app, users.lead.email);
  const allowed = await request(app).patch(`/claims/${sampleClaim.id}/status`)
    .set("Authorization", `Bearer ${leadToken}`).send({ status: "in_review" });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.claim.status, "in_review");
});


test("team lead status changes are written to the claim audit trail", async () => {
  const { app, queries } = setup();
  const leadToken = await tokenFor(app, users.lead.email);
  const response = await request(app).patch(`/claims/${sampleClaim.id}/status`)
    .set("Authorization", `Bearer ${leadToken}`).send({ status: "in_review" });
  assert.equal(response.status, 200);
  assert.equal(response.body.claim.audit_entries_written, "1");
  const statement = queries.find((item) => item.sql.includes("WITH previous AS"));
  assert.ok(statement.sql.includes("INSERT INTO claim_audit"));
  assert.equal(statement.values[2], users.lead.id);
});

test("agents can read history only for claims in their scope", async () => {
  const { app, queries } = setup();
  const agentToken = await tokenFor(app, users.agent.email);
  const response = await request(app).get(`/claims/${sampleClaim.id}/history`)
    .set("Authorization", `Bearer ${agentToken}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.history[0].new_status, "in_review");
  const historyQuery = queries.find((item) => item.sql.includes("FROM claim_audit"));
  assert.match(historyQuery.sql, /c\.created_by = \$2 OR c\.assigned_to = \$2/);
});
