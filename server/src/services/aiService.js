import { GoogleGenerativeAI } from '@google/generative-ai';

// In-memory cache for the discovered model name
let cachedModelName = null;

/**
 * Discovers the active Gemini model name using the Google REST API.
 * Filters for models supporting 'generateContent' and containing 'flash'.
 * Strips the 'models/' prefix from the selected name.
 * 
 * @param {string} apiKey - Google Gemini API Key.
 * @returns {Promise<string>} Discovered model name (e.g. "gemini-1.5-flash").
 */
async function discoverModelName(apiKey) {
  // 1. Primary Override: environment variable configuration
  if (process.env.GEMINI_MODEL_NAME) {
    return process.env.GEMINI_MODEL_NAME;
  }

  // 2. Use Cached Value if available
  if (cachedModelName) {
    return cachedModelName;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    console.log(`[AI Service] Querying Gemini REST API for auto-discovery: ${url}`);

    // Call REST endpoint using Node's native fetch
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`REST models fetch failed with status: ${response.status}`);
    }

    const data = await response.json();
    if (!data || !Array.isArray(data.models)) {
      throw new Error('Failed to parse models. Invalid response schema.');
    }

    // 3. Filter for models supporting generateContent
    const generatingModels = data.models.filter((model) => {
      const methods = model.supportedGenerationMethods || [];
      return methods.includes('generateContent');
    });

    if (generatingModels.length === 0) {
      throw new Error('No models supporting generateContent found.');
    }

    // Try to find a flash model first (optimized for speed/cost)
    let selectedModel = generatingModels.find((model) =>
      String(model.name || '').toLowerCase().includes('flash')
    );

    // Fallback: pick the first available model supporting generateContent
    if (!selectedModel) {
      console.log('[AI Service] No flash models found. Falling back to the first content-generating model.');
      selectedModel = generatingModels[0];
    }

    const selectedModelName = selectedModel.name;

    // 4. Formatting: Strip the 'models/' prefix
    const cleanedModelName = selectedModelName.replace(/^models\//, '');

    // 5. Cache the value
    cachedModelName = cleanedModelName;
    console.log(`[AI Service] Auto-discovered and cached active model: "${cachedModelName}"`);
    
    return cachedModelName;

  } catch (error) {
    // 6. Graceful Fallback
    console.warn(`[AI Service] Auto-discovery failed (${error.message}). Falling back to default.`);
    return 'gemini-1.5-flash-latest';
  }
}

/**
 * Analyzes a newly opened GitHub issue using the Gemini API.
 * 
 * @param {string} title - The title of the GitHub issue.
 * @param {string} body - The markdown body description of the GitHub issue.
 * @returns {Promise<{label: string, summary: string}>} Strictly formatted JSON categorization.
 */
export const analyzeGitHubIssue = async (title, body) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.includes('placeholder')) {
    throw new Error('Gemini API key is unconfigured or set to a placeholder.');
  }

  // Await the active model name before creating generative model instance
  const modelName = await discoverModelName(apiKey);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = `
      You are an automated developer triage agent. Analyze this GitHub issue:
      
      Issue Title: ${title}
      Issue Body: ${body || 'No description provided.'}

      Categorize and summarize this issue. You must respond with a JSON object in this format:
      {
        "label": "bug" | "enhancement" | "question",
        "summary": "a single-sentence, concise description of the issue"
      }
      
      Choose only "bug" (if it is a crash, defect, or unexpected behavior), "enhancement" (feature requests, improvements), or "question" (usage queries, support needs). The "summary" field must be exactly one sentence.
    `;

    console.log(`[AI Service] Invoking model "${modelName}" for issue triage...`);

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });

    const responseText = result.response.text();
    const parsedResult = JSON.parse(responseText);

    let label = String(parsedResult.label || '').toLowerCase().trim();
    const summary = String(parsedResult.summary || 'No summary could be generated.').trim();

    if (!['bug', 'enhancement', 'question'].includes(label)) {
      console.warn(`[AI Service] AI inferred non-standard label "${label}". Normalizing to "needs-triage".`);
      label = 'needs-triage';
    }

    return { label, summary };

  } catch (error) {
    console.error(`[AI Service] API execution failed using model "${modelName}":`, error.message);
    throw error;
  }
};

// Aliasing for backward compatibility with existing eventProcessor triggers
export const triageIssue = analyzeGitHubIssue;
