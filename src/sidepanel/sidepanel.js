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
  const docHealthScore = document.getElementById("doc-health-score");
  const btnToggleHealth = document.getElementById("btn-toggle-health-drawer");
  const docHealthDrawer = document.getElementById("doc-health-drawer");
  const btnCloseHealth = document.getElementById("btn-close-health-drawer");
  const healthDrawerBody = document.getElementById("health-drawer-body");
  const btnHealthCalibrate = document.getElementById("btn-health-calibrate");
  const btnHealthFixPuebi = document.getElementById("btn-health-fix-puebi");

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
  document.getElementById("setting-speed").value = settings.speed !== undefined ? String(settings.speed) : "0";

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

  // Dokter Dokumen: Health UI Controller
  function updateHealthUI(health) {
    if (!health) return;
    if (docHealthScore) {
      docHealthScore.textContent = `${health.score}/100 • ${health.scoreCategory.split(" ")[0]}`;
      if (health.score >= 90) {
        docHealthScore.style.color = "#34a853";
      } else if (health.score >= 70) {
        docHealthScore.style.color = "#fbbc04";
      } else {
        docHealthScore.style.color = "#ea4335";
      }
    }

    if (healthDrawerBody) {
      let html = "";
      if (health.typographyIssues && health.typographyIssues.length > 0) {
        for (const iss of health.typographyIssues) {
          html += `<div class="health-audit-item warning"><span class="health-tag format">Format</span> <strong>${iss.title}:</strong> ${iss.desc}</div>`;
        }
      }
      if (health.puebiIssues && health.puebiIssues.length > 0) {
        const words = health.puebiIssues.map(p => `<code>${p.wrong}</code> &rarr; <code>${p.fix}</code>`).join(", ");
        html += `<div class="health-audit-item warning"><span class="health-tag puebi">PUEBI</span> Kata tidak baku: ${words}</div>`;
      }
      if (health.structureIssues && health.structureIssues.length > 0) {
        for (const iss of health.structureIssues) {
          html += `<div class="health-audit-item danger"><span class="health-tag structure">Struktur</span> <strong>${iss.component}:</strong> ${iss.desc}</div>`;
        }
      }
      if (health.healthyHighlights && health.healthyHighlights.length > 0) {
        for (const h of health.healthyHighlights) {
          html += `<div class="health-audit-item ok"><span class="health-tag ok">Prima</span> ${h}</div>`;
        }
      }
      if (!html) {
        html = '<div class="health-audit-item ok"><span class="health-tag ok">Prima</span> Dokumen terpantau sangat sehat dan sesuai kaidah akademik.</div>';
      }
      healthDrawerBody.innerHTML = html;
    }
  }

  if (btnToggleHealth && docHealthDrawer) {
    btnToggleHealth.onclick = () => {
      docHealthDrawer.style.display = docHealthDrawer.style.display === "none" ? "flex" : "none";
    };
  }
  if (btnCloseHealth && docHealthDrawer) {
    btnCloseHealth.onclick = () => {
      docHealthDrawer.style.display = "none";
    };
  }

  if (btnHealthCalibrate) {
    btnHealthCalibrate.onclick = async () => {
      footerStatus.textContent = "Mengalibrasi tipografi ke 12pt Justify...";
      const ok = await ActionHandlers.calibrateTypography();
      footerStatus.textContent = ok ? "Tipografi berhasil diseragamkan ke 12pt Justify." : "Gagal kalibrasi tipografi.";
      refreshPageProfile(true);
    };
  }

  if (btnHealthFixPuebi) {
    btnHealthFixPuebi.onclick = () => {
      if (docHealthDrawer) docHealthDrawer.style.display = "none";
      submitPrompt("Koreksi seluruh salah ketik, tanda baca, dan kata tidak baku sesuai kaidah baku PUEBI/KBBI pada naskah ini.");
    };
  }

  // Sync Doc Info, Page Profile & Selection
  async function refreshPageProfile(forceRefresh = false) {
    if (pageProfileSummary) pageProfileSummary.textContent = "Mempelajari format halaman...";
    const profile = await ActionHandlers.fetchPageProfile(forceRefresh);
    if (profile) {
      currentPageProfile = profile;
      if (profile.docHealth) {
        updateHealthUI(profile.docHealth);
      }
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
      if (currentPageProfile.docHealth) {
        updateHealthUI(currentPageProfile.docHealth);
      }
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

      const rawSpeed = parseInt(document.getElementById("setting-speed").value, 10);
      const speed = isNaN(rawSpeed) ? 0 : rawSpeed;
      const card = renderGeminiCard(responseText, speed, (status) => {
        footerStatus.textContent = status;
      }, currentMode, (optPrompt) => submitPrompt(optPrompt));

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
