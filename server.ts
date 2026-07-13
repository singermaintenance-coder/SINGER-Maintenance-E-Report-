import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for translation
  app.post("/api/translate", async (req, res) => {
    const { text } = req.body;
    console.log(`[Backend Route] >>> STEP 3a: Received HTTP POST request to /api/translate. text payload: "${text}"`);
    
    if (!text || typeof text !== "string") {
      console.warn(`[Backend Route] Bad request: text field missing or not a string. body:`, req.body);
      res.status(400).json({ error: "Text is required and must be a string." });
      return;
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      console.log(`[Backend Route] >>> STEP 3b: Checking for GEMINI_API_KEY environment variable. Present: ${!!apiKey}`);
      if (!apiKey) {
        console.warn("[Backend Route] GEMINI_API_KEY is missing. Falling back to original text immediately.");
        res.json({ translation: text, fallback: true, warning: "API Key missing" });
        return;
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const systemInstruction = `You are an expert technical translator specialized in industrial maintenance and factory report analysis. Your task is to translate user inputs into clear, professional, and standard English for maintenance reports and commits.

You MUST follow these strict rules:
1. INPUT CLASSIFICATION & DETECTION:
   - Identify whether the input contains Sinhala Unicode text (e.g. "බිඳවැටීමක් සිදු වී ඇත") or Singlish/Sinhala spelt with English letters (e.g. "machima weda karanne na", "repair kala", "wiring check kala").
   - Handle mixed-language inputs containing any combination of English, Sinhala Unicode, and Singlish correctly.
   - If the input is fully in standard English, you MUST return the input completely unchanged. Do not rewrite, rephrase, or correct grammar if it is already in English. Keep it exactly as-is.

2. TRANSLATION DIRECTIVE:
   - If Sinhala Unicode or Singlish (Sinhala spelled using Latin letters) is detected, convert those parts into clear, professional, standard English.
   - Retain all technical terms, numerical values (vitals, timing, measurements, numbers), machine identifiers, serial numbers, codes, and names of parts (e.g., "PLC", "pneumatic", "bearing", "motor", "sensor", "boiler", etc.).
   - Translate colloquial or phonetic Sinhala terms into standard technical English maintenance terms (e.g., "machima weda karanne na" -> "The machine is not working", "oil damma" -> "Added oil", "check kala" -> "Inspected", "wire eka kapila" -> "Wire is damaged").
   - Ensure the structure of any list, table, or line-by-line format is fully preserved.

3. OUTPUT CONSTRAINTS:
   - Output ONLY the translated text (or the original text if it was already in standard English).
   - STRICTLY FORBIDDEN: Do NOT include any introductory phrases (like "Here is the translation:"), footnotes, quotes, explanations, markdown formatting, or polite fluff. Just return the raw text.`;

      const executeWithRetry = async (modelName: string, maxAttempts = 3): Promise<string> => {
        let attempt = 0;
        while (attempt < maxAttempts) {
          try {
            console.log(`[Backend Route] >>> STEP 3c: [Attempt ${attempt + 1}/${maxAttempts}] Invoking Gemini API model "${modelName}" with input length: ${text.length}`);
            
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

            // Only add thinkingConfig to models that natively support reasoning/thinking
            if (modelName.includes("3.5-flash")) {
              console.log(`[Backend Route] Model "${modelName}" supports reasoning. Attaching thinkingConfig...`);
              config.thinkingConfig = {
                thinkingLevel: ThinkingLevel.MINIMAL,
              };
            }

            console.log(`[Backend Route] >>> STEP 3d: Calling ai.models.generateContent now...`);
            const response = await ai.models.generateContent({
              model: modelName,
              contents: text,
              config
            });
            
            const rawText = response.text?.trim();
            console.log(`[Backend Route] >>> STEP 3e: Raw model response received (length: ${rawText?.length || 0}): "${rawText}"`);
            
            if (!rawText) {
              console.warn(`[Backend Route] Empty raw response from model "${modelName}".`);
              return text;
            }
            
            try {
              const parsed = JSON.parse(rawText);
              if (parsed && typeof parsed.translation === "string") {
                let result = parsed.translation.trim();
                if ((result.startsWith('"') && result.endsWith('"')) || (result.startsWith("'") && result.endsWith("'"))) {
                  result = result.substring(1, result.length - 1).trim();
                }
                console.log(`[Backend Route] >>> STEP 3f: Successfully parsed JSON. Translated text: "${result}"`);
                return result;
              } else {
                console.warn("[Backend Route] Parsed response did not match expected schema:", parsed);
              }
            } catch (jsonErr: any) {
              console.error("[Backend Route] JSON Parse Error on raw model response:", rawText, jsonErr.message);
            }
            
            return text;
          } catch (err: any) {
            attempt++;
            console.error(`[Backend Route] Attempt ${attempt} on model "${modelName}" failed with error:`, err.message || err);
            
            if (attempt >= maxAttempts) {
              throw err;
            }
            const delay = Math.pow(2, attempt) * 150 + Math.random() * 50;
            console.log(`[Backend Route] Model ${modelName} encountered error. Retrying in ${Math.round(delay)}ms...`);
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
          console.log(`[Backend Route] Translation completed successfully via gemini-3.1-flash-lite`);
        } catch (firstError: any) {
          console.warn(`[Backend Route] gemini-3.1-flash-lite failed or busy (${firstError.message}). Selecting alternative gemini-3.5-flash...`);
          usedModel = "gemini-3.5-flash";
          translatedText = await executeWithRetry(usedModel, 2);
          console.log(`[Backend Route] Translation completed successfully via alternate gemini-3.5-flash`);
        }
      } catch (genError: any) {
        console.error("[Backend Route] !!! BOTH MODELS FAILED. Falling back to returning original text. Error details:", genError.message || genError);
        res.json({ 
          translation: text, 
          fallback: true, 
          error: `AI translation service error: ${genError.message || "Failed to parse API response"}` 
        });
        return;
      }

      console.log(`[Backend Route] >>> STEP 3g: Sending translated response back to client: "${translatedText}"`);
      res.json({ translation: translatedText });
    } catch (error: any) {
      console.error("[Backend Route] General translation route error:", error);
      res.json({ translation: text, fallback: true, error: error.message || "Failed to translate." });
    }
  });

  // Vite middleware for development or serving built files for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Backend] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
