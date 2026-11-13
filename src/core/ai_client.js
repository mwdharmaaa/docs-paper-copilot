/**
 * Docs Paper Copilot - AI Client
 * Robust API execution for Google Gemini and OpenAI-compatible endpoints.
 */

export const AIClient = {
  async executeGemini({ apiKey, model, prompt, temperature = 0.2 }) {
    if (!apiKey) {
      throw new Error("API Key belum diisi. Masukkan Gemini API Key di tab Pengaturan.");
    }

    const preferredModel = (!model || model.includes("gemini-2.5") || model.includes("gemini-2.0") || model.includes("gemini-1.5") || model === "gemini-3.8-flash")
      ? (model && model.includes("pro") ? "gemini-3.8-pro" : "gemini-3.5-flash-lite")
      : model;

    // Fast-fallback chain: Preferred model first, then ultra-fast gemini-3.5-flash-lite
    const modelsToTry = [preferredModel];
    if (preferredModel !== "gemini-3.5-flash-lite") {
      modelsToTry.push("gemini-3.5-flash-lite");
    }

    let lastError = null;

    for (const currentModel of modelsToTry) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: parseFloat(temperature) || 0.2,
          topP: 0.95
        }
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const message = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
          throw new Error(`Gemini API Error (${currentModel}): ${message}`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text;

        if (!text) {
          throw new Error(`Model ${currentModel} tidak menghasilkan respons teks yang valid.`);
        }

        return text.trim();
      } catch (err) {
        clearTimeout(timeoutId);
        lastError = err;
        console.warn(`[Docs Copilot] Request to ${currentModel} failed or timed out:`, err.message);
      }
    }

    throw lastError || new Error("Gagal menghubungi layanan Gemini API.");
  },

  async executeOpenAI({ apiKey, model, prompt, temperature = 0.2 }) {
    if (!apiKey) {
      throw new Error("OpenAI API Key belum diisi. Masukkan API Key di tab Pengaturan.");
    }

    const endpoint = "https://api.openai.com/v1/chat/completions";
    const payload = {
      model: model || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: parseFloat(temperature) || 0.2
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(`OpenAI API Error: ${message}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Model OpenAI tidak mengembalikan konten balasan.");
    }

    return content.trim();
  },

  async generate(settings, prompt) {
    let { provider = "gemini", apiKey, model = "gemini-3.5-flash-lite", temperature } = settings;

    if (provider === "gemini") {
      if (!model || model.includes("gemini-2.5") || model.includes("gemini-2.0") || model.includes("gemini-1.5") || model === "gemini-3.8-flash") {
        model = model && model.includes("pro") ? "gemini-3.8-pro" : "gemini-3.5-flash-lite";
      }
      return this.executeGemini({ apiKey, model, prompt, temperature });
    }

    return this.executeOpenAI({ apiKey, model, prompt, temperature });
  }
};
