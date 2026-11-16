/**
 * Docs Paper Copilot - AI Client
 * Robust API execution for Google Gemini and OpenAI-compatible endpoints.
 * Supports multi-turn conversational discussions and direct autonomous drafting.
 */

import { PromptTemplates } from "./prompt_templates.js";

const DEFAULT_TIMEOUT_MS = 75000; // 75 seconds for long-form academic chapters and discussions

export const AIClient = {
  async executeGemini({ apiKey, model, prompt, contents, systemDirective, temperature = 0.35 }) {
    if (!apiKey) {
      throw new Error("API Key belum diisi. Masukkan Gemini API Key di tab Pengaturan.");
    }

    const defaultModel = "gemini-3.5-flash";
    let chosenModel = model || defaultModel;

    // Normalize deprecated models
    if (chosenModel.includes("gemini-2.5") || chosenModel.includes("gemini-2.0") || chosenModel.includes("gemini-1.5")) {
      chosenModel = chosenModel.includes("pro") ? "gemini-3.8-pro" : defaultModel;
    }

    // Fast-fallback chain: Preferred model first, then ultra-reliable gemini-3.5-flash-lite
    const modelsToTry = [chosenModel];
    if (chosenModel !== "gemini-3.5-flash-lite") {
      modelsToTry.push("gemini-3.5-flash-lite");
    }

    // Prepare contents array
    let contentsPayload = [];
    if (contents && Array.isArray(contents) && contents.length > 0) {
      contentsPayload = contents;
    } else {
      contentsPayload = [{ role: "user", parts: [{ text: prompt || "" }] }];
    }

    let lastError = null;

    for (const currentModel of modelsToTry) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
      const payload = {
        contents: contentsPayload,
        generationConfig: {
          temperature: parseFloat(temperature) || 0.35,
          topP: 0.95,
          maxOutputTokens: 8192
        }
      };

      if (systemDirective) {
        payload.systemInstruction = {
          parts: [{ text: systemDirective }]
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        try {
          controller.abort(new Error("Batas waktu (timeout) terlampaui. Server AI membutuhkan waktu lebih lama untuk memproses permintaan ini."));
        } catch {
          controller.abort();
        }
      }, DEFAULT_TIMEOUT_MS);

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

          // If systemInstruction is rejected, try again without it
          if (payload.systemInstruction && message.toLowerCase().includes("systeminstruction")) {
            delete payload.systemInstruction;
            const retryRes = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
            if (retryRes.ok) {
              const retryData = await retryRes.json();
              const retryText = retryData.candidates?.[0]?.content?.parts?.[0]?.text;
              if (retryText) return retryText.trim();
            }
          }

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
        if (err.name === "AbortError" || (err.message && err.message.toLowerCase().includes("abort"))) {
          lastError = new Error("Permintaan timeout: Server AI membutuhkan waktu lebih lama untuk merespons permintaan ini. Silakan coba lagi.");
        } else {
          lastError = err;
        }
        console.warn(`[GTyipe] Request to ${currentModel} failed or timed out:`, lastError.message);
      }
    }

    throw lastError || new Error("Gagal menghubungi layanan Gemini API.");
  },

  async executeOpenAI({ apiKey, model, prompt, messages, systemDirective, temperature = 0.35 }) {
    if (!apiKey) {
      throw new Error("OpenAI API Key belum diisi. Masukkan API Key di tab Pengaturan.");
    }

    const endpoint = "https://api.openai.com/v1/chat/completions";
    let formattedMessages = [];

    if (systemDirective) {
      formattedMessages.push({ role: "system", content: systemDirective });
    }

    if (messages && Array.isArray(messages) && messages.length > 0) {
      for (const m of messages) {
        formattedMessages.push({
          role: (m.role === "assistant" || m.role === "model") ? "assistant" : "user",
          content: m.text || m.content || ""
        });
      }
    } else if (prompt) {
      formattedMessages.push({ role: "user", content: prompt });
    }

    const payload = {
      model: model || "gpt-4o",
      messages: formattedMessages,
      temperature: parseFloat(temperature) || 0.35,
      max_tokens: 4096
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      try {
        controller.abort(new Error("Batas waktu (timeout) terlampaui. Server OpenAI membutuhkan waktu lebih lama."));
      } catch {
        controller.abort();
      }
    }, DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

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
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError" || (err.message && err.message.toLowerCase().includes("abort"))) {
        throw new Error("Permintaan timeout: Server OpenAI membutuhkan waktu lebih lama untuk memproses permintaan ini.");
      }
      throw err;
    }
  },

  async generate(settings, prompt) {
    let { provider = "gemini", apiKey, model = "gemini-3.5-flash", temperature } = settings;

    if (provider === "gemini") {
      if (!model || model.includes("gemini-2.5") || model.includes("gemini-2.0") || model.includes("gemini-1.5")) {
        model = model && model.includes("pro") ? "gemini-3.8-pro" : "gemini-3.5-flash";
      }
      return this.executeGemini({ apiKey, model, prompt, temperature });
    }

    return this.executeOpenAI({ apiKey, model, prompt, temperature });
  },

  async generateChat(settings, { prompt, history = [], mode = "discuss", selectedContext = "", pageProfile = null }) {
    let { provider = "gemini", apiKey, model = "gemini-3.5-flash", temperature } = settings;

    const systemDirective = PromptTemplates.getSystemDirective(mode, pageProfile);

    // Current turn text combining prompt and selection context if present
    const contextPrefix = selectedContext && selectedContext.trim()
      ? `[Teks Dokumen Aktif yang Ditandai Pengguna]:\n"""\n${selectedContext.trim()}\n"""\n\n`
      : "";
    const currentPromptText = `${contextPrefix}${prompt.trim()}`;

    if (provider === "gemini") {
      if (!model || model.includes("gemini-2.5") || model.includes("gemini-2.0") || model.includes("gemini-1.5")) {
        model = model && model.includes("pro") ? "gemini-3.8-pro" : "gemini-3.5-flash";
      }

      // Build Gemini contents array from history + current message
      const contents = [];
      if (Array.isArray(history)) {
        for (const item of history) {
          const role = (item.role === "model" || item.role === "assistant") ? "model" : "user";
          const text = item.text || item.content || "";
          if (text) {
            contents.push({
              role,
              parts: [{ text }]
            });
          }
        }
      }

      contents.push({
        role: "user",
        parts: [{ text: currentPromptText }]
      });

      const tempToUse = temperature !== undefined ? temperature : (mode === "discuss" ? 0.4 : 0.2);

      return this.executeGemini({
        apiKey,
        model,
        contents,
        systemDirective,
        temperature: tempToUse
      });
    }

    // OpenAI provider
    const messages = [];
    if (Array.isArray(history)) {
      for (const item of history) {
        messages.push({
          role: (item.role === "assistant" || item.role === "model") ? "assistant" : "user",
          content: item.text || item.content || ""
        });
      }
    }
    messages.push({ role: "user", content: currentPromptText });

    const tempToUse = temperature !== undefined ? temperature : (mode === "discuss" ? 0.4 : 0.2);

    return this.executeOpenAI({
      apiKey,
      model,
      messages,
      systemDirective,
      temperature: tempToUse
    });
  }
};
