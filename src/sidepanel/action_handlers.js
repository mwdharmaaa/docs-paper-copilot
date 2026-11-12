/**
 * Docs Paper Copilot - Action Handlers
 * Bridges Side Panel UI with Chrome background worker and active Docs tab.
 */

export const ActionHandlers = {
  async getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  },

  async fetchDocInfo() {
    const tab = await this.getActiveTab();
    if (!tab?.id) return { title: "Google Docs", hasSelection: false };
    try {
      return await chrome.tabs.sendMessage(tab.id, { action: "GET_DOC_INFO" });
    } catch {
      return { title: tab.title?.replace(" - Google Docs", "") || "Google Docs", hasSelection: false };
    }
  },

  async fetchDocsSelection() {
    const tab = await this.getActiveTab();
    if (!tab?.id) return "";
    try {
      const res = await chrome.tabs.sendMessage(tab.id, { action: "GET_SELECTED_TEXT" });
      return res?.text || "";
    } catch {
      return "";
    }
  },

  async autoTypeToDocs(text, speedMs = 16) {
    if (!text) throw new Error("Tidak ada konten untuk diketik.");
    const tab = await this.getActiveTab();
    if (!tab?.id) throw new Error("Tab Google Docs tidak ditemukan.");

    return chrome.tabs.sendMessage(tab.id, {
      action: "AUTO_TYPE_REVISION",
      text,
      speedMs
    });
  },

  async insertToDocs(text) {
    if (!text) throw new Error("Tidak ada konten untuk dimasukkan.");
    const tab = await this.getActiveTab();
    if (!tab?.id) throw new Error("Tab Google Docs tidak ditemukan.");

    try {
      return await chrome.tabs.sendMessage(tab.id, {
        action: "APPLY_REVISION",
        text
      });
    } catch {
      await navigator.clipboard.writeText(text);
      return { success: true, pasted: false, fallbackCopied: true };
    }
  },

  async askGemini(prompt, selectedContext = "") {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: "ASK_GEMINI",
        prompt,
        selectedContext
      }, (res) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!res?.success) {
          reject(new Error(res?.error || "Gagal memproses prompt Gemini."));
        } else {
          resolve(res.text);
        }
      });
    });
  },

  async refineText(text, refineType) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: "REFINE_TEXT",
        text,
        refineType
      }, (res) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!res?.success) {
          reject(new Error(res?.error || "Gagal memproses penyempurnaan teks."));
        } else {
          resolve(res.text);
        }
      });
    });
  }
};
