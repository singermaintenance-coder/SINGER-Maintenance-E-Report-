import { Handler } from "@netlify/functions";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables from .env if present
dotenv.config();

export const handler: Handler = async (event) => {
  // We only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    const { text } = JSON.parse(event.body || "{}");
    console.log(`[Netlify Function] >>> STEP 3a: Received HTTP POST request. text payload: "${text}"`);

    if (!text || typeof text !== "string") {
      console.warn(`[Netlify Function] Bad request: text field missing or not a string. body:`, event.body);
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Text is required and must be a string." }),
      };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    console.log(`[Netlify Function] >>> STEP 3b: Checking for GEMINI_API_KEY environment variable.`);
    console.log(`[Netlify Function] process.env.GEMINI_API_KEY status - exists: ${!!apiKey}, length: ${apiKey ? apiKey.length : 0}`);
    
    if (!apiKey) {
      console.error("[Netlify Function] GEMINI_API_KEY is missing from process.env.");
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Gemini API key is not configured on the server." }),
      };
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: 10000,
      },
    });

    const systemInstruction = `You are a professional translator specializing in Sinhala-to-English and Singlish-to-English (Sinhala written in Latin/English alphabet phonetically).
Your sole task is to translate the user input into standard, clean, natural, and grammatically correct English.

Follow these strict rules:
1. Detect if the text is in Sinhala script or written in Singlish (Latin phonetics).
2. Translate it accurately to English.
3. Keep technical or machine maintenance terms accurate (e.g. "motor", "wiring", "bearing", "machima" -> "machine", etc.).
4. Do NOT include any explanations, markdown formatting, quotes, or conversational phrases. Only return the final direct English translation.
5. If the text is already in English, return it exactly as-is.

Examples:
- "machima weda karanne na" -> "The machine is not working"
- "wiring kapila thiyenne" -> "The wiring is cut"
- "repair kala heta thama check karanne" -> "Repaired, checking will be done tomorrow"
- "බෙයාරින් එක කැඩිලා, අලුත්වැඩියා කළ යුතුයි" -> "The bearing is broken and requires repair."`;

    const executeWithRetry = async (modelName: string, maxAttempts = 3): Promise<string> => {
      let attempt = 0;
      while (attempt < maxAttempts) {
        try {
          console.log(`[Netlify Function] >>> STEP 3c: [Attempt ${attempt + 1}/${maxAttempts}] Invoking Gemini API model "${modelName}" with input length: ${text.length}`);
          
          const config: any = {
            systemInstruction,
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                translation: {
                  type: Type.STRING,
                  description: "The direct standard English translation of the input text. No explanation, markdown, introductory text, or quotes."
                }
              },
              required: ["translation"]
            }
          };

          if (modelName.includes("3.5-flash")) {
            console.log(`[Netlify Function] Model "${modelName}" supports reasoning. Attaching thinkingConfig...`);
            config.thinkingConfig = {
              thinkingLevel: ThinkingLevel.MINIMAL,
            };
          }

          console.log(`[Netlify Function] >>> STEP 3d: Calling ai.models.generateContent now...`);
          const response = await ai.models.generateContent({
            model: modelName,
            contents: text,
            config
          });
          
          const rawText = response.text?.trim();
          console.log(`[Netlify Function] >>> STEP 3e: Raw response: "${rawText}"`);
          
          if (!rawText) {
            console.warn(`[Netlify Function] Empty raw response from model "${modelName}".`);
            return text;
          }
          
          try {
            const parsed = JSON.parse(rawText);
            if (parsed && typeof parsed.translation === "string") {
              let result = parsed.translation.trim();
              if ((result.startsWith('"') && result.endsWith('"')) || (result.startsWith("'") && result.endsWith("'"))) {
                result = result.substring(1, result.length - 1).trim();
              }
              console.log(`[Netlify Function] >>> STEP 3f: Successfully parsed JSON. Translated text: "${result}"`);
              return result;
            } else {
              console.warn("[Netlify Function] Parsed response did not match expected schema:", parsed);
            }
          } catch (jsonErr: any) {
            console.error("[Netlify Function] JSON Parse Error on raw response:", rawText, jsonErr.message);
          }
          
          return text;
        } catch (err: any) {
          attempt++;
          console.error(`[Netlify Function] Attempt ${attempt} on model "${modelName}" failed with error:`, err.message || err);
          
          if (attempt >= maxAttempts) {
            throw err;
          }
          const delay = Math.pow(2, attempt) * 150 + Math.random() * 50;
          console.log(`[Netlify Function] Model ${modelName} encountered error. Retrying in ${Math.round(delay)}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      return text;
    };

    let translatedText = text;
    let usedModel = "";
    try {
      try {
        usedModel = "gemini-3.1-flash-lite";
        translatedText = await executeWithRetry(usedModel, 3);
        console.log(`[Netlify Function] Translation completed successfully via gemini-3.1-flash-lite`);
      } catch (firstError: any) {
        console.warn(`[Netlify Function] gemini-3.1-flash-lite failed or busy (${firstError.message}). Selecting alternative gemini-3.5-flash...`);
        usedModel = "gemini-3.5-flash";
        translatedText = await executeWithRetry(usedModel, 2);
        console.log(`[Netlify Function] Translation completed successfully via alternate gemini-3.5-flash`);
      }
    } catch (genError: any) {
      console.error("[Netlify Function] !!! BOTH MODELS FAILED. Error details:", genError.message || genError);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          error: `AI translation service error: ${genError.message || "Failed to parse API response"}` 
        }),
      };
    }

    console.log(`[Netlify Function] >>> STEP 3g: Sending translated response back to client: "${translatedText}"`);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ translation: translatedText }),
    };
  } catch (error: any) {
    console.error("[Netlify Function] General translation function error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message || "Failed to translate." }),
    };
  }
};
