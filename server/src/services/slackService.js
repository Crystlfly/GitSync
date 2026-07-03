import axios from 'axios';

/**
 * Dispatches a notification to the configured Slack Incoming Webhook.
 * Handles simple strings or complex Slack Blocks payloads.
 * @param {string|object} payload - Simple message text or complex layout object.
 */
export const sendSlackNotification = async (payload) => {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl || webhookUrl.includes('placeholder')) {
    console.warn('[Slack Service] SLACK_WEBHOOK_URL is not configured or is a placeholder. Skipping dispatch.');
    return null;
  }

  try {
    const requestData = typeof payload === 'string' ? { text: payload } : payload;

    const response = await axios.post(webhookUrl, requestData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('[Slack Service] Notification successfully dispatched to Slack. Status:', response.status);
    return response.data;
  } catch (error) {
    console.error('[Slack Service] Exception during Slack post:', error.response?.data || error.message);
    throw error;
  }
};
