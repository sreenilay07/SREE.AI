import dotenv from 'dotenv';
dotenv.config();

import { executeGroqRequest } from './config/groqConfig.js';

const sanitizeJsonLocal = (jsonStr) => {
  if (!jsonStr) return '{}';
  let s = jsonStr.trim();
  const fenceRE = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
  const match = s.match(fenceRE);
  if (match && match[2]) s = match[2].trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start !== -1 && end !== -1) s = s.substring(start, end + 1);
  return s;
};

const safeExtractTextLocal = (response) => {
  if (!response) return '';
  if (typeof response === 'string') return response;
  return response.content || '';
};

async function run() {
  const prompt = `Analyze these search results for query "test": . Return JSON with:
  {
    "summary": "Short overview analysis",
    "commonThemes": ["Theme 1", "Theme 2"],
    "topPicks": [{"symbol": "...", "name": "...", "reason": "why chosen"}]
  }`;
  try {
    const r = await executeGroqRequest(prompt, { responseMimeType: 'application/json' });
    console.log("Raw Response:", r);
    const parsed = JSON.parse(sanitizeJsonLocal(safeExtractTextLocal(r)));
    console.log("Parsed:", parsed);
  } catch (e) {
    console.error("Error:", e.message);
  }
}

run();
