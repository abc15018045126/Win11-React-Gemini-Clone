
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

let ai: GoogleGenAI | null = null;
let isInitializing = false;

// Gets the API key exclusively from Electron IPC
const getApiKey = async (): Promise<string | null> => {
  if (window.electronAPI) {
    return window.electronAPI.getApiKey();
  }
  // Return null if not in Electron environment
  return null;
};

// Initialize the GoogleGenAI instance asynchronously
const initializeAi = async () => {
  if (ai || isInitializing) return;
  isInitializing = true;
  
  try {
    const apiKey = await getApiKey();
    if (apiKey) {
      ai = new GoogleGenAI({ apiKey });
    } else {
      console.warn(
        "Gemini API key not found. This can happen if the API_KEY is not in your .env file or if you are running in a browser without the Electron backend. AI features will be disabled or return mock responses."
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
    return "Gemini API is not configured. Please ensure you are running within Electron and the API_KEY environment variable is set. This is a mock response.";
  }

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
        return `Error from Gemini: ${error.message}`;
    }
    return "An unknown error occurred while contacting Gemini.";
  }
};
