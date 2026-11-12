/**
 * Docs Paper Copilot - Side Panel Entry Controller
 */

import { StorageService } from "../core/storage_service.js";
import { ActionHandlers } from "./action_handlers.js";
import { DiffViewer } from "./diff_viewer.js";

let activeAction = "puebi";
let lastRevision = { original: "", revised: "" };

document.addEventListener("DOMContentLoaded", async () => {
  const tabs = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");
  const actionCards = document.querySelectorAll(".action-card");
  const inputText = document.getElementById("input-text");
  const outputText = document.getElementById("output-text");
  const btnRun = document.getElementById("btn-run-process");
  const btnSync = document.getElementById("btn-sync-selection");
  const btnApply = document.getElementById("btn-apply-docs");
  const btnCopy = document.getElementById("btn-copy-result");
  const diffBox = document.getElementById("diff-container");
  const statusText = document.getElementById("status-text");

  // Tab Navigation
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tabContents.forEach((c) => (c.style.display = "none"));
      tab.classList.add("active");
      const target = document.getElementById(tab.dataset.tab);
      if (target) target.style.display = "block";
    });
  });

  // Action Mode Selection
  actionCards.forEach((card) => {
    card.addEventListener("click", () => {
      actionCards.forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      activeAction = card.dataset.action;
    });
  });

  // Load Settings
  const settings = await StorageService.getSettings();
  document.getElementById("setting-provider").value = settings.provider || "gemini";
  document.getElementById("setting-apikey").value = settings.apiKey || "";
  document.getElementById("setting-model").value = settings.model || "gemini-2.5-flash";

  document.getElementById("btn-save-settings").addEventListener("click", async () => {
    const updated = {
      provider: document.getElementById("setting-provider").value,
      apiKey: document.getElementById("setting-apikey").value.trim(),
      model: document.getElementById("setting-model").value.trim()
    };
    await StorageService.saveSettings(updated);
    statusText.textContent = "Pengaturan berhasil disimpan.";
  });

  // Sync Docs Selection
  btnSync.addEventListener("click", async () => {
    statusText.textContent = "Mengambil seleksi dari Google Docs...";
    let sel = await ActionHandlers.fetchDocsSelection();
    if (!sel) {
      try {
        const clipText = await navigator.clipboard.readText();
        if (clipText && clipText.trim().length > 0) {
          sel = clipText.trim();
        }
      } catch {}
    }
    if (sel) {
      inputText.value = sel;
      statusText.textContent = `Berhasil mengambil ${sel.length} karakter.`;
    } else {
      statusText.textContent = "Tidak ada teks terseleksi. Salin teks (Ctrl+C) di Docs lalu klik lagi.";
    }
  });

  // Run AI Process
  btnRun.addEventListener("click", () => {
    ActionHandlers.runAction(activeAction, inputText.value, {
      onStart: () => {
        btnRun.disabled = true;
        statusText.textContent = "Memproses teks dengan AI...";
      },
      onSuccess: ({ original, revised }) => {
        btnRun.disabled = false;
        outputText.value = revised;
        lastRevision = { original, revised };
        DiffViewer.renderToElement(diffBox, original, revised);
        statusText.textContent = "Perbaikan selesai. Siap diterapkan.";
      },
      onError: (err) => {
        btnRun.disabled = false;
        statusText.textContent = `Error: ${err.message}`;
      }
    });
  });

  // Apply to Google Docs
  btnApply.addEventListener("click", async () => {
    const textToApply = outputText.value;
    if (!textToApply) return;
    statusText.textContent = "Menerapkan revisi ke Google Docs...";
    const res = await ActionHandlers.applyToDocs(textToApply);
    if (res?.success) {
      statusText.textContent = res.pasted
        ? "Berhasil ditimpa langsung ke Google Docs."
        : "Tersalin ke clipboard. Tekan Ctrl+V di Docs.";
    }
  });

  // Copy Result
  btnCopy.addEventListener("click", async () => {
    if (!outputText.value) return;
    await navigator.clipboard.writeText(outputText.value);
    statusText.textContent = "Hasil revisi berhasil disalin ke clipboard.";
  });
});
