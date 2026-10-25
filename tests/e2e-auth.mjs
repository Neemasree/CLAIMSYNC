import { chromium } from "playwright";
import assert from "node:assert/strict";

const baseUrl = process.env.E2E_BASE_URL || "http://localhost:5173";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Create your account" }).waitFor();

  // Responsive signup and client-side validation.
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true,
    "signup page should not overflow horizontally on mobile");
  await page.getByRole("button", { name: /Create account/ }).click();
  await page.getByRole("alert").waitFor();
  assert.match(await page.getByRole("alert").innerText(), /Please complete all fields/);

  // Real browser -> React -> Express -> PostgreSQL signup flow.
  const email = `qa-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const password = "TestPassword123!";
  await page.getByLabel("Full name").fill("QA End To End");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /Create account/ }).click();

  // Signup intentionally hands off to the login screen; it does not auto-login.
  await page.getByRole("heading", { name: "Log in to CLAIMSYNC" }).waitFor();
  await page.getByRole("status").waitFor();
  assert.match(await page.getByRole("status").innerText(), /Account created successfully/i);
  assert.equal(await page.getByLabel("Email address").inputValue(), email);

  // Correct credentials must establish a session and show the authenticated UI.
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /Log in/ }).click();
  await page.getByRole("heading", { name: "Welcome back, QA." }).waitFor();
  await page.getByText(email).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true,
    "dashboard should not overflow horizontally on mobile");

  // Real browser -> React -> authenticated API -> PostgreSQL claim intake.
  const policyNumber = `POL-QA-${Date.now()}`;
  await page.getByLabel("Policyholder").fill("QA Policyholder");
  await page.getByLabel("Policy number").fill(policyNumber);
  await page.getByLabel("Claim type").selectOption("Health");
  await page.getByLabel("Claim value (₹)").fill("25000");
  await page.getByLabel("Urgency").selectOption("critical");
  await page.getByRole("button", { name: /Create claim/ }).click();
  await page.getByRole("status").filter({ hasText: "Claim created successfully" }).waitFor();
  await page.getByText(policyNumber).waitFor();
  await page.getByText("QA Policyholder").waitFor();
  const totalClaimsText = await page.locator(".claims-metrics article").first().locator("strong").innerText();
  assert.equal(Number(totalClaimsText) >= 1, true,
    `claim summary should reflect the newly created claim (received: ${totalClaimsText})`);

  // Session must survive a browser reload via sessionStorage + /me.
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Welcome back, QA." }).waitFor();

  // Logout must clear the token and return to login.
  await page.getByRole("button", { name: "Log out" }).click();
  await page.getByRole("heading", { name: "Log in to CLAIMSYNC" }).waitFor();

  // Invalid credentials must be surfaced without opening the dashboard.
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: /Log in/ }).click();
  await page.getByRole("alert").waitFor();
  assert.match(await page.getByRole("alert").innerText(), /Invalid email or password/i);

  // Duplicate registration must show a useful error instead of creating another account.
  await page.getByRole("button", { name: /Create an account/ }).click();
  await page.getByLabel("Full name").fill("QA Duplicate");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /Create account/ }).click();
  await page.getByRole("alert").waitFor();
  assert.match(await page.getByRole("alert").innerText(), /already exists/i);

  assert.deepEqual(pageErrors, [], "browser should not report uncaught JavaScript errors");
  console.log("PASS: mobile signup validation, persisted signup, login, claim creation and queue visibility, session restore, logout, invalid login, duplicate signup, no browser exceptions");
} finally {
  await browser.close();
}
