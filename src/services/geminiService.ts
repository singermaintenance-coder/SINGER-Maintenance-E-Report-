const translationCache = new Map<string, string>();

export async function translateToEnglish(text: string, throwOnError = false): Promise<string> {
  if (!text.trim()) {
    console.log("[Client GeminiService] translateToEnglish called with empty text. Returning empty string.");
    return "";
  }
  
  const trimmed = text.trim();
  if (translationCache.has(trimmed)) {
    console.log(`[Client GeminiService] Translation CACHE HIT for text: "${trimmed}". Returning cached translation: "${translationCache.get(trimmed)}"`);
    return translationCache.get(trimmed)!;
  }
  
  try {
    console.log(`[Client GeminiService] >>> STEP 3: Preparing and sending backend HTTP POST request to "/api/translate" with body payload text: "${trimmed}"`);
    const startTime = Date.now();
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: trimmed }),
    });

    const duration = Date.now() - startTime;
    console.log(`[Client GeminiService] >>> STEP 4: Backend HTTP Response received. Status: ${response.status} (${response.statusText}). Request Duration: ${duration}ms`);

    if (!response.ok) {
      console.error(`[Client GeminiService] HTTP bad response. Status: ${response.status}`);
      throw new Error(`HTTP error ${response.status}`);
    }

    const data = await response.json();
    console.log(`[Client GeminiService] Parsed JSON response from backend:`, data);

    if (data.fallback || data.error) {
      const errorMsg = data.error || data.warning || "Translation service fell back to original text.";
      console.warn(`[Client GeminiService] Translation service returned warning/fallback: ${errorMsg}`);
      if (throwOnError) {
        throw new Error(errorMsg);
      }
    }

    const result = data.translation || trimmed;
    
    // Store in cache if it's not a fallback
    if (!data.fallback) {
      console.log(`[Client GeminiService] Caching successful translation. Key: "${trimmed}" -> Value: "${result}"`);
      translationCache.set(trimmed, result);
    } else {
      console.log(`[Client GeminiService] Skipping caching due to fallback mode`);
    }
    return result;
  } catch (error) {
    console.error("[Client GeminiService] !!! STEP 4 (FAILED): HTTP request or response parsing failed. Details:", error);
    if (throwOnError) {
      throw error;
    }
    return text; // Fallback to original text if translation fails
  }
}
