import { Router } from 'express';
import { handleGithubWebhook } from '../controllers/webhookController.js';

const router = Router();

// Endpoint for receiving GitHub Webhook payloads
router.post('/github', handleGithubWebhook);

export default router;
