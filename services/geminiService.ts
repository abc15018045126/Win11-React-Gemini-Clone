import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

let ai: GoogleGenAI | null = null;
let isInitializing = false;

// Initialize the GoogleGenAI instance asynchronously
const initializeAi = async () => {
  if (ai || isInitializing) return;
  isInitializing = true;
  
  try {
    // In an Electron app, the API key is securely handled in the main process
    // and exposed via a preload script on the window object.
    const apiKey = await window.electronAPI?.getApiKey();
    
    if (apiKey) {
      ai = new GoogleGenAI({ apiKey: apiKey });
    } else {
      console.warn(
        "Gemini API key not found. Please set the API_KEY in your .env file. AI features will be disabled or return mock responses."
      );
    }
  } catch (error) {
    console.error("Error initializing Gemini API:", error);
  } finally {
    isInitializing = false;
  }
};

export const generateGeminiResponse = async (prompt: string): Promise<string> => {
  // Ensure the AI client is initialized before making a request
  if (!ai && !isInitializing) {
    await initializeAi();
  }
  
  if (!ai) {
    // Fallback or error message if API key is not available
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
    return "Gemini API is not configured. Please ensure the API_KEY environment variable is set in your .env file. This is a mock response.";
  }

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    // The .text property directly gives the string output.
    return response.text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
        return `Error from Gemini: ${error.message}`;
    }
    return "An unknown error occurred while contacting Gemini.";
  }
};
