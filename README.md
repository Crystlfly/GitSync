# GitSync: GitHub Webhooks & Slack Console

GitSync is a full-stack, event-driven GitHub automation bot. It
inspects, cryptographically verifies, and processes incoming GitHub
Webhook events, automatically applies labels to issues, and seamlessly
forwards structured notifications to Slack.

It features an asynchronous event-processing worker to ensure high
reliability and a high-fidelity React console dashboard (styled with a
custom deep dark theme) to monitor real-time webhook logs.

------------------------------------------------------------------------

# Architecture Overview

GitSync uses a robust, asynchronous event-driven workflow designed to
deliver speed, reliability, and security:

## System Architecture
<img src="./assets/System%20Architecture.png" width="700" alt="System Architecture" />

## Webhook Security & Data Isolation
<img src="./assets/Webhook%20Security%20&%20Data%20Isolation.png" width="700" height="800" alt="Webhook Security Flow" />

## AI Triage & Fallback Logic
<img src="./assets/AI%20Triage%20&%20Fallback%20Logic.png" width="700" height="900" alt="AI Logic Flow" />

## Security

-   **Cryptographic Validation:** Verifies every webhook using
    `x-hub-signature-256` with HMAC-SHA256 over the raw request body.
-   **Timing Attack Protection:** Uses `crypto.timingSafeEqual` for
    secure signature comparison.
-   **Idempotency:** Prevents duplicate processing by checking the
    `x-github-delivery` header before executing background jobs.

## Performance

-   Returns **HTTP 202 Accepted** immediately.
-   Executes GitHub API requests and Slack notifications asynchronously.
-   Prevents GitHub webhook timeouts.

------------------------------------------------------------------------


# Testing & Reliability

To ensure production-grade security, the core cryptographic HMAC webhook validation is fully covered by Jest unit tests. 

```bash
cd server
npm test
```

# Tech Stack

  Layer            Technology
  ---------------- ------------------------------------------
  Frontend         React.js, Vite, Vanilla CSS (Dark Theme)
  Backend          Node.js, Express (ES Modules)
  Database         PostgreSQL + Prisma ORM
  HTTP Client      Axios
  Authentication   GitHub OAuth 
  Security         crypto (HMAC SHA256)
  Notifications    Slack Incoming Webhooks

------------------------------------------------------------------------

# Live Deployment

-   **Database:** Neon (Serverless PostgreSQL)
-   **Backend:** Render
-   **Frontend:** Vercel

------------------------------------------------------------------------

# How to Test

## 1. Login

Visit:

    https://git-sync-phi.vercel.app

Login using GitHub.

## 2. Trigger the Bot (Live Demo)

To adhere to strict security practices, the live `GITHUB_WEBHOOK_SECRET` is not exposed in this documentation. Instead, a dedicated demo repository has been pre-configured to communicate with the live backend.

1. Go to the Demo Repository: **https://github.com/gitsync-demo-eval/test-repo**
2. Click on the **Issues** tab and create a vaguely worded new issue.
   * **Title:** The app feels really slow today
   * **Body:** I don't know what changed, but every time I load the main page on mobile Safari, it takes 10 seconds and crashes.

## 4. Expected Result

- GitHub automatically receives a **bug** label.
- Dashboard displays the processed event.
- Slack receives a structured notification. *(Note: For this live demo, alerts are routed to the internal GitSync Slack workspace. See the preview below!)*

### Slack Notification Preview
<img src="./assets/Slack%20Notification.png" width="600" alt="Slack Message Preview" />

------------------------------------------------------------------------

# Local Setup

## Clone

``` bash
git clone <repository-url>
cd GitSync
```

## Install

Backend

``` bash
cd server
npm install
```

Frontend

``` bash
cd client
npm install
```

------------------------------------------------------------------------

# Configure Environment Variables

## 1. Backend (`server/.env`)

``` env
PORT=5000
DATABASE_URL="postgresql://username:password@localhost:5432/gitsync?schema=public"
FRONTEND_URL=

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=http://localhost:5000/auth/github/callback

GITHUB_WEBHOOK_SECRET=

JWT_SECRET=

SLACK_WEBHOOK_URL=

GEMINI_API_KEY=
```

###  Note on Local Webhook Secrets
If you are running the app locally and want to test webhooks (using a local tunnel like `ngrok` or `smee.io`), you must configure a webhook on one of your own test repositories. You can invent any secret string you like (e.g., `local_test_secret_123`) for the GitHub Webhook configuration, as long as it exactly matches the `GITHUB_WEBHOOK_SECRET` in your `server/.env` file.


## 2. Frontend (`client/.env`)

Create a `.env` file inside the **client** directory:

```env
VITE_API_URL=http://localhost:5000
```

# Slack Setup (For Local Testing)

If you are running this project locally and want to test the Slack integration:

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App**.
2. Select **From scratch**, name it "GitSync Local", and pick your test workspace.
3. In the sidebar, click **Incoming Webhooks** and toggle it to **On**.
4. Scroll down, click **Add New Webhook to Workspace**, and select a channel.
5. Copy the generated Webhook URL and paste it into your `server/.env` file as `SLACK_WEBHOOK_URL`.
------------------------------------------------------------------------

# Database

``` bash
cd server

npx prisma db push
```

------------------------------------------------------------------------

# Start Backend

``` bash
cd server

npm start
```

------------------------------------------------------------------------

# Start Frontend

``` bash
cd client

npm run dev
```

Open:

    http://localhost:5173

------------------------------------------------------------------------

## Features

- GitHub OAuth Authentication
- Secure Webhook Signature Verification
- Issue & Pull Request Event Handling
- AI-Powered Issue Triage (Gemini Integration)
- Automatic GitHub Issue Labeling
- Slack Notifications
- Multi-Repository Support with Idempotency (Composite Unique Keys)
- Structured Logs & Failure Visibility (dashboard-tracked delivery failures; retries via GitHub's native redelivery)
- Asynchronous Background Processing
- PostgreSQL Event Logging
- Live React Dashboard
- Responsive Dark UI

------------------------------------------------------------------------

## Future Improvements

* **Distributed Queuing & Resilience (Redis/BullMQ):** Implement a dedicated message broker for handling high traffic, enabling exponential retries and dead-letter queues for failed API calls.
* **Context-Aware AI via RAG:** Upgrade the AI triage system with RAG to automatically detect duplicate issues and suggest code fixes based on repository history.
* **Cursor-Based API Pagination:** Implement cursor based pagination to ensure the React dashboard maintains lightning-fast performance as webhook logs scale into the tens of thousands.
* **Configurable Notification Routing:** Build a user preferences layer allowing developers to set granular Slack alert rules (e.g., only pinging for critical bugs) to prevent alert fatigue.
* **Repository Insights & Analytics:** Expand the frontend dashboard with data visualizations to track system health, webhook processing latency, and AI triage accuracy over time.

------------------------------------------------------------------------

# License

MIT License
