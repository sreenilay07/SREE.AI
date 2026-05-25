import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function test() {
  try {
    const res = await groq.chat.completions.create({
      messages: [{ role: 'user', content: 'Return a JSON containing {"greeting": "hello"}' }],
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' }
    });
    console.log("SUCCESS JSON Llama 3.3:", res.choices[0]?.message?.content);
  } catch (err) {
    console.error("FAILED JSON Llama 3.3:", err.message);
  }
}

test();
