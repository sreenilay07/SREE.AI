
import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getApiKey() {
    try {
        const envPath = path.resolve(__dirname, '.env.local');
        if (!fs.existsSync(envPath)) return process.env.API_KEY || process.env.GEMINI_API_KEY;
        const content = fs.readFileSync(envPath, 'utf-8');
        const match = content.match(/(?:GEMINI_)?API_KEY=(.*)/);
        if (match && match[1]) {
            return match[1].trim().replace(/['"]/g, '');
        }
    } catch (e) {
        console.error("Error reading .env.local", e);
    }
    return process.env.API_KEY;
}

const apiKey = getApiKey();
if (!apiKey) process.exit(1);

const client = new GoogleGenAI({ apiKey });

async function testPro() {
    console.log("Testing gemini-1.5-pro...");
    try {
        const response = await client.models.generateContent({
            model: "gemini-1.5-pro",
            contents: "Stock price of Reliance?",
            config: {
                tools: [{ googleSearch: {} }]
            }
        });

        console.log("Success!");
        if (response.candidates?.[0]?.groundingMetadata) {
            console.log("Grounding: YES");
        } else {
            console.log("Grounding: NO");
        }

    } catch (e) {
        // Log clean error for truncation avoidance
        if (e.status) console.log("Error Status: " + e.status);
        console.log("Error Msg: " + e.message.substring(0, 100));
    }
}

testPro();
