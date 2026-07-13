import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // We only allow POST requests
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { text } = req.body;
    console.log(`[Vercel Function] >>> STEP 3a: Received HTTP POST request. text payload: "${text}"`);

    if (!text || typeof text !== "string") {
      console.warn(`[Vercel Function] Bad request: text field missing or not a string. body:`, req.body);
      return res.status(400).json({ error: "Text is required and must be a string." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    console.log(`[Vercel Function] >>> STEP 3b: Checking for GEMINI_API_KEY environment variable. Present: ${!!apiKey}`);
    if (!apiKey) {
      console.warn("[Vercel Function] GEMINI_API_KEY is missing. Falling back to original text immediately.");
      return res.status(200).json({ translation: text, fallback: true, warning: "API Key missing" });
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
          console.log(`[Vercel Function] >>> STEP 3c: [Attempt ${attempt + 1}/${maxAttempts}] Invoking Gemini API model "${modelName}" with input length: ${text.length}`);
          
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
            console.log(`[Vercel Function] Model "${modelName}" supports reasoning. Attaching thinkingConfig...`);
            config.thinkingConfig = {
              thinkingLevel: ThinkingLevel.MINIMAL,
            };
          }

          console.log(`[Vercel Function] >>> STEP 3d: Calling ai.models.generateContent now...`);
          const response = await ai.models.generateContent({
            model: modelName,
            contents: text,
            config
          });
          
          const rawText = response.text?.trim();
          console.log(`[Vercel Function] >>> STEP 3e: Raw response: "${rawText}"`);
          
          if (!rawText) {
            console.warn(`[Vercel Function] Empty raw response from model "${modelName}".`);
            return text;
          }
          
          try {
            const parsed = JSON.parse(rawText);
            if (parsed && typeof parsed.translation === "string") {
              let result = parsed.translation.trim();
              if ((result.startsWith('"') && result.endsWith('"')) || (result.startsWith("'") && result.endsWith("'"))) {
                result = result.substring(1, result.length - 1).trim();
              }
              console.log(`[Vercel Function] >>> STEP 3f: Successfully parsed JSON. Translated text: "${result}"`);
              return result;
            } else {
              console.warn("[Vercel Function] Parsed response did not match expected schema:", parsed);
            }
          } catch (jsonErr: any) {
            console.error("[Vercel Function] JSON Parse Error on raw response:", rawText, jsonErr.message);
          }
          
          return text;
        } catch (err: any) {
          attempt++;
          console.error(`[Vercel Function] Attempt ${attempt} on model "${modelName}" failed with error:`, err.message || err);
          
          if (attempt >= maxAttempts) {
            throw err;
          }
          const delay = Math.pow(2, attempt) * 150 + Math.random() * 50;
          console.log(`[Vercel Function] Model ${modelName} encountered error. Retrying in ${Math.round(delay)}ms...`);
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
        console.log(`[Vercel Function] Translation completed successfully via gemini-3.1-flash-lite`);
      } catch (firstError: any) {
        console.warn(`[Vercel Function] gemini-3.1-flash-lite failed or busy (${firstError.message}). Selecting alternative gemini-3.5-flash...`);
        usedModel = "gemini-3.5-flash";
        translatedText = await executeWithRetry(usedModel, 2);
        console.log(`[Vercel Function] Translation completed successfully via alternate gemini-3.5-flash`);
      }
    } catch (genError: any) {
      console.error("[Vercel Function] !!! BOTH MODELS FAILED. Falling back to returning original text. Error details:", genError.message || genError);
      return res.status(200).json({ 
        translation: text, 
        fallback: true, 
        error: `AI translation service error: ${genError.message || "Failed to parse API response"}` 
      });
    }

    console.log(`[Vercel Function] >>> STEP 3g: Sending translated response back to client: "${translatedText}"`);
    return res.status(200).json({ translation: translatedText });
  } catch (error: any) {
    console.error("[Vercel Function] General translation function error:", error);
    return res.status(200).json({ 
      translation: req.body ? req.body.text : "", 
      fallback: true, 
      error: error.message || "Failed to translate." 
    });
  }
}
