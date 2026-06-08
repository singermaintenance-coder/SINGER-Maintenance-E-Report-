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
        throw new Error("GEMINI_API_KEY environment variable is not defined on the server.");
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
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Translate the following maintenance report description from Sinhala to English. 
        If the text is already in English, return it exactly as it is without any changes.
        Do not include any other text, just the translation or the original if it's already English.
        
        Description: ${text}`,
      });

      const translatedText = response.text?.trim() || text;
      console.log(`[Backend] Transformed to: "${translatedText.substring(0, 50)}..."`);
      res.json({ translation: translatedText });
    } catch (error: any) {
      console.error("[Backend] Translation error:", error);
      res.status(500).json({ error: error.message || "Failed to translate." });
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
