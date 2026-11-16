/**
 * Docs Paper Copilot - Side Panel Controller
 * Handles interactive discussions, multi-turn memory, and autonomous typing.
 * Strictly zero emojis and pure monochrome workflow.
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
  const pageProfileSummary = document.getElementById("page-profile-summary");
  const relearnSidepanelBtn = document.getElementById("btn-relearn-sidepanel");
  const btnModeDiscuss = document.getElementById("btn-mode-discuss");
  const btnModeWrite = document.getElementById("btn-mode-write");

  let currentMode = "discuss"; // "discuss" | "write"
  let conversationHistory = []; // Array of { role: "user" | "model", text: string }
  let currentSelectionContext = "";
  let currentPageProfile = null;

  // Mode Navigation
  function setMode(mode) {
    currentMode = mode;
    if (mode === "discuss") {
      btnModeDiscuss.classList.add("active");
      btnModeWrite.classList.remove("active");
      promptInput.placeholder = "Ajak diskusi, tanya ide, atau minta saran penulisan...";
      footerStatus.textContent = "Mode Diskusi aktif. GTyipe mengingat riwayat percakapan.";
    } else {
      btnModeWrite.classList.add("active");
      btnModeDiscuss.classList.remove("active");
      promptInput.placeholder = "Instruksikan draf yang ingin diketik ke dokumen...";
      footerStatus.textContent = "Mode Tulis Langsung aktif. Fokus pada pembuatan draf dokumen.";
    }
  }

  btnModeDiscuss.onclick = () => setMode("discuss");
  btnModeWrite.onclick = () => setMode("write");

  // Load Settings
  const settings = await StorageService.getSettings();
  document.getElementById("setting-apikey").value = settings.apiKey || "";
  document.getElementById("setting-model").value = settings.model || "gemini-3.5-flash";
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

  // Sync Doc Info, Page Profile & Selection
  async function refreshPageProfile(forceRefresh = false) {
    if (pageProfileSummary) pageProfileSummary.textContent = "Mempelajari format halaman...";
    const profile = await ActionHandlers.fetchPageProfile(forceRefresh);
    if (profile) {
      currentPageProfile = profile;
      if (pageProfileSummary) {
        pageProfileSummary.textContent = profile.badgeText || `${profile.fontFamily} ${profile.fontSize} - ${profile.genreTag}`;
        pageProfileSummary.title = `Font: ${profile.fontFamily} (${profile.fontSize})\nSpasi: ${profile.lineSpacing}\nMargin: ${profile.margins}\nPerataan: ${profile.alignment}\nGaya: ${profile.writingStyle}`;
      }
    } else {
      if (pageProfileSummary) pageProfileSummary.textContent = "Format dokumen standar terhubung.";
    }
  }

  async function refreshDocState() {
    const info = await ActionHandlers.fetchDocInfo();
    if (info?.title) docTitleLabel.textContent = info.title;
    if (info?.pageProfile) {
      currentPageProfile = info.pageProfile;
      if (pageProfileSummary) {
        pageProfileSummary.textContent = currentPageProfile.badgeText;
        pageProfileSummary.title = `Font: ${currentPageProfile.fontFamily} (${currentPageProfile.fontSize})\nSpasi: ${currentPageProfile.lineSpacing}\nMargin: ${currentPageProfile.margins}\nPerataan: ${currentPageProfile.alignment}\nGaya: ${currentPageProfile.writingStyle}`;
      }
    } else {
      refreshPageProfile(false);
    }

    const sel = await ActionHandlers.fetchDocsSelection();
    if (sel && sel.trim().length > 0) {
      currentSelectionContext = sel.trim();
      selectionPreview.textContent = `"${currentSelectionContext.slice(0, 35)}..."`;
      selectionBar.style.display = "flex";
    }
  }
  refreshDocState();

  if (relearnSidepanelBtn) {
    relearnSidepanelBtn.onclick = () => {
      refreshPageProfile(true);
      footerStatus.textContent = "Format halaman berhasil dipelajari ulang.";
    };
  }

  clearSelectionBtn.onclick = () => {
    currentSelectionContext = "";
    selectionBar.style.display = "none";
  };

  // Submit Prompt to Gemini (Multi-turn conversational or direct draft)
  async function submitPrompt(promptText) {
    if (!promptText || promptText.trim().length === 0) return;
    welcomeCard.style.display = "none";

    const cleanPrompt = promptText.trim();

    // Render User Message Bubble
    const userMsg = document.createElement("div");
    userMsg.className = "user-msg";
    userMsg.textContent = cleanPrompt;
    messagesList.appendChild(userMsg);
    userMsg.scrollIntoView({ behavior: "smooth" });

    promptInput.value = "";
    const activeModeLabel = currentMode === "discuss" ? "Mendiskusikan" : "Menulis draf";
    footerStatus.textContent = `GTyipe sedang memproses (${activeModeLabel})...`;
    sendBtn.disabled = true;

    try {
      const responseText = await ActionHandlers.askGemini({
        prompt: cleanPrompt,
        history: conversationHistory,
        mode: currentMode,
        selectedContext: currentSelectionContext,
        pageProfile: currentPageProfile
      });

      // Update multi-turn session history
      conversationHistory.push({ role: "user", text: cleanPrompt });
      conversationHistory.push({ role: "model", text: responseText });

      const speed = parseInt(document.getElementById("setting-speed").value, 10) || 20;
      const card = renderGeminiCard(responseText, speed, (status) => {
        footerStatus.textContent = status;
      }, currentMode);

      messagesList.appendChild(card);
      card.scrollIntoView({ behavior: "smooth" });
      footerStatus.textContent = currentMode === "discuss"
        ? "Siap melanjutkan diskusi atau pilih 'Ketik Otomatis ke Docs'."
        : "Draf siap. Klik 'Ketik Otomatis ke Docs' untuk mengetik ke halaman.";
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
    conversationHistory = [];
    messagesList.innerHTML = "";
    welcomeCard.style.display = "flex";
    footerStatus.textContent = "Riwayat percakapan dibersihkan.";
  };
});
