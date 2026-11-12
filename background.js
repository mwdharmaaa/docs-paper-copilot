/**
 * Docs Paper Copilot - Background Service Worker
 * Manages Gemini Docs orchestration and cross-context message routing.
 */

import { StorageService } from "./src/core/storage_service.js";
import { AIClient } from "./src/core/ai_client.js";
import { PromptTemplates } from "./src/core/prompt_templates.js";

chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
      console.warn("Side panel behavior setup fallback:", err);
    });
  }
});

if (chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener(async (tab) => {
    if (tab && tab.id && chrome.sidePanel && chrome.sidePanel.open) {
      await chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false;

  if (message.type === "PING") {
    sendResponse({ status: "PONG", version: "2.0.0" });
    return false;
  }

  if (message.type === "GET_ACTIVE_TAB") {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      sendResponse({ tab: tab || null });
    }).catch((err) => {
      sendResponse({ tab: null, error: err.message });
    });
    return true;
  }

  if (message.type === "EXECUTE_AGENT_PROMPT" || message.type === "ASK_GEMINI") {
    (async () => {
      try {
        const { prompt, selectedContext } = message;
        const settings = await StorageService.getSettings();
        const fullPrompt = PromptTemplates.askGemini(prompt, selectedContext);
        const text = await AIClient.generate(settings, fullPrompt);
        sendResponse({ success: true, text });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.type === "REFINE_TEXT") {
    (async () => {
      try {
        const { text, refineType } = message;
        const settings = await StorageService.getSettings();
        const fullPrompt = PromptTemplates.refine(text, refineType);
        const refined = await AIClient.generate(settings, fullPrompt);
        sendResponse({ success: true, text: refined });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  return false;
});
