const translationCache = new Map<string, string>();

export async function translateToEnglish(text: string): Promise<string> {
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
    console.log(`[Client] Received translation response: "${data.translation?.substring(0, 50)}..."`);
    const result = data.translation || trimmed;
    
    // Store in cache
    translationCache.set(trimmed, result);
    return result;
  } catch (error) {
    console.warn("Translation service is currently unavailable or restricted. Using original text as fallback. Details:", error);
    return text; // Fallback to original text if translation fails
  }
}
