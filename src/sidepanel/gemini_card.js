/**
 * Ask Gemini for Google Docs - Gemini Response Card Component
 */

import { ActionHandlers } from "./action_handlers.js";

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderGeminiCard(text, speed, onStatus) {
  const card = document.createElement("div");
  card.className = "gemini-card";
  card.innerHTML = `
    <div class="gemini-card-header">
      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
        <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"/>
      </svg>
      <span>Gemini</span>
    </div>
    <div class="gemini-card-body">${escapeHtml(text)}</div>
    <div class="card-action-bar">
      <button class="action-btn-type btn-auto-type">Ketik Otomatis ke Docs</button>
      <button class="action-btn-sec btn-instant-insert">Insert Langsung</button>
      <button class="action-btn-sec btn-copy">Salin</button>
    </div>
    <div class="refine-chips-row">
      <button class="refine-chip" data-refine="shorten">Persingkat</button>
      <button class="refine-chip" data-refine="elaborate">Perluas</button>
      <button class="refine-chip" data-refine="formalize">Lebih Formal</button>
      <button class="refine-chip" data-refine="bulletize">Jadikan Poin</button>
      <button class="refine-chip" data-refine="puebi">Koreksi PUEBI</button>
    </div>
  `;

  const bodyEl = card.querySelector(".gemini-card-body");

  card.querySelector(".btn-auto-type").onclick = async () => {
    onStatus("Gemini sedang ngetik otomatis di halaman Docs...");
    await ActionHandlers.autoTypeToDocs(bodyEl.textContent, speed);
    onStatus("Selesai ngetik ke halaman.");
  };

  card.querySelector(".btn-instant-insert").onclick = async () => {
    await ActionHandlers.insertToDocs(bodyEl.textContent);
    onStatus("Konten dimasukkan ke dokumen.");
  };

  card.querySelector(".btn-copy").onclick = async () => {
    await navigator.clipboard.writeText(bodyEl.textContent);
    onStatus("Konten disalin ke clipboard.");
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
