const translationCache = new Map<string, string>();

export async function translateToEnglish(text: string, throwOnError = false): Promise<string> {
  if (!text.trim()) return "";
  
  const trimmed = text.trim();
  if (translationCache.has(trimmed)) {
    console.log(`[Client] Translation cache hit for: "${trimmed.substring(0, 50)}..."`);
    return translationCache.get(trimmed)!;
  }
  
  try {
    console.log(`[Client] Sending translation request to backend proxy for: "${trimmed.substring(0, 50)}..."`);
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: trimmed }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const data = await response.json();
    console.log(`[Client] Received translation response:`, data);

    if (data.fallback || data.error) {
      const errorMsg = data.error || data.warning || "Translation service fell back to original text.";
      console.warn(`[Client] Translation fallback detected: ${errorMsg}`);
      if (throwOnError) {
        throw new Error(errorMsg);
      }
    }

    const result = data.translation || trimmed;
    
    // Store in cache if it's not a fallback
    if (!data.fallback) {
      translationCache.set(trimmed, result);
    }
    return result;
  } catch (error) {
    console.error("[Client] Translation service failed. Details:", error);
    if (throwOnError) {
      throw error;
    }
    return text; // Fallback to original text if translation fails
  }
}
