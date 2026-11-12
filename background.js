/**
 * Docs Paper Copilot - Background Service Worker
 * Manages side panel behavior and cross-context messaging.
 */

import { StorageService } from "./src/core/storage_service.js";
import { AIClient } from "./src/core/ai_client.js";

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
  if (!message || !message.type) {
    return false;
  }

  if (message.type === "PING") {
    sendResponse({ status: "PONG", version: "1.0.0" });
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

  if (message.type === "EXECUTE_AGENT_PROMPT") {
    (async () => {
      try {
        const { prompt, selectedContext } = message;
        const settings = await StorageService.getSettings();
        const systemPrompt = `Kamu adalah AI Agent asisten penulisan dokumen di Google Docs.
Tugas: Jalankan instruksi prompt pengguna langsung untuk konten halaman dokumen.
Instruksi Pengguna: "${prompt}"
${selectedContext ? `\nKonteks/Teks Seleksi Dokumen Saat Ini:\n"""\n${selectedContext}\n"""` : ""}

Aturan:
1. Hasilkan langsung teks konten dokumen yang diinginkan pengguna.
2. JANGAN sertakan kalimat basa-basi seperti "Tentu", "Berikut adalah", atau catatan penutup. Teks ini akan langsung diketik ke dalam halaman dokumen Google Docs.
3. Gunakan register bahasa dan format yang sesuai (e.g. jika diminta outline, berikan poin terstruktur; jika paragraf, berikan teks mengalir).`;

        const generatedText = await AIClient.generate(settings, systemPrompt);
        sendResponse({ success: true, text: generatedText });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  return false;
});
