# CLAIMSYNC

**Priority-weighted insurance claim routing system**

CLAIMSYNC helps claims teams decide which claim needs attention first instead of relying only on first-in, first-out (FIFO) order. The planned priority score considers claim urgency, normalized claim value, and proximity to an SLA deadline. Claims are then routed to the appropriate team.

## Product goal

> Make claim handling priority-aware so urgent, high-value, or near-SLA claims are not buried in the queue.

## Planned stack

- **Frontend:** React, Vite, responsive CSS
- **Backend:** Node.js, Express, REST API
- **Database:** PostgreSQL
- **Priority queue:** Redis sorted sets (planned)
- **Authentication:** Password hashing, JWT, role-based access control (planned)
- **SLA monitoring:** Scheduled checks and notifications (planned)

## Run the frontend

**Requirements:** Node.js 18+ and npm.

1. Clone this repository.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open the local URL printed by Vite in your terminal.

To change the backend URL later, create a local `.env` file with:

```env
VITE_API_URL=http://localhost:5000
```

Do not put passwords, database credentials, or other secrets in frontend environment variables. Vite exposes `VITE_*` variables to browser code.

## UI principles

The interface uses a restrained navy-and-blue palette, clear typography, consistent spacing, accessible focus states, responsive layouts, and explicit loading, error, and success feedback.

## Current progress

- [x] React/Vite application scaffold and npm scripts
- [x] Signup form component and responsive page styling
- [x] Client-side required-field and password-length checks
- [x] Loading, error, and success feedback in the signup UI
- [x] Vite React configuration and run instructions
- [ ] Express signup endpoint and request validation
- [ ] PostgreSQL users table and parameterized insert
- [ ] Password hashing and secure authentication
- [ ] Login and role-based access
- [ ] Claim creation, team routing, and priority queue
- [ ] SLA monitoring, notifications, tests, and deployment

**Important:** The signup UI sends a `POST /signup` request to the configured API URL (default: `http://localhost:5000`). The backend endpoint is not implemented yet, so account creation will not succeed until the backend is built and running.

## Learning approach

Build one feature at a time, understand the frontend-to-backend-to-database flow, and validate each milestone before moving on. The priority-routing engine remains the core product differentiator; signup is the first supporting feature.
