const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

// Initialize the new client with your API Key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function askGemini(prompt) {
  try {
    // Use the new SDK syntax
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", // The new 2026 model
      contents: prompt,
      config: {
        temperature: 0.7,
        // In the new SDK, system instructions go inside 'config'
        systemInstruction: "You are a helpful AI assistant. Answer concisely and clearly."
      }
    });

    // In the new SDK, .text is a property, not a function
    return response.text; 
    
  } catch (err) {
    console.error('❌ Gemini API Error:', err.message);
    return "I'm having trouble connecting to my brain right now. Please try again later.";
  }
}

module.exports = askGemini;