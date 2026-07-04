Here is the completed draft for your `AI_NOTES.md` file, filled out using the exact technical hurdles, architectural decisions, and debugging steps we went through to build this project.

You can copy and paste this directly into your repository.

---

# Developer Reflections & Notes

## 🛠️ Tools Used

* **Frontend:** React, Vite, Vanilla CSS (Custom Dark Mode UI).
* **Backend:** Node.js, Express.js.
* **Database & ORM:** Prisma ORM, PostgreSQL (for rapid local prototyping), Neon (Serverless PostgreSQL for production).
* **Infrastructure & Deployment:** Render (Backend), Vercel (Frontend), Cloudflare Tunnels (`@cloudflare/cloudflared`) for secure local webhook testing.
* **AI Collaboration:** Google Antigravity (AI Agent) for rapid scaffolding, architectural generation, and debugging deployment environments.

---

## 💡 Key Decisions Made Independently

* **Phased Architecture Strategy:** I explicitly divided the project into isolated phases (OAuth Auth -> Secure Webhook Endpoint -> Async Action Layer -> Frontend Dashboard). This prevented the AI from tangling the authentication state with the webhook processing logic, ensuring clean separation of concerns.
* **Prisma as an Abstraction Layer:** I chose to start the project with a local PostgreSQL database to eliminate cloud provisioning bottlenecks during the early prototyping phase. Because I chose Prisma ORM, migrating the production app to a live PostgreSQL (Neon) database required changing exactly two lines of code (the provider and the `.env` string), without needing to rewrite any raw SQL queries.
* **Asynchronous Webhook Processing:** To meet the strict reliability requirements, I decoupled the webhook receiver from the action layer. The Express route immediately verifies the cryptographic signature and returns a `202 Accepted` to GitHub, while a background worker safely handles the external REST API calls to GitHub and Slack. This prevents GitHub from timing out if Slack's API experiences latency.
* **Strict UI Constraints:** I actively constrained the AI from generating a generic "light-mode Tailwind" dashboard. I enforced a strict design system (monospaced typography for data, high-contrast badges, deep black/gray hex codes) to replicate a premium developer console (akin to Vercel or Linear).

---

## 🐛 Hardest Bug Encountered

**The Issue:** During the transition from local development to production readiness, GitHub began failing to deliver webhooks, throwing a `failed to connect to host` error, accompanied by a Prisma `P1012` schema validation crash on the backend.

**The Diagnosis & Fix:**
The bug was a combination of environment mismatches and tunneling instability.

1. **The Database Crash:** When deleting the local `dev.db` file to migrate to PostgreSQL, Prisma crashed because the `.env` string was still formatted for PostgreSQL, throwing a validation error. I diagnosed this by checking the terminal traces and updated the `DATABASE_URL` to a properly formatted, URL-encoded Neon PostgreSQL connection string.
2. **The Webhook Timeout:** Once the database was fixed, GitHub still couldn't connect. I realized `npx localtunnel` was silently freezing and hanging in the terminal without outputting an error, causing GitHub's payload requests to hit a dead end. I resolved this by terminating the batch job and swapping my local ingress tool to Cloudflare Tunnels (`@cloudflare/cloudflared`). This provided a highly stable, instantly accessible URL, allowing the payloads to successfully bypass my local network and reach the newly migrated database.

---

## 🚀 Future Improvements

* **WebSockets / Server-Sent Events (SSE):** The current React dashboard uses a 5-second polling interval to fetch live logs. I would upgrade this to WebSockets to push database events to the client in true real-time, reducing unnecessary HTTP overhead.
* **Dynamic Rule Configuration:** Currently, the event processor hardcodes the logic to look for the word "bug" and apply a specific label. I would expand the Prisma schema to store user-defined rules, allowing users to configure custom keyword-to-label mappings directly from the UI.
* **GitHub App Authentication:** Upgrade the basic OAuth implementation to a fully-fledged GitHub App (using JWTs and Installation Access Tokens). This would provide better rate limits, finer-grained repository permissions, and a more secure integration lifecycle.