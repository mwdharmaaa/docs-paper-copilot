/**
 * Docs Paper Copilot - Action Handlers
 * Coordinates communication between UI, active tab, and AI engine.
 */

import { StorageService } from "../core/storage_service.js";
import { PromptTemplates } from "../core/prompt_templates.js";
import { AIClient } from "../core/ai_client.js";
import { DiffViewer } from "./diff_viewer.js";

export const ActionHandlers = {
  async getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  },

  async fetchDocsSelection() {
    const tab = await this.getActiveTab();
    if (!tab || !tab.id) {
      throw new Error("Tidak menemukan tab Google Docs yang aktif.");
    }

    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: "GET_SELECTED_TEXT" });
      return response?.text || "";
    } catch {
      return "";
    }
  },

  async applyToDocs(revisedText) {
    if (!revisedText) {
      throw new Error("Tidak ada teks perbaikan untuk dimasukkan.");
    }

    const tab = await this.getActiveTab();
    if (!tab || !tab.id) {
      throw new Error("Tab Google Docs tidak ditemukan.");
    }

    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "APPLY_REVISION",
        text: revisedText
      });
      return response;
    } catch (err) {
      await navigator.clipboard.writeText(revisedText);
      return { success: true, pasted: false, fallbackCopied: true };
    }
  },

  async runAction(actionId, inputText, customInstruction, uiCallbacks) {
    const { onStart, onSuccess, onError } = uiCallbacks;
    const template = PromptTemplates[actionId] || PromptTemplates.custom;

    if (!inputText || inputText.trim().length === 0) {
      onError(new Error("Pilih teks di Google Docs atau ketik di kotak input teks."));
      return;
    }

    if (actionId === "custom" && (!customInstruction || customInstruction.trim().length === 0)) {
      onError(new Error("Ketik instruksi prompt pada kotak instruksi interaktif."));
      return;
    }

    try {
      onStart();
      const settings = await StorageService.getSettings();
      const prompt = template.buildPrompt(inputText.trim(), customInstruction);
      const revisedText = await AIClient.generate(settings, prompt);

      if (settings.autoCopyOnGenerate) {
        await navigator.clipboard.writeText(revisedText).catch(() => {});
      }

      onSuccess({ original: inputText.trim(), revised: revisedText });
    } catch (err) {
      onError(err);
    }
  }
};
