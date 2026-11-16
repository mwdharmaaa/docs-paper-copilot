/**
 * Docs Paper Copilot - Gemini Response Card Component
 * Strictly zero emojis and pure monochrome styling.
 */

import { ActionHandlers } from "./action_handlers.js";

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderGeminiCard(text, speed, onStatus, mode = "discuss") {
  const card = document.createElement("div");
  card.className = "gemini-card";

  const modeBadgeText = mode === "discuss" ? "Diskusi" : "Draf Dokumen";

  card.innerHTML = `
    <div class="gemini-card-header">
      <div class="card-header-left">
        <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
          <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"/>
        </svg>
        <span class="card-header-title">GTyipe</span>
      </div>
      <span class="card-mode-badge">${modeBadgeText}</span>
    </div>
    <div class="gemini-card-body">${escapeHtml(text)}</div>
    <div class="card-action-bar">
      <button type="button" class="action-btn-type btn-auto-type">Ketik Otomatis ke Docs</button>
      <button type="button" class="action-btn-sec btn-instant-insert">Insert Langsung</button>
      <button type="button" class="action-btn-sec btn-copy">Salin</button>
    </div>
    <div class="refine-chips-row">
      <button type="button" class="refine-chip" data-refine="shorten">Persingkat</button>
      <button type="button" class="refine-chip" data-refine="elaborate">Perluas</button>
      <button type="button" class="refine-chip" data-refine="formalize">Lebih Formal</button>
      <button type="button" class="refine-chip" data-refine="bulletize">Jadikan Poin</button>
      <button type="button" class="refine-chip" data-refine="puebi">Koreksi PUEBI</button>
    </div>
  `;

  const bodyEl = card.querySelector(".gemini-card-body");

  card.querySelector(".btn-auto-type").onclick = async () => {
    onStatus("GTyipe sedang ngetik otomatis di dokumen Docs...");
    try {
      await ActionHandlers.autoTypeToDocs(bodyEl.textContent, speed);
      onStatus("Selesai ngetik ke halaman.");
    } catch (err) {
      onStatus(`Error: ${err.message}`);
    }
  };

  card.querySelector(".btn-instant-insert").onclick = async () => {
    try {
      await ActionHandlers.insertToDocs(bodyEl.textContent);
      onStatus("Konten dimasukkan ke dokumen.");
    } catch (err) {
      onStatus(`Error: ${err.message}`);
    }
  };

  card.querySelector(".btn-copy").onclick = async () => {
    try {
      await navigator.clipboard.writeText(bodyEl.textContent);
      onStatus("Konten disalin ke clipboard.");
    } catch (err) {
      onStatus(`Error: ${err.message}`);
    }
  };

  card.querySelectorAll(".refine-chip").forEach((chip) => {
    chip.onclick = async () => {
      onStatus(`Menyempurnakan (${chip.dataset.refine})...`);
      try {
        const refined = await ActionHandlers.refineText(bodyEl.textContent, chip.dataset.refine);
        bodyEl.textContent = refined;
        onStatus("Teks berhasil disempurnakan. Siap diketik ke Docs.");
      } catch (err) {
        onStatus(`Error refine: ${err.message}`);
      }
    };
  });

  return card;
}
