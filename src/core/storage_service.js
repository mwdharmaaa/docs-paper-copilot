/**
 * Docs Paper Copilot - Storage Service
 * Unified settings and credentials storage via chrome.storage.local.
 */

const DEFAULT_SETTINGS = {
  provider: "gemini",
  apiKey: "",
  model: "gemini-2.5-flash",
  academicStyle: "formal-id",
  temperature: 0.2,
  autoCopyOnGenerate: true
};

export const StorageService = {
  async getSettings() {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get(DEFAULT_SETTINGS, (items) => {
          resolve({ ...DEFAULT_SETTINGS, ...items });
        });
      });
    }

    try {
      const stored = localStorage.getItem("docs_copilot_settings");
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
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
