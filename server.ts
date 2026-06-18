import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for translation
  app.post("/api/translate", async (req, res) => {
    const { text } = req.body;
    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Text is required and must be a string." });
      return;
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("[Backend] GEMINI_API_KEY is missing. Falling back to original text.");
        res.json({ translation: text, fallback: true, warning: "API Key missing" });
        return;
      }

      console.log(`[Backend] Translating description: "${text.substring(0, 50)}..."`);
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
            const response = await ai.models.generateContent({
              model: modelName,
              contents: `Input Text to translate:\n"${text}"`,
              config: {
                systemInstruction,
                temperature: 0.1,
              }
            });
            return response.text?.trim() || text;
          } catch (err: any) {
            attempt++;
            if (attempt >= maxAttempts) {
              throw err;
            }
            const delay = Math.pow(2, attempt) * 150 + Math.random() * 50;
            console.log(`[Backend] Model ${modelName} reported service busy. Retrying (${attempt}/${maxAttempts}) in ${Math.round(delay)}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
        return text;
      };

      let translatedText = text;
      try {
        try {
          translatedText = await executeWithRetry("gemini-3.5-flash", 3);
          console.log(`[Backend] Translated description successfully`);
        } catch (firstError: any) {
          console.log(`[Backend] Primary translation model busy, selecting alternative gemini-3.1-flash-lite...`);
          translatedText = await executeWithRetry("gemini-3.1-flash-lite", 2);
          console.log(`[Backend] Translated description successfully via alternate`);
        }
      } catch (genError: any) {
        console.log("[Backend] Dynamic translation skipped. Retaining original description.");
        translatedText = text;
      }

      res.json({ translation: translatedText });
    } catch (error: any) {
      console.error("[Backend] General translation route error:", error);
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
