/**
 * Docs Paper Copilot - Gemini Response Card Component
 * Strictly zero emojis and pure monochrome styling.
 * Parses and separates discussion commentary from clean document drafts.
 */

import { ActionHandlers } from "./action_handlers.js";

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function parseResponseDraft(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return { discussionText: "", draftText: "", hasDraft: false };
  }

  const match = rawText.match(/<<<DRAF_DOKUMEN>>>([\s\S]*?)<<<AKHIR_DRAF_DOKUMEN>>>/);
  if (match) {
    const draftText = match[1].trim();
    const discussionText = rawText.replace(/<<<DRAF_DOKUMEN>>>[\s\S]*?<<<AKHIR_DRAF_DOKUMEN>>>/, "").trim();
    return {
      discussionText,
      draftText,
      hasDraft: true
    };
  }

  return {
    discussionText: rawText.trim(),
    draftText: rawText.trim(),
    hasDraft: false
  };
}

export function renderGeminiCard(rawText, speed, onStatus, mode = "discuss") {
  const card = document.createElement("div");
  card.className = "gemini-card";

  const { discussionText, draftText, hasDraft } = parseResponseDraft(rawText);
  const modeBadgeText = hasDraft ? "Draf Dokumen Siap" : (mode === "discuss" ? "Diskusi" : "Draf Dokumen");

  let draftBoxHtml = "";
  if (hasDraft) {
    draftBoxHtml = `
      <div class="gemini-draft-box">
        <div class="gemini-draft-header">
          <span class="gemini-draft-title">DRAF DOKUMEN SIAP KETIK</span>
          <span class="gemini-draft-sub">Hanya bagian ini yang diketik ke Docs</span>
        </div>
        <div class="gemini-draft-body">${escapeHtml(draftText)}</div>
      </div>
    `;
  }

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

    ${discussionText ? `<div class="gemini-card-body">${escapeHtml(discussionText)}</div>` : ""}
    ${draftBoxHtml}

    <div class="card-action-bar">
      <button type="button" class="action-btn-type btn-auto-type">Ketik Otomatis ke Docs</button>
      <button type="button" class="action-btn-sec btn-instant-insert">Insert Langsung</button>
      <button type="button" class="action-btn-sec btn-copy">Salin</button>
    </div>
    <div class="refine-chips-row">
      <button type="button" class="refine-chip" data-refine="shorten">Persingkat</button>
      <button type="button" class="refine-chip" data-refine="elaborate">Perluas</button>
      <button type="button" class="refine-chip" data-refine="headings">Format Judul</button>
      <button type="button" class="refine-chip" data-refine="daftar_isi">Daftar Isi</button>
      <button type="button" class="refine-chip" data-refine="daftar_pustaka">Daftar Pustaka</button>
      <button type="button" class="refine-chip" data-refine="puebi">PUEBI</button>
    </div>
  `;

  // Content to be typed/inserted into Google Docs (clean draft prioritized)
  const targetContent = hasDraft ? draftText : (discussionText || rawText);

  card.querySelector(".btn-auto-type").onclick = async () => {
    onStatus("GTyipe sedang memasukkan draf ke dokumen Docs...");
    try {
      await ActionHandlers.autoTypeToDocs(targetContent, 0);
      onStatus("Selesai memasukkan satu draf ke dokumen Docs.");
    } catch (err) {
      onStatus(`Error: ${err.message}`);
    }
  };

  card.querySelector(".btn-instant-insert").onclick = async () => {
    try {
      await ActionHandlers.insertToDocs(targetContent);
      onStatus("Konten dimasukkan ke dokumen.");
    } catch (err) {
      onStatus(`Error: ${err.message}`);
    }
  };

  card.querySelector(".btn-copy").onclick = async () => {
    try {
      await navigator.clipboard.writeText(targetContent);
      onStatus("Draf disalin ke clipboard.");
    } catch (err) {
      onStatus(`Error: ${err.message}`);
    }
  };

  card.querySelectorAll(".refine-chip").forEach((chip) => {
    chip.onclick = async () => {
      onStatus(`Menyempurnakan (${chip.dataset.refine})...`);
      try {
        const refined = await ActionHandlers.refineText(targetContent, chip.dataset.refine);
        if (hasDraft) {
          const draftBodyEl = card.querySelector(".gemini-draft-body");
          if (draftBodyEl) draftBodyEl.textContent = refined;
        } else {
          const bodyEl = card.querySelector(".gemini-card-body");
          if (bodyEl) bodyEl.textContent = refined;
        }
        onStatus("Teks berhasil disempurnakan. Siap diketik ke Docs.");
      } catch (err) {
        onStatus(`Error refine: ${err.message}`);
      }
    };
  });

  return card;
}
