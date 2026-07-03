import { PrismaClient } from '@prisma/client';
import { sendSlackNotification } from './slackService.js';
import { addLabelToIssue } from './githubService.js';

const prisma = new PrismaClient();

/**
 * Processes an event asynchronously in the background.
 * Looks up user token credentials, applies GitHub labels if "bug" is matched,
 * forwards notifications to Slack, and writes completion status back to database.
 * 
 * @param {string} eventId - Unique identifier of the event record in the database.
 * @param {string} eventType - The x-github-event type (e.g. "issues").
 * @param {object} payload - Parsed JSON object of the event request body.
 */
export const processEvent = async (eventId, eventType, payload) => {
  console.log(`[Event Processor] Beginning background processing for event: ${eventId} (${eventType})`);
  
  try {
    // 1. Identify the installation user to retrieve GitHub access token
    const repoOwnerId = String(payload.repository?.owner?.id || '');
    const repoOwnerLogin = payload.repository?.owner?.login || '';

    // Search by owner id, login, or fallback to first user in database
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { github_id: repoOwnerId },
          { username: repoOwnerLogin }
        ]
      }
    });

    if (!user) {
      console.log('[Event Processor] No matching user found for repository owner. Attempting database fallback.');
      user = await prisma.user.findFirst();
    }

    // 2. Perform event actions if the event is "issues" and action is "opened"
    if (eventType === 'issues' && payload.action === 'opened') {
      const issueTitle = payload.issue?.title || '';
      const issueNumber = payload.issue?.number;
      const repoFullName = payload.repository?.full_name;
      const issueUrl = payload.issue?.html_url;

      console.log(`[Event Processor] Inspecting newly opened issue #${issueNumber}: "${issueTitle}"`);

      // Check for the word "bug" (case-insensitive) in the issue title
      const isBug = /bug/i.test(issueTitle);
      
      if (isBug) {
        if (!user || !user.github_access_token) {
          console.warn('[Event Processor] Match detected but GitHub access token is missing. Label skip.');
        } else {
          console.log('[Event Processor] "Bug" keyword detected. Sending label request to GitHub.');
          await addLabelToIssue(repoFullName, issueNumber, 'bug', user.github_access_token);
        }
      }

      // Dispatch formatted Slack notification
      const slackText = `New Issue Opened in ${repoFullName}: ${issueTitle} - ${issueUrl}`;
      console.log('[Event Processor] Sending Slack notification...');
      await sendSlackNotification(slackText);
    } else {
      console.log(`[Event Processor] Skipping actions. Unhandled event type "${eventType}" or action "${payload.action}".`);
    }

    // 3. Mark the database record as processed
    await prisma.event.update({
      where: { id: eventId },
      data: { status: 'processed' }
    });
    console.log(`[Event Processor] Event ${eventId} marked as "processed" successfully.`);

  } catch (error) {
    console.error(`[Event Processor] Failure encountered while processing event ${eventId}:`, error.message);
    
    // Fallback error-state logger
    try {
      await prisma.event.update({
        where: { id: eventId },
        data: { status: 'failed' }
      });
      console.log(`[Event Processor] Event ${eventId} marked as "failed" in DB.`);
    } catch (dbError) {
      console.error('[Event Processor] Failed to update event failure status in DB:', dbError.message);
    }
  }
};
