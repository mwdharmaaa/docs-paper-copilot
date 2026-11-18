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
    return { discussionText: "", draftText: "", clarification: null, hasDraft: false, hasClarification: false };
  }

  let textToProcess = rawText;
  let clarification = null;
  let hasClarification = false;

  // Ekstraksi blok klarifikasi proaktif
  const clarMatch = textToProcess.match(/<{2,4}\s*KLARIFIKASI\s*>{2,4}([\s\S]*?)<{2,4}\s*AKHIR[_\s]*KLARIFIKASI\s*>{2,4}/i);
  if (clarMatch) {
    hasClarification = true;
    const clarBody = clarMatch[1].trim();
    const lines = clarBody.split("\n").map(l => l.trim()).filter(Boolean);
    let question = "";
    const options = [];
    for (const l of lines) {
      if (/^Pertanyaan:/i.test(l)) {
        question = l.replace(/^Pertanyaan:\s*/i, "");
      } else if (/^[-*•]?\s*Opsi\s+([A-Z0-9]+)[:.-]\s*(.*)/i.test(l)) {
        const m = l.match(/^[-*•]?\s*Opsi\s+([A-Z0-9]+)[:.-]\s*(.*)/i);
        options.push({ label: `Opsi ${m[1]}`, text: m[2] });
      } else if (/^[-*•]\s*(.*)/.test(l)) {
        options.push({ label: `Pilihan ${options.length + 1}`, text: l.replace(/^[-*•]\s*/, "") });
      } else if (!question) {
        question = l;
      }
    }
    clarification = { question: question || "Mau difokuskan ke arah mana?", options };
    textToProcess = textToProcess.replace(/<{2,4}\s*KLARIFIKASI\s*>{2,4}[\s\S]*?<{2,4}\s*AKHIR[_\s]*KLARIFIKASI\s*>{2,4}/i, "").trim();
  }

  // 1. Pencocokan tag draf lengkap (fleksibel kurung sudut dan spasi)
  const fullMatch = textToProcess.match(/<{2,4}\s*DRAF[_\s]*DOKUMEN\s*>{2,4}([\s\S]*?)<{2,4}\s*AKHIR[_\s]*DRAF[_\s]*DOKUMEN\s*>{2,4}/i);
  if (fullMatch) {
    const draftText = fullMatch[1].trim();
    const discussionText = textToProcess.replace(/<{2,4}\s*DRAF[_\s]*DOKUMEN\s*>{2,4}[\s\S]*?<{2,4}\s*AKHIR[_\s]*DRAF[_\s]*DOKUMEN\s*>{2,4}/i, "").trim();
    return {
      discussionText,
      draftText,
      clarification,
      hasDraft: true,
      hasClarification
    };
  }

  // 2. Jika hanya tag penutup yang muncul
  const closeMatch = textToProcess.match(/<{2,4}\s*AKHIR[_\s]*DRAF[_\s]*DOKUMEN\s*>{2,4}/i);
  if (closeMatch) {
    const before = textToProcess.substring(0, closeMatch.index).trim();
    const after = textToProcess.substring(closeMatch.index + closeMatch[0].length).trim();
    // Cari titik awal naskah akademik (BAB, Judul Utama kapital, Subbab desimal, atau Daftar Isi)
    const headingMatch = before.match(/(?:^|\n\n)(BAB\s+(?:[IVXLCDM]+|\d+)|DAFTAR\s+ISI|[A-Z0-9\s,:()\-]{15,}\n|\d+\.\d+\s+[A-Z])/i);
    if (headingMatch && headingMatch.index !== undefined) {
      const splitIdx = headingMatch.index === 0 ? 0 : headingMatch.index + 2;
      const discHead = before.substring(0, splitIdx).trim();
      const draft = before.substring(splitIdx).trim();
      const discussionText = (discHead ? discHead + "\n\n" : "") + after;
      return {
        discussionText: discussionText.trim(),
        draftText: draft,
        clarification,
        hasDraft: true,
        hasClarification
      };
    }
    return {
      discussionText: after,
      draftText: before,
      clarification,
      hasDraft: true,
      hasClarification
    };
  }

  // 3. Fallback tanpa tag: Pisahkan sapaan obrolan di awal jika naskah berisi judul akademik
  const headingMatch = textToProcess.match(/(?:^|\n\n)(BAB\s+(?:[IVXLCDM]+|\d+)|DAFTAR\s+ISI|[A-Z0-9\s,:()\-]{15,}\n|\d+\.\d+\s+[A-Z])/i);
  if (headingMatch && headingMatch.index !== undefined && headingMatch.index > 0) {
    const splitIdx = headingMatch.index + 2;
    const discHead = textToProcess.substring(0, splitIdx).trim();
    let draft = textToProcess.substring(splitIdx).trim();

    // Buang pertanyaan penutup obrolan dari naskah
    const trailMatch = draft.match(/\n+(?:Bagaimana menurut Anda|Apakah Anda|Silakan beritahu|Jika Anda ingin).*$/is);
    let discTail = "";
    if (trailMatch && trailMatch.index !== undefined) {
      discTail = draft.substring(trailMatch.index).trim();
      draft = draft.substring(0, trailMatch.index).trim();
    }
    const discussionText = (discHead ? discHead + "\n\n" : "") + discTail;
    return {
      discussionText: discussionText.trim(),
      draftText: draft,
      clarification,
      hasDraft: true,
      hasClarification
    };
  }

  return {
    discussionText: textToProcess.trim(),
    draftText: textToProcess.trim(),
    clarification,
    hasDraft: false,
    hasClarification
  };
}

export function renderGeminiCard(rawText, speed, onStatus, mode = "discuss", onOptionClick = null) {
  const card = document.createElement("div");
  card.className = "gemini-card";

  const { discussionText, draftText, clarification, hasDraft, hasClarification } = parseResponseDraft(rawText);
  const modeBadgeText = hasDraft ? "Draf Dokumen Siap" : (mode === "discuss" ? "Diskusi" : "Draf Dokumen");

  let clarificationHtml = "";
  if (hasClarification && clarification) {
    clarificationHtml = `
      <div class="gemini-clarification-card">
        <div class="gemini-clarification-header">
          <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.67z"/>
          </svg>
          <span>Konsultasi Arah Penulisan (Pilih atau Langsung Ketik Draf)</span>
        </div>
        <div class="gemini-clarification-question">${escapeHtml(clarification.question)}</div>
        <div class="gemini-clarification-options">
          ${clarification.options.map((opt, idx) => `
            <button type="button" class="gemini-clarification-opt-btn" data-opt-idx="${idx}">
              <strong>${escapeHtml(opt.label)}:</strong> ${escapeHtml(opt.text)}
            </button>
          `).join("")}
        </div>
      </div>
    `;
  }

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

    ${clarificationHtml}
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
      <button type="button" class="refine-chip" data-refine="dokter_dokumen">Dokter Dokumen</button>
    </div>
  `;

  // Content to be typed/inserted into Google Docs (clean draft prioritized)
  const targetContent = hasDraft ? draftText : (discussionText || rawText);

  if (hasClarification && clarification && typeof onOptionClick === "function") {
    card.querySelectorAll(".gemini-clarification-opt-btn").forEach((btn) => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.optIdx, 10);
        const opt = clarification.options[idx];
        if (opt) {
          btn.classList.add("selected");
          onOptionClick(`Gunakan ${opt.label}: ${opt.text}. Kembangkan naskah dokumen ini lebih mendalam sesuai fokus tersebut.`);
        }
      };
    });
  }

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
