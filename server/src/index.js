import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import webhookRoutes from './routes/webhookRoutes.js';
import eventRoutes from './routes/eventRoutes.js';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors({
  origin: 'http://localhost:5173', // Vite default port
  credentials: true
}));

// Capture raw body for GitHub Webhooks verification
app.use('/api/webhooks', express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

app.use(express.json());

// Mount webhooks router
app.use('/api/webhooks', webhookRoutes);

// Mount event logs router
app.use('/api/events', eventRoutes);

// Basic health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'UP', message: 'Backend server is running smoothly.' });
});

/**
 * GET /auth/github
 * Redirects the client to GitHub's OAuth login screen
 */
app.get('/auth/github', (req, res) => {
  const githubClientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_REDIRECT_URI;
  
  if (!githubClientId) {
    console.error('GITHUB_CLIENT_ID is not configured in .env');
    return res.status(500).json({ error: 'OAuth client ID not configured on server.' });
  }

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${githubClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user,repo,admin:repo_hook`;
  
  res.redirect(githubAuthUrl);
});

/**
 * GET /auth/github/callback
 * Handles the redirect back from GitHub, exchanges code for access token,
 * upserts the user, and signs/issues a JWT.
 */
app.get('/auth/github/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'Authorization code is missing.' });
  }

  try {
    // 1. Exchange the temporary code for an access token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_REDIRECT_URI
      },
      {
        headers: {
          Accept: 'application/json'
        }
      }
    );

    const { access_token, error, error_description } = tokenResponse.data;

    if (error) {
      console.error('GitHub token exchange error:', error, error_description);
      return res.status(400).json({ error, description: error_description });
    }

    if (!access_token) {
      return res.status(400).json({ error: 'Failed to retrieve access token from GitHub.' });
    }

    // 2. Fetch user details from GitHub API
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `token ${access_token}`,
        'User-Agent': 'github-slack-integration'
      }
    });

    const githubUser = userResponse.data;
    const githubId = String(githubUser.id);
    const username = githubUser.login;

    // 3. Upsert user in the database
    const user = await prisma.user.upsert({
      where: { github_id: githubId },
      update: {
        username: username,
        github_access_token: access_token
      },
      create: {
        github_id: githubId,
        username: username,
        github_access_token: access_token
      }
    });

    // 4. Issue a JWT token
    const jwtPayload = {
      id: user.id,
      github_id: user.github_id,
      username: user.username
    };

    const token = jwt.sign(jwtPayload, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    // 5. Redirect back to frontend dashboard/auth callback handler
    // We pass the token in the query parameter for the client to capture
    const frontendRedirectUrl = `http://localhost:5173/auth/callback?token=${token}`;
    res.redirect(frontendRedirectUrl);

  } catch (err) {
    console.error('Authentication Flow Error:', err.message);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to complete GitHub OAuth sequence.'
    });
  }
});

// Start listening
const server = app.listen(PORT, () => {
  console.log(`[Server] Listening on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received. Closing HTTP server and database connections.');
  server.close(async () => {
    await prisma.$disconnect();
    console.log('HTTP server and database connections closed.');
    process.exit(0);
  });
});
