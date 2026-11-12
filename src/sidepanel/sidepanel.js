/**
 * Ask Gemini for Google Docs - Side Panel Controller
 * Handles conversation flow, document selection context, and auto-typing dispatch.
 */

import { StorageService } from "../core/storage_service.js";
import { ActionHandlers } from "./action_handlers.js";
import { renderGeminiCard } from "./gemini_card.js";

document.addEventListener("DOMContentLoaded", async () => {
  const promptInput = document.getElementById("prompt-input");
  const sendBtn = document.getElementById("btn-send-prompt");
  const messagesList = document.getElementById("messages-list");
  const welcomeCard = document.getElementById("welcome-card");
  const footerStatus = document.getElementById("footer-status");
  const clearChatBtn = document.getElementById("btn-clear-chat");
  const selectionBar = document.getElementById("selection-bar");
  const selectionPreview = document.getElementById("selection-preview");
  const clearSelectionBtn = document.getElementById("btn-clear-selection");
  const settingsDrawer = document.getElementById("settings-drawer");
  const openSettingsBtn = document.getElementById("btn-open-settings");
  const closeSettingsBtn = document.getElementById("btn-close-settings");
  const saveSettingsBtn = document.getElementById("btn-save-settings");
  const docTitleLabel = document.getElementById("doc-title-label");

  let currentSelectionContext = "";

  // Load Settings
  const settings = await StorageService.getSettings();
  document.getElementById("setting-apikey").value = settings.apiKey || "";
  document.getElementById("setting-model").value = settings.model || "gemini-2.5-flash";
  document.getElementById("setting-speed").value = settings.speed || "20";

  openSettingsBtn.onclick = () => settingsDrawer.style.display = "flex";
  closeSettingsBtn.onclick = () => settingsDrawer.style.display = "none";
  saveSettingsBtn.onclick = async () => {
    await StorageService.saveSettings({
      apiKey: document.getElementById("setting-apikey").value.trim(),
      model: document.getElementById("setting-model").value,
      speed: document.getElementById("setting-speed").value
    });
    settingsDrawer.style.display = "none";
    footerStatus.textContent = "Pengaturan tersimpan.";
  };

  // Sync Doc Info & Selection
  async function refreshDocState() {
    const info = await ActionHandlers.fetchDocInfo();
    if (info?.title) docTitleLabel.textContent = info.title;
    const sel = await ActionHandlers.fetchDocsSelection();
    if (sel && sel.trim().length > 0) {
      currentSelectionContext = sel.trim();
      selectionPreview.textContent = `"${currentSelectionContext.slice(0, 35)}..."`;
      selectionBar.style.display = "flex";
    }
  }
  refreshDocState();

  clearSelectionBtn.onclick = () => {
    currentSelectionContext = "";
    selectionBar.style.display = "none";
  };

  // Submit Prompt to Gemini
  async function submitPrompt(promptText) {
    if (!promptText || promptText.trim().length === 0) return;
    welcomeCard.style.display = "none";

    const userMsg = document.createElement("div");
    userMsg.className = "user-msg";
    userMsg.textContent = promptText;
    messagesList.appendChild(userMsg);
    userMsg.scrollIntoView({ behavior: "smooth" });

    promptInput.value = "";
    footerStatus.textContent = "Gemini sedang memproses...";
    sendBtn.disabled = true;

    try {
      const responseText = await ActionHandlers.askGemini(promptText, currentSelectionContext);
      const speed = parseInt(document.getElementById("setting-speed").value, 10) || 20;
      const card = renderGeminiCard(responseText, speed, (status) => {
        footerStatus.textContent = status;
      });
      messagesList.appendChild(card);
      card.scrollIntoView({ behavior: "smooth" });
      footerStatus.textContent = "Siap untuk instruksi berikutnya.";
    } catch (err) {
      footerStatus.textContent = `Error: ${err.message}`;
    } finally {
      sendBtn.disabled = false;
    }
  }

  // Events
  sendBtn.onclick = () => submitPrompt(promptInput.value);
  promptInput.onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitPrompt(promptInput.value);
    }
  };

  document.querySelectorAll(".suggestion-chip").forEach((chip) => {
    chip.onclick = () => submitPrompt(chip.dataset.prompt);
  });

  clearChatBtn.onclick = () => {
    messagesList.innerHTML = "";
    welcomeCard.style.display = "flex";
  };
});
