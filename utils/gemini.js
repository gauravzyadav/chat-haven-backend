const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({ 
    model: "gemini-3-flash-preview", // Go back to 1.5 (which has Free Tier availability)
    generationConfig: {
        temperature: 0.7,
     },
    systemInstruction: "You are a helpful AI assistant. Answer concisely and clearly."
}, { apiVersion: 'v1beta' }); // <--- KEEP THIS. It is required for 1.5 to work.

async function askGemini(prompt) {
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (err) {
    console.error('❌ Gemini API Error:', err.message);
    return "I'm having trouble connecting to my brain right now. Please try again later.";
  }
}

module.exports = askGemini;

