/**
 * Docs Paper Copilot - Storage Service
 * Unified settings and credentials storage via chrome.storage.local.
 */

const DEFAULT_SETTINGS = {
  provider: "gemini",
  apiKey: "",
  model: "gemini-3.5-flash-lite",
  academicStyle: "formal-id",
  temperature: 0.2,
  autoCopyOnGenerate: true
};

function normalizeModel(model) {
  if (!model || model.includes("gemini-2.5") || model.includes("gemini-2.0") || model.includes("gemini-1.5") || model === "gemini-3.8-flash") {
    return model && model.includes("pro") ? "gemini-3.8-pro" : "gemini-3.5-flash-lite";
  }
  return model;
}

export const StorageService = {
  async getSettings() {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get(DEFAULT_SETTINGS, (items) => {
          const merged = { ...DEFAULT_SETTINGS, ...items };
          const normalized = normalizeModel(merged.model);
          if (normalized !== merged.model) {
            merged.model = normalized;
            chrome.storage.local.set({ model: normalized });
          }
          resolve(merged);
        });
      });
    }

    try {
      const stored = localStorage.getItem("docs_copilot_settings");
      const current = stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
      current.model = normalizeModel(current.model);
      return current;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  async saveSettings(newSettings) {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.set(newSettings, () => {
          resolve(true);
        });
      });
    }

    try {
      const current = await this.getSettings();
      const merged = { ...current, ...newSettings };
      localStorage.setItem("docs_copilot_settings", JSON.stringify(merged));
      return true;
    } catch {
      return false;
    }
  }
};
