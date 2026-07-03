import axios from 'axios';

/**
 * Applies a specified label to a GitHub issue.
 * @param {string} repoFullName - Full repository path (e.g. "owner/name").
 * @param {number} issueNumber - The target issue identifier.
 * @param {string} label - Name of the label to attach.
 * @param {string} token - GitHub User OAuth token.
 */
export const addLabelToIssue = async (repoFullName, issueNumber, label, token) => {
  if (!token) {
    throw new Error('A valid GitHub OAuth token is required.');
  }

  const url = `https://api.github.com/repos/${repoFullName}/issues/${issueNumber}/labels`;

  try {
    const response = await axios.post(
      url,
      { labels: [label] },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'github-slack-integration',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );

    console.log(`[GitHub Service] Added label "${label}" to issue #${issueNumber} in repository ${repoFullName}.`);
    return response.data;
  } catch (error) {
    console.error(
      `[GitHub Service] API exception labelling issue #${issueNumber}:`,
      error.response?.data || error.message
    );
    throw error;
  }
};
