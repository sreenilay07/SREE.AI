
import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM dirname fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Manually read API KEY
function getApiKey() {
    try {
        const envPath = path.resolve(__dirname, '.env.local');
        if (!fs.existsSync(envPath)) return process.env.API_KEY;
        const content = fs.readFileSync(envPath, 'utf-8');
        const match = content.match(/API_KEY=(.*)/);
        if (match && match[1]) {
            return match[1].trim().replace(/['"]/g, '');
        }
    } catch (e) {
        console.error("Error reading .env.local", e);
    }
    return process.env.API_KEY;
}

const apiKey = getApiKey();
if (!apiKey) {
    console.error("❌ No API_KEY found. Please check .env.local");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function testGrounding() {
    console.log("🔍 Testing Gemini Search Grounding with Key ending in: ..." + apiKey.slice(-4));

    // Test 1: Standard googleSearch tool
    try {
        console.log("\n--- Attempt 1: Tool = [{ googleSearch: {} }] ---");
        const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: "What is the EXACT current stock price of Reliance Industries on NSE India RIGHT NOW (Jan 24 2026)? Return just the price and time." }] }],
            tools: [{ googleSearch: {} }]
        });

        const response = result.response;
        console.log("Raw Response Keys:", Object.keys(response));

        // Safe extraction
        let text = "N/A";
        if (typeof response.text === 'function') {
            text = response.text();
        } else if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
            text = response.candidates[0].content.parts[0].text;
        } else {
            text = JSON.stringify(response);
        }

        console.log("Response:", text.substring(0, 200) + "...");

        // Check Metadata
        const candidate = response.candidates?.[0];
        // Check for grounding metadata in likely places
        const groundingMetadata = candidate?.groundingMetadata || (response as any).groundingMetadata;

        if (groundingMetadata) {
            console.log("✅ SUCCESS: GroundingMetadata present!");
            console.log("Metadata:", JSON.stringify(groundingMetadata, null, 2));
        } else {
            console.log("❌ FAILURE: No GroundingMetadata found.");
            console.log("Full Candidate:", JSON.stringify(candidate, null, 2));
        }

    } catch (e) {
        console.error("❌ ERROR in Attempt 1:", e);
    }

    // Test 2: Dynamic Retrieval
    try {
        console.log("\n--- Attempt 2: Tool = googleSearchRetrieval (Dynamic) ---");
        const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: "What is the EXACT current stock price of Reliance Industries on NSE India RIGHT NOW? Return just the price." }] }],
            tools: [{ googleSearchRetrieval: { dynamicRetrievalConfig: { mode: "mode_dynamic", dynamicThreshold: 0.1 } } }]
        });

        const response = result.response;

        let text = "N/A";
        if (typeof response.text === 'function') {
            text = response.text();
        } else if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
            text = response.candidates[0].content.parts[0].text;
        } else {
            text = JSON.stringify(response);
        }
        console.log("Response:", text.substring(0, 200) + "...");

        const candidate = response.candidates?.[0];
        const groundingMetadata = candidate?.groundingMetadata || (response as any).groundingMetadata;

        if (groundingMetadata) {
            console.log("✅ SUCCESS: GroundingMetadata present!");
            console.log("Metadata:", JSON.stringify(groundingMetadata, null, 2));
        } else {
            console.log("❌ FAILURE: No GroundingMetadata found.");
        }
    } catch (e) {
        console.error("❌ ERROR in Attempt 2:", e);
    }
}

testGrounding();
