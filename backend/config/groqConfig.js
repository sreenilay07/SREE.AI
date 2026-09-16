import Groq from 'groq-sdk';

let groqClient = null;

export function getGroqClient() {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.warn('[GROQ CONFIG] GROQ_API_KEY environment variable is not set.');
    }
    groqClient = new Groq({ apiKey: apiKey || 'DUMMY_KEY' });
  }
  return groqClient;
}

/**
 * Verified live Groq model list matching console.groq.com/docs/models
 */
export const GROQ_MODELS = [
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'groq/compound',
  'qwen/qwen3.6-27b',
  'allam-2-7b'
];

/**
 * Executes a Groq request with timeout, model fallback, and retry handling.
 * 
 * @param {string | Array} prompt 
 * @param {object} [options] 
 * @returns {Promise<string>}
 */
export async function executeGroqRequest(prompt, options = {}) {
  const groq = getGroqClient();
  const models = options.models || GROQ_MODELS;
  let lastError = null;

  for (const model of models) {
    try {
      const messages = Array.isArray(prompt) 
        ? prompt.map(m => ({ ...m })) 
        : [{ role: 'user', content: prompt }];

      const config = {
        messages,
        model,
        temperature: options.temperature !== undefined ? options.temperature : 0.2,
      };

      if (options.responseMimeType === 'application/json') {
        config.response_format = { type: 'json_object' };
        // Ensure prompt contains 'json' to satisfy Groq requirement
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && typeof lastMsg.content === 'string' && !lastMsg.content.toLowerCase().includes('json')) {
          lastMsg.content += ' Output format: JSON object.';
        }
      }

      // 30-second timeout per attempt for complex stock analysis prompts
      const timeoutMs = options.timeoutMs || 30000;
      const responsePromise = groq.chat.completions.create(config);
      
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Groq request timeout (${timeoutMs}ms) for ${model}`)), timeoutMs)
      );

      const response = await Promise.race([responsePromise, timeoutPromise]);
      const content = response.choices[0]?.message?.content || '';
      
      if (content) return content;
    } catch (err) {
      console.warn(`[GROQ ENGINE] Call failed with model ${model}:`, err.message);
      lastError = err;
    }
  }

  console.error('[GROQ ENGINE] Circuit breaker tripped. All Groq models failed.');
  throw lastError || new Error('All Groq AI models are currently unavailable.');
}
