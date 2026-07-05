# AI Notes 

## Tools and Workflow Split

Throughout this project, I used **Google Antigravity** as a pair-programming assistant.

- **The AI handled:** Boilerplate generation (Express setup, React component scaffolding), Prisma schema syntax, basic CSS/UI styling, and drafting standard utility functions (like standard Axios calls).
- **I handled:** System architecture, database relationship design, cross-tenant security logic, idempotency implementation, state management, and deployment debugging. I treated the AI as a junior developer; trusting it to write fast code, but heavily reviewing its outputs for edge cases and security flaws.

## Key Human-Driven Decisions

While the AI helped write the code, I explicitly drove these architectural decisions to ensure the system met the "unattended reliability" quality bar:

1. **The Asynchronous Handoff (HTTP 202):** The AI initially suggested processing the GitHub webhook, calling the LLM, and sending the Slack message all within the main Express route. I overruled this. GitHub webhooks time out after 10 seconds, and LLM APIs are notoriously variable. I architected an immediate `HTTP 202 Accepted` return, offloading the heavy processing to an asynchronous background worker to guarantee GitHub never logs a delivery failure.
2. **Database-Level Idempotency:** To handle GitHub's native redeliveries, I didn't rely on basic application-level checks. I engineered a composite unique key (`github_delivery_id` + `repo_name`) in the Prisma schema. This ensures duplicate events are dropped safely at the database level, preventing race conditions from triggering double Slack notifications.
3. **Backend-Driven Filtering:** Instead of letting the AI write client-side `.filter()` logic for the React dashboard (which breaks down at scale), I implemented parameterized API endpoints. Pushing the multi-repository filtering down to the Postgres level ensures the UI remains highly performant.
4. **Strict UI Constraints:** I actively constrained the AI from generating a generic "light-mode Tailwind" dashboard. I enforced a strict design system (monospaced typography for data, high-contrast badges, deep black/gray hex codes) to replicate a premium developer console (akin to Vercel or Linear).

## Scope & Architectural Trade-offs

To ensure the highest possible reliability and security within the 72-hour window, I made two specific scoping decisions regarding the stretch goals:

1. **OAuth vs. GitHub App (JWT):** I chose to implement standard GitHub OAuth rather than the JWT-based GitHub App integration. This allowed me to focus my time entirely on perfecting the core webhook security (HMAC signature verification) and cross-tenant data isolation.
2. **Hardcoded AI Triage vs. Configurable Rules:** Instead of building a complex UI for user-defined routing rules, I hardcoded the AI to triage specific labels (bug, enhancement, question, documentation). I prioritized making the AI's fallback mechanisms and Slack observability fault-tolerant over expanding the frontend feature set.
3. **Targeted Unit Testing:** I prioritized testing the isolated `signatureValidator` utility. By covering this critical, pure cryptographic function with Jest, I ensured the integrity of the webhook ingestion layer without falling into the time sink of mocking external APIs (Prisma, Gemini, GitHub) for side-effect code.

## The Hardest AI-Generated Bug (Cross-Tenant Security Flaw)

The single most dangerous wrong turn the AI led me into was regarding webhook user authentication and fallbacks.

**What it got wrong:** When writing the `eventProcessor.js` logic to match an incoming webhook payload to a registered user's OAuth token, the AI generated a "helpful" fallback:

```javascript
// AI's suggested code
if (!user) {
  console.log('No matching user found. Attempting database fallback.');
  user = await prisma.user.findFirst(); 
}
```

**How I noticed:** While mentally threat-modeling the multi-tenant architecture, I realized this was a massive cross-tenant security vulnerability. If User A triggered a webhook on an unregistered repository, the system would arbitrarily grab User B's OAuth token from the database and use it to apply labels to User A's repository.

**How I fixed it:** I completely stripped out the AI's fallback logic. I rewrote the flow so that if the cryptographic and database checks fail to find an explicitly authorized token for that specific repository owner, the worker gracefully bails out of the GitHub write action. To maintain observability, I added custom logic to still fire the Slack notification, but injected a `Unverified Repo Owner (GitHub write skipped)` warning so system admins are aware of the blocked action.

## Future Improvements (If I had more time)

- **Distributed Queuing & Resilience (Redis/BullMQ):** Implement a dedicated message broker for handling high traffic, enabling exponential retries and dead-letter queues for failed API calls.
- **Context-Aware AI via RAG:** Upgrade the AI triage system with RAG to automatically detect duplicate issues and suggest code fixes based on repository history.
- **GitHub App Integration:** Migrating from an OAuth flow to a full GitHub App architecture for finer-grained repository permissions and organization-level management.
- **WebSockets / Server-Sent Events (SSE):** The current React dashboard uses a 5-second polling interval to fetch live logs. I would upgrade this to WebSockets to push database events to the client in true real-time, reducing unnecessary HTTP overhead.
