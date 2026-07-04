import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { processEvent } from '../services/eventProcessor.js';

const prisma = new PrismaClient();

/**
 * Handles incoming GitHub webhook payloads.
 * Validates SHA256 signatures, performs idempotency checks,
 * and saves incoming webhook events to SQLite.
 */
export const handleGithubWebhook = async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const deliveryId = req.headers['x-github-delivery'];
  const eventType = req.headers['x-github-event'];

  // 1. Core Header Validations
  if (!signature) {
    console.warn('[Webhooks] Signature validation failed: Missing x-hub-signature-256 header.');
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing x-hub-signature-256 header.' });
  }

  if (!deliveryId || !eventType) {
    console.warn('[Webhooks] Missing event metadata headers (delivery or type).');
    return res.status(400).json({ error: 'Bad Request', message: 'Missing required GitHub headers (x-github-delivery or x-github-event).' });
  }

  try {
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[Webhooks] GITHUB_WEBHOOK_SECRET is not configured on the server.');
      return res.status(500).json({ error: 'Internal Server Error', message: 'Webhook cryptographic secret is unconfigured on server.' });
    }

    // 2. Cryptographic HMAC-SHA256 Signature Verification
    const hmac = crypto.createHmac('sha256', webhookSecret);
    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : '';
    const computedDigest = 'sha256=' + hmac.update(rawBody).digest('hex');

    const clientSigBuffer = Buffer.from(signature);
    const serverSigBuffer = Buffer.from(computedDigest);

    // Prevent timing attacks and buffer bounds errors
    if (clientSigBuffer.length !== serverSigBuffer.length || !crypto.timingSafeEqual(clientSigBuffer, serverSigBuffer)) {
      console.warn(`[Webhooks] Invalid signature. Client payload digest mismatch.`);
      return res.status(401).json({ error: 'Unauthorized', message: 'Cryptographic signature mismatch.' });
    }

    // 3. Idempotency Check (Check if event has already been registered for this repository)
    const repoName = req.body.repository?.full_name || '';

    const existingEvent = await prisma.event.findUnique({
      where: {
        github_delivery_id_repo_name: {
          github_delivery_id: deliveryId,
          repo_name: repoName
        }
      }
    });

    if (existingEvent) {
      console.log(`[Webhooks] Event ID ${deliveryId} for repo ${repoName} has already been logged. Skipping redundant processing.`);
      return res.status(200).json({
        message: 'Event already processed (idempotent entry)',
        deliveryId,
        status: existingEvent.status
      });
    }

    // 4. Save Event Details into the Event Table
    const savedEvent = await prisma.event.create({
      data: {
        github_delivery_id: deliveryId,
        repo_name: repoName,
        event_type: eventType,
        payload: req.body,
        status: 'received'
      }
    });

    console.log(`[Webhooks] Event log created for delivery ${deliveryId} (${eventType}).`);

    // Asynchronously invoke the background Event Processor (non-blocking)
    processEvent(savedEvent.id, eventType, req.body).catch(err => {
      console.error(`[Webhooks] Asynchronous processing trigger failed for event ${savedEvent.id}:`, err.message);
    });

    return res.status(202).json({
      message: 'Event logged successfully',
      event: {
        id: savedEvent.id,
        github_delivery_id: savedEvent.github_delivery_id,
        event_type: savedEvent.event_type,
        status: savedEvent.status,
        created_at: savedEvent.created_at
      }
    });

  } catch (error) {
    console.error('[Webhooks] System Exception during execution:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process webhook events.'
    });
  }
};
