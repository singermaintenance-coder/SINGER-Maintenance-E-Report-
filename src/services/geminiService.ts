export async function translateToEnglish(text: string): Promise<string> {
  if (!text.trim()) return "";
  
  try {
    console.log(`[Client] Sending translation request to backend proxy for: "${text.substring(0, 50)}..."`);
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const data = await response.json();
    console.log(`[Client] Received translation response: "${data.translation?.substring(0, 50)}..."`);
    return data.translation || text;
  } catch (error) {
    console.warn("Translation service is currently unavailable or restricted. Using original text as fallback. Details:", error);
    return text; // Fallback to original text if translation fails
  }
}
