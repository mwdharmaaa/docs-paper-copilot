/**
 * Ask Gemini for Google Docs - In-Page "Help Me Write" Agent
 * Renders the in-document Gemini widget and coordinates streaming automated typing.
 */

(function initGeminiInPageAgent() {
  if (window.__docsGeminiAgentInitialized) return;
  window.__docsGeminiAgentInitialized = true;

  const root = document.createElement("div");
  root.id = "docs-gemini-agent-root";
  root.innerHTML = `
    <div id="gemini-pill" class="gemini-floating-pill">
      <svg class="gemini-pill-sparkle" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"/>
      </svg>
      <span class="gemini-pill-title">Bantu saya menulis</span>
      <span class="gemini-pill-shortcut">Alt+G</span>
    </div>

    <div id="gemini-modal" class="gemini-inpage-modal" style="display: none;">
      <div class="gemini-modal-header">
        <div class="gemini-header-title">
          <svg class="gemini-pill-sparkle" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"/>
          </svg>
          <span>GTyipe - Bantu Saya Menulis</span>
        </div>
        <button id="gemini-close-btn" class="gemini-btn-close">&times;</button>
      </div>

      <div id="gemini-page-profile-card" class="gemini-page-profile-card">
        <div class="gemini-page-profile-header">
          <div class="gemini-page-profile-title">
            <svg class="gemini-brain-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"/>
            </svg>
            <span>Format Halaman Dipelajari</span>
          </div>
          <button type="button" id="gemini-btn-relearn" class="gemini-btn-relearn" title="Pelajari ulang format halaman">Pelajari Ulang</button>
        </div>
        <div id="gemini-profile-tags" class="gemini-profile-tags">
          <span class="gemini-profile-tag font-tag" id="tag-font">Memindai font...</span>
          <span class="gemini-profile-tag spacing-tag" id="tag-spacing">Spasi...</span>
          <span class="gemini-profile-tag align-tag" id="tag-align">Perataan...</span>
          <span class="gemini-profile-tag tone-tag" id="tag-tone">Gaya...</span>
        </div>
      </div>

      <textarea id="gemini-prompt" class="gemini-inpage-input" placeholder="Tulis draf tentang..., lanjutkan tulisan ini, atau perbaiki gaya bahasa..."></textarea>

      <div class="gemini-chips-row">
        <button type="button" class="gemini-chip" data-cmd="Tulis draf pembuka tentang dampak kecerdasan buatan">Draf Pembuka</button>
        <button type="button" class="gemini-chip" data-cmd="Lanjutkan kalimat ini dengan argumen ilmiah yang kohesif">Lanjutkan Teks</button>
        <button type="button" class="gemini-chip" data-cmd="Perbaiki ejaan, salah ketik, dan tata bahasa PUEBI">Koreksi PUEBI</button>
        <button type="button" class="gemini-chip" data-cmd="Parafrase paragraf ini menggunakan sudut pandang pasif objektif">Parafrase Formal</button>
      </div>

      <div class="gemini-inpage-actions">
        <div id="gemini-status" class="gemini-status-tag">Siap ngetik ke dokumen.</div>
        <button id="gemini-stop-btn" class="gemini-btn-stop" style="display: none;">Hentikan</button>
        <button id="gemini-run-btn" class="gemini-btn-primary">
          <span>Ketik Otomatis ke Docs</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  const pill = document.getElementById("gemini-pill");
  const modal = document.getElementById("gemini-modal");
  const closeBtn = document.getElementById("gemini-close-btn");
  const promptInput = document.getElementById("gemini-prompt");
  const runBtn = document.getElementById("gemini-run-btn");
  const stopBtn = document.getElementById("gemini-stop-btn");
  const statusEl = document.getElementById("gemini-status");
  const chips = document.querySelectorAll(".gemini-chip");
  const tagFont = document.getElementById("tag-font");
  const tagSpacing = document.getElementById("tag-spacing");
  const tagAlign = document.getElementById("tag-align");
  const tagTone = document.getElementById("tag-tone");
  const relearnBtn = document.getElementById("gemini-btn-relearn");

  let activePageProfile = null;

  function updateLearnedPageProfile(forceRefresh = false) {
    if (window.PageLearner) {
      activePageProfile = forceRefresh ? window.PageLearner.learnPage() : window.PageLearner.getProfile();
      if (activePageProfile) {
        if (tagFont) {
          tagFont.textContent = `${activePageProfile.fontFamily} ${activePageProfile.fontSize}`;
          tagFont.title = `Font: ${activePageProfile.fontFamily} (${activePageProfile.fontSize})`;
        }
        if (tagSpacing) {
          tagSpacing.textContent = `Spasi ${activePageProfile.lineSpacing.split(" ")[0]}`;
          tagSpacing.title = `Jarak Baris: ${activePageProfile.lineSpacing}`;
        }
        if (tagAlign) {
          tagAlign.textContent = activePageProfile.alignment.includes("Justify") ? "Justify" : "Rata Kiri";
          tagAlign.title = `Perataan: ${activePageProfile.alignment}`;
        }
        if (tagTone) {
          tagTone.textContent = activePageProfile.genreTag || "Dokumen Formal";
          tagTone.title = `Gaya: ${activePageProfile.writingStyle}\nMargin: ${activePageProfile.margins}`;
        }
      }
    }
  }

  if (relearnBtn) {
    relearnBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      updateLearnedPageProfile(true);
      statusEl.textContent = "Format halaman berhasil dipelajari ulang.";
    };
  }

  function toggleModal(show) {
    const isVisible = show !== undefined ? show : modal.style.display === "none";
    modal.style.display = isVisible ? "flex" : "none";
    if (isVisible) {
      updateLearnedPageProfile(false);
      setTimeout(() => promptInput.focus(), 50);
    }
  }

  pill.onclick = () => toggleModal();
  closeBtn.onclick = () => toggleModal(false);

  window.addEventListener("keydown", (e) => {
    if ((e.altKey && (e.key === "g" || e.key === "G" || e.key === "k" || e.key === "K"))) {
      e.preventDefault();
      toggleModal();
    }
  });

  chips.forEach((chip) => {
    chip.onclick = () => {
      promptInput.value = chip.dataset.cmd;
      promptInput.focus();
    };
  });

  promptInput.onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      runBtn.click();
    }
  };

  stopBtn.onclick = () => {
    if (window.AutoTyper) window.AutoTyper.stop();
    statusEl.textContent = "Pengetikan dihentikan.";
    stopBtn.style.display = "none";
    runBtn.disabled = false;
  };

  function getSelectedDocText() {
    try {
      const iframe = document.querySelector(".docs-texteventtarget-iframe");
      if (iframe && iframe.contentDocument) {
        const frameSel = iframe.contentDocument.getSelection()?.toString().trim();
        if (frameSel) return frameSel;
      }
    } catch {}
    return window.getSelection()?.toString().trim() || "";
  }

  runBtn.onclick = async () => {
    const promptText = promptInput.value.trim();
    if (!promptText) {
      statusEl.textContent = "Ketik instruksi prompt terlebih dahulu.";
      return;
    }

    runBtn.disabled = true;
    stopBtn.style.display = "inline-block";
    statusEl.innerHTML = '<span class="gemini-pulse-dot"></span> Gemini sedang berpikir...';

    // Blur modal controls so Docs iframe can regain focus smoothly
    promptInput.blur();
    runBtn.blur();

    const selected = getSelectedDocText();
    const profile = activePageProfile || (window.PageLearner ? window.PageLearner.getProfile() : null);

    statusEl.innerHTML = `<span class="gemini-pulse-dot"></span> Menulis draf sesuai format (${profile?.fontFamily || 'TNR'}, ${profile?.genreTag || 'Formal'})...`;

    try {
      if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id || typeof chrome.runtime.sendMessage !== "function") {
        statusEl.textContent = "Ekstensi telah dimuat ulang. Harap refresh halaman Docs (Ctrl+R / F5).";
        runBtn.disabled = false;
        stopBtn.style.display = "none";
        return;
      }

      chrome.runtime.sendMessage({
        type: "ASK_GEMINI",
        prompt: promptText,
        selectedContext: selected,
        pageProfile: profile
      }, (res) => {
        if (chrome.runtime.lastError || !res?.success) {
          const rawErr = chrome.runtime.lastError?.message || res?.error || "Gagal memproses";
          if (rawErr.includes("context invalidated") || rawErr.includes("Extension context")) {
            statusEl.textContent = "Ekstensi telah dimuat ulang. Harap refresh halaman Docs (Ctrl+R / F5).";
          } else {
            statusEl.textContent = `Error: ${rawErr}`;
          }
          runBtn.disabled = false;
          stopBtn.style.display = "none";
          return;
        }

        statusEl.innerHTML = '<span class="gemini-pulse-dot"></span> Menyiapkan tulisan...';

        if (window.AutoTyper) {
          setTimeout(() => {
            window.AutoTyper.typeParagraphs(res.text, {
              paragraphDelayMs: 350,
              onProgress: (p) => {
                statusEl.innerHTML = `<span class="gemini-pulse-dot"></span> Menulis paragraf ${p.paragraphIndex} dari ${p.totalParagraphs} (${p.percent}%)...`;
              },
              onComplete: () => {
                statusEl.textContent = "Selesai menulis ke halaman.";
                runBtn.disabled = false;
                stopBtn.style.display = "none";
              },
              onError: (err) => {
                statusEl.textContent = `Error: ${err}`;
                runBtn.disabled = false;
                stopBtn.style.display = "none";
              },
              onCancel: () => {
                statusEl.textContent = "Penulisan dihentikan.";
                runBtn.disabled = false;
                stopBtn.style.display = "none";
              }
            });
          }, 40);
        } else {
          statusEl.textContent = "Error: AutoTyper engine tidak tersedia.";
          runBtn.disabled = false;
          stopBtn.style.display = "none";
        }
      });
    } catch (err) {
      if (err.message && (err.message.includes("context invalidated") || err.message.includes("Extension context"))) {
        statusEl.textContent = "Ekstensi telah dimuat ulang. Harap refresh halaman Docs (Ctrl+R / F5).";
      } else {
        statusEl.textContent = `Error: ${err.message || err}`;
      }
      runBtn.disabled = false;
      stopBtn.style.display = "none";
    }
  };
})();
