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

    let data: any = null;
    try {
      data = await response.json();
    } catch (parseErr) {
      console.error("[Client GeminiService] Failed to parse backend response as JSON:", parseErr);
    }

    if (!response.ok) {
      const errorMsg = data?.error || `HTTP error ${response.status}`;
      console.error(`[Client GeminiService] HTTP bad response. Status: ${response.status}. Error: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    console.log(`[Client GeminiService] Parsed JSON response from backend:`, data);

    if (data && data.error) {
      console.warn(`[Client GeminiService] Translation service returned error: ${data.error}`);
      throw new Error(data.error);
    }

    const result = data?.translation || trimmed;
    
    // Store in cache
    console.log(`[Client GeminiService] Caching successful translation. Key: "${trimmed}" -> Value: "${result}"`);
    translationCache.set(trimmed, result);

    return result;
  } catch (error) {
    console.error("[Client GeminiService] !!! STEP 4 (FAILED): HTTP request, response parsing, or translation failed. Details:", error);
    if (throwOnError) {
      throw error;
    }
    return text; // Fallback to original text if translation fails
  }
}
