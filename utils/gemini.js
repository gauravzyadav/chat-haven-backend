const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// USE THIS MODEL CONFIGURATION
const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash-lite", // Switch to the 'Lite' version (more likely to be free/available)
    generationConfig: {
        temperature: 0.7,
     },
    systemInstruction: "You are a helpful AI assistant. Answer concisely and clearly."
}, { apiVersion: 'v1beta' }); // <--- CRITICAL: Force v1beta endpoint

async function askGemini(prompt) {
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (err) {
    console.error('❌ Gemini API Error:', err.message);
    // Return a fallback so the app doesn't crash, but log the real error above
    return "I'm having trouble connecting to my brain right now. Please try again later.";
  }
}

module.exports = askGemini;