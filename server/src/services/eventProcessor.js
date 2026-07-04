import { PrismaClient } from '@prisma/client';
import { sendSlackNotification } from './slackService.js';
import { addLabelToIssue } from './githubService.js';
import { triageIssue } from './aiService.js';

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
  let activitySummary = null;
  
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
      const issueBody = payload.issue?.body || '';
      const issueNumber = payload.issue?.number;
      const repoFullName = payload.repository?.full_name;
      const issueUrl = payload.issue?.html_url;

      console.log(`[Event Processor] Triage for newly opened issue #${issueNumber}: "${issueTitle}"`);

      let label = 'needs-triage';
      let summary = 'No AI summary generated (fallback).';
      let useFallback = false;

      try {
        // Call the AI triage service
        const aiAnalysis = await triageIssue(issueTitle, issueBody);
        label = aiAnalysis.label;
        summary = aiAnalysis.summary;
        activitySummary = `AI Triaged (${aiAnalysis.label}): ${aiAnalysis.summary}`;
        console.log(`[Event Processor] AI Triage Success. Label: "${label}", Summary: "${summary}"`);
      } catch (aiError) {
        console.error('[Event Processor] AI Triage failed. Running graceful fallback sequence:', aiError.message);
        useFallback = true;
      }

      // Apply label to GitHub
      if (!user || !user.github_access_token) {
        console.warn('[Event Processor] Cannot apply GitHub label: Missing user OAuth access token.');
      } else {
        try {
          await addLabelToIssue(repoFullName, issueNumber, label, user.github_access_token);
        } catch (githubError) {
          console.error(`[Event Processor] GitHub label API call failed for issue #${issueNumber}:`, githubError.message);
        }
      }

      // Dispatch Slack notification
      let slackText = '';
      if (useFallback) {
        slackText = `New Issue Opened in ${repoFullName}: ${issueTitle} - ${issueUrl} (AI Triage Failed)`;
      } else {
        slackText = `New Issue Opened in ${repoFullName} [AI Label: *${label}*]\n*Issue*: ${issueTitle}\n*AI Summary*: ${summary}\nLink: ${issueUrl}`;
      }

      console.log('[Event Processor] Sending Slack notification...');
      try {
        await sendSlackNotification(slackText);
      } catch (slackError) {
        console.error('[Event Processor] Slack webhook post failed:', slackError.message);
      }

    } else if (eventType === 'pull_request') {
      const prTitle = payload.pull_request?.title || '';
      const action = payload.action || '';
      const repoFullName = payload.repository?.full_name || '';
      const prUrl = payload.pull_request?.html_url || '';
      console.log(`[Event Processor] Processing Pull Request event: PR #${payload.pull_request?.number} (${action})`);

      activitySummary = `PR ${action}: ${prTitle}`;

      // Dispatch Slack notification for PRs
      const slackText = `Pull Request ${action} in ${repoFullName}: "${prTitle}" - ${prUrl}`;
      console.log('[Event Processor] Sending Slack notification for PR...');
      try {
        await sendSlackNotification(slackText);
      } catch (slackError) {
        console.error('[Event Processor] Slack webhook post failed for PR:', slackError.message);
      }
    } else {
      console.log(`[Event Processor] Skipping actions. Unhandled event type "${eventType}" or action "${payload.action}".`);
    }

    // 3. Mark the database record as processed
    await prisma.event.update({
      where: { id: eventId },
      data: { 
        status: 'processed',
        ...(activitySummary ? { activitySummary } : {})
      }
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
