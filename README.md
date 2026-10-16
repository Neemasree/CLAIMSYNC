# CLAIMSYNC

**Priority-weighted insurance claim routing system**

CLAIMSYNC helps claims teams decide which claim needs attention first instead of relying only on first-in, first-out (FIFO) order. The planned priority score considers claim urgency, normalized claim value, and proximity to an SLA deadline. Claims are then routed to the appropriate team.

## Product goal

> Make claim handling priority-aware so urgent, high-value, or near-SLA claims are not buried in the queue.

## Stack

- **Frontend:** React, Vite, responsive CSS
- **Backend:** Node.js, Express, REST API
- **Database:** PostgreSQL
- **Priority queue:** Redis sorted sets (planned)
- **Authentication:** Signup password hashing is implemented; login, JWT, and role-based authorization are planned
- **SLA monitoring:** Scheduled checks and notifications (planned)

## Run the frontend

**Requirements:** Node.js 20+ and npm.

From the repository root:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The frontend defaults to `http://localhost:5000` for the API. To override it, create a root `.env` file:

```env
VITE_API_URL=http://localhost:5000
```

Never put database credentials or other secrets in frontend `VITE_*` variables; Vite exposes those values to browser code.

## Run the signup API

1. Create a PostgreSQL database named `claimsync`.
2. Apply the schema from the repository root:

   ```bash
   psql -d claimsync -f backend/schema.sql
   ```

3. Create `backend/.env` by copying `backend/.env.example`, then set a valid `DATABASE_URL`.
4. Install and start the API:

   ```bash
   cd backend
   npm install
   npm run dev
   ```

The API listens on port 5000 by default. `GET /health` checks database connectivity; `POST /signup` validates the submitted fields, hashes the password with bcrypt, and inserts the new user using a parameterized SQL query. New accounts receive the `agent` role by default; clients cannot choose their own role during signup.

## Automated checks

The GitHub Actions workflow in `.github/workflows/ci.yml` is configured to build the React frontend and run the backend signup tests on pushes and pull requests targeting `main`.

Run the API tests locally:

```bash
cd backend
npm install
npm test
```

The tests use a fake database pool and password hasher, so validation and API behavior can be tested without connecting to a real PostgreSQL database. They do **not** replace a real end-to-end database test.

## Current progress

- [x] React/Vite application scaffold and npm scripts
- [x] Responsive signup UI with client-side validation and loading/error/success feedback
- [x] Express app separated from server startup for testability
- [x] `GET /health` and `POST /signup` endpoints
- [x] Signup validation, normalized email, duplicate-email response, and safe error messages
- [x] PostgreSQL users schema with constraints and a default agent role
- [x] bcrypt password hashing and parameterized user insert
- [x] Automated API tests for validation, success, duplicates, and server errors
- [x] GitHub Actions workflow for frontend build and backend tests
- [ ] Confirm GitHub Actions succeeds and run the frontend build/tests
- [ ] Test signup against a configured PostgreSQL instance
- [ ] Login, JWT sessions, and role-based authorization
- [ ] Claim creation, team routing, and priority queue
- [ ] SLA monitoring, notifications, and deployment

**Current limitation:** The API needs a working `DATABASE_URL` and applied schema for real signup. The automated tests and CI workflow have been committed, but this environment has not executed them; check the Actions tab for their actual result.

## UI principles

The interface uses a restrained navy-and-blue palette, clear typography, consistent spacing, accessible focus states, responsive layouts, and explicit loading, error, and success feedback.

## Learning approach

Build one feature at a time, understand the frontend-to-backend-to-database flow, and validate each milestone before moving on. The priority-routing engine remains the core product differentiator; signup is the first supporting feature.
