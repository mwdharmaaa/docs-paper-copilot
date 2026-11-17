/**
 * Docs Paper Copilot - In-Page "Help Me Write" & Discussion Agent
 * Renders the in-document GTyipe widget with scholar-grade discussions,
 * multi-turn conversation memory, and streaming automated typing into Google Docs.
 * Strictly zero emojis and pure monochrome styling.
 */

(function initGeminiInPageAgent() {
  if (window.__docsGeminiAgentInitialized) return;
  window.__docsGeminiAgentInitialized = true;

  function parseResponseDraft(rawText) {
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

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  const root = document.createElement("div");
  root.id = "docs-gemini-agent-root";
  root.innerHTML = `
    <div id="gemini-pill" class="gemini-floating-pill" title="Buka GTyipe (Alt+G)">
      <svg class="gemini-pill-sparkle" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"/>
      </svg>
      <span class="gemini-pill-title">GTyipe</span>
      <span class="gemini-pill-shortcut">Alt+G</span>
    </div>

    <div id="gemini-modal" class="gemini-inpage-modal" style="display: none;">
      <!-- Header -->
      <div class="gemini-modal-header">
        <div class="gemini-header-left">
          <svg class="gemini-pill-sparkle" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"/>
          </svg>
          <span class="gemini-header-title-text">GTyipe</span>
        </div>

        <div class="gemini-modal-modes">
          <button type="button" class="gemini-mode-btn active" id="inpage-mode-discuss">Diskusi</button>
          <button type="button" class="gemini-mode-btn" id="inpage-mode-write">Tulis Langsung</button>
        </div>

        <button id="gemini-close-btn" class="gemini-btn-close" title="Tutup">&times;</button>
      </div>

      <!-- Page Profile Tags Card -->
      <div id="gemini-page-profile-card" class="gemini-page-profile-card">
        <div class="gemini-page-profile-header">
          <div class="gemini-page-profile-title">
            <span>Format Halaman:</span>
            <span id="gemini-profile-quick-label" class="gemini-profile-quick-label">Memindai...</span>
          </div>
          <button type="button" id="gemini-btn-relearn" class="gemini-btn-relearn" title="Pelajari ulang format halaman">Pelajari Ulang</button>
        </div>
        <div id="gemini-profile-tags" class="gemini-profile-tags">
          <span class="gemini-profile-tag font-tag" id="tag-font">Font...</span>
          <span class="gemini-profile-tag spacing-tag" id="tag-spacing">Spasi...</span>
          <span class="gemini-profile-tag align-tag" id="tag-align">Perataan...</span>
          <span class="gemini-profile-tag tone-tag" id="tag-tone">Gaya...</span>
        </div>
      </div>

      <!-- View: Diskusi & Konsultasi -->
      <div id="inpage-view-discuss" class="inpage-view-section">
        <div id="inpage-chat-feed" class="inpage-chat-feed">
          <div id="inpage-discuss-empty" class="inpage-empty-box">
            <div class="inpage-empty-title">Mitra Diskusi Dokumen</div>
            <div class="inpage-empty-desc">Tanyakan ide, minta review teks seleksi, kritik argumen, atau susun draf bersama.</div>
            <div class="inpage-chips-grid">
              <button type="button" class="inpage-discuss-chip" data-cmd="Review teks seleksi dan berikan kritik konstruktif">Review teks seleksi</button>
              <button type="button" class="inpage-discuss-chip" data-cmd="Bantu susun outline dan kerangka bahasan berikutnya">Bantu susun outline</button>
              <button type="button" class="inpage-discuss-chip" data-cmd="Kritisi argumen pada bagian ini dan cari celah logikanya">Kritisi argumen</button>
              <button type="button" class="inpage-discuss-chip" data-cmd="Berikan 2 alternatif formulasi kalimat yang lebih berbobot">Alternatif kalimat</button>
            </div>
          </div>
          <div id="inpage-messages-list" class="inpage-messages-list"></div>
        </div>

        <div class="inpage-discuss-input-row">
          <textarea id="inpage-discuss-input" class="gemini-inpage-input" rows="2" placeholder="Tanya ide, minta kritik tulisan, atau instruksikan draf..."></textarea>
          <div class="inpage-input-actions">
            <div class="inpage-input-left">
              <button type="button" id="inpage-btn-clear-chat" class="inpage-sub-btn">Bersihkan Chat</button>
            </div>
            <button type="button" id="inpage-btn-send-discuss" class="gemini-btn-primary">Kirim</button>
          </div>
        </div>
      </div>

      <!-- View: Tulis Langsung (Direct Drafter) -->
      <div id="inpage-view-write" class="inpage-view-section" style="display: none;">
        <textarea id="gemini-prompt" class="gemini-inpage-input" rows="3" placeholder="Tulis instruksi draf yang ingin langsung diketik ke dalam dokumen..."></textarea>

        <div class="gemini-chips-row">
          <button type="button" class="gemini-chip" data-cmd="Tulis draf pembuka tentang dampak kecerdasan buatan">Draf Pembuka</button>
          <button type="button" class="gemini-chip" data-cmd="Lanjutkan kalimat ini dengan argumen ilmiah yang kohesif">Lanjutkan Teks</button>
          <button type="button" class="gemini-chip" data-cmd="Perbaiki ejaan, salah ketik, dan tata bahasa PUEBI">Koreksi PUEBI</button>
          <button type="button" class="gemini-chip" data-cmd="Parafrase paragraf ini menggunakan sudut pandang pasif objektif">Parafrase Formal</button>
        </div>

        <div class="gemini-inpage-actions">
          <button type="button" id="gemini-run-btn" class="gemini-btn-primary">
            <span>Ketik Otomatis ke Docs</span>
          </button>
        </div>
      </div>

      <!-- Bottom Global Status Bar -->
      <div class="inpage-status-bar">
        <div id="gemini-status" class="gemini-status-tag">Siap mendiskusikan atau mengetik dokumen.</div>
        <button id="gemini-stop-btn" class="gemini-btn-stop" style="display: none;">Hentikan Pengetikan</button>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  const pill = document.getElementById("gemini-pill");
  const modal = document.getElementById("gemini-modal");
  const closeBtn = document.getElementById("gemini-close-btn");
  const statusEl = document.getElementById("gemini-status");
  const stopBtn = document.getElementById("gemini-stop-btn");

  const modeDiscussBtn = document.getElementById("inpage-mode-discuss");
  const modeWriteBtn = document.getElementById("inpage-mode-write");
  const viewDiscuss = document.getElementById("inpage-view-discuss");
  const viewWrite = document.getElementById("inpage-view-write");

  const discussInput = document.getElementById("inpage-discuss-input");
  const sendDiscussBtn = document.getElementById("inpage-btn-send-discuss");
  const clearChatBtn = document.getElementById("inpage-btn-clear-chat");
  const inpageMessagesList = document.getElementById("inpage-messages-list");
  const inpageDiscussEmpty = document.getElementById("inpage-discuss-empty");

  const promptInput = document.getElementById("gemini-prompt");
  const runBtn = document.getElementById("gemini-run-btn");
  const writeChips = document.querySelectorAll(".gemini-chip");
  const discussChips = document.querySelectorAll(".inpage-discuss-chip");

  const tagFont = document.getElementById("tag-font");
  const tagSpacing = document.getElementById("tag-spacing");
  const tagAlign = document.getElementById("tag-align");
  const tagTone = document.getElementById("tag-tone");
  const quickProfileLabel = document.getElementById("gemini-profile-quick-label");
  const relearnBtn = document.getElementById("gemini-btn-relearn");

  let activePageProfile = null;
  let activeInPageMode = "discuss"; // "discuss" | "write"
  let inPageHistory = []; // [{ role: "user" | "model", text: string }]

  // Mode Switching
  function switchInPageMode(mode) {
    activeInPageMode = mode;
    if (mode === "discuss") {
      modeDiscussBtn.classList.add("active");
      modeWriteBtn.classList.remove("active");
      viewDiscuss.style.display = "flex";
      viewWrite.style.display = "none";
      statusEl.textContent = "Mode Diskusi aktif. Riwayat percakapan tersimpan.";
      setTimeout(() => discussInput.focus(), 50);
    } else {
      modeWriteBtn.classList.add("active");
      modeDiscussBtn.classList.remove("active");
      viewDiscuss.style.display = "none";
      viewWrite.style.display = "flex";
      statusEl.textContent = "Mode Tulis Langsung aktif. Siap ngetik ke dokumen.";
      setTimeout(() => promptInput.focus(), 50);
    }
  }

  modeDiscussBtn.onclick = () => switchInPageMode("discuss");
  modeWriteBtn.onclick = () => switchInPageMode("write");

  function updateLearnedPageProfile(forceRefresh = false) {
    if (window.PageLearner) {
      activePageProfile = forceRefresh ? window.PageLearner.learnPage() : window.PageLearner.getProfile();
      if (activePageProfile) {
        if (quickProfileLabel) {
          quickProfileLabel.textContent = `${activePageProfile.fontFamily} ${activePageProfile.fontSize}`;
        }
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
      if (activeInPageMode === "discuss") {
        setTimeout(() => discussInput.focus(), 50);
      } else {
        setTimeout(() => promptInput.focus(), 50);
      }
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

  writeChips.forEach((chip) => {
    chip.onclick = () => {
      promptInput.value = chip.dataset.cmd;
      promptInput.focus();
    };
  });

  discussChips.forEach((chip) => {
    chip.onclick = () => {
      discussInput.value = chip.dataset.cmd;
      submitDiscussTurn();
    };
  });

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

  // Typewriter Execution Bridge
  function startTypingToDocs(textToType) {
    if (!textToType || !textToType.trim()) {
      statusEl.textContent = "Tidak ada teks yang dapat diketik.";
      return;
    }

    // Clean draft delimiters if any
    const cleanContent = (window.AutoTyper && typeof window.AutoTyper.cleanMarkdownForDocs === "function")
      ? window.AutoTyper.cleanMarkdownForDocs(textToType)
      : textToType;

    stopBtn.style.display = "inline-block";
    statusEl.innerHTML = '<span class="gemini-pulse-dot"></span> Menyiapkan pengetikan ke dokumen...';

    if (window.AutoTyper) {
      setTimeout(() => {
        window.AutoTyper.typeParagraphs(cleanContent, {
          charDelayMs: 6,
          paragraphDelayMs: 220,
          onProgress: (p) => {
            statusEl.innerHTML = `<span class="gemini-pulse-dot"></span> Mengetik paragraf ${p.paragraphIndex} dari ${p.totalParagraphs} (${p.percent}%)...`;
          },
          onComplete: () => {
            statusEl.textContent = "Selesai mengetik ke halaman Docs.";
            stopBtn.style.display = "none";
          },
          onError: (err) => {
            statusEl.textContent = `Error: ${err}`;
            stopBtn.style.display = "none";
          },
          onCancel: () => {
            statusEl.textContent = "Penulisan dihentikan.";
            stopBtn.style.display = "none";
          }
        });
      }, 40);
    } else {
      statusEl.textContent = "Error: AutoTyper engine tidak tersedia.";
      stopBtn.style.display = "none";
    }
  }

  stopBtn.onclick = () => {
    if (window.AutoTyper) window.AutoTyper.stop();
    statusEl.textContent = "Pengetikan dihentikan.";
    stopBtn.style.display = "none";
    if (runBtn) runBtn.disabled = false;
  };

  // Render message item in in-page chat feed
  function appendInPageMessage(role, rawText) {
    if (inpageDiscussEmpty) inpageDiscussEmpty.style.display = "none";

    const msgBox = document.createElement("div");
    msgBox.className = role === "user" ? "inpage-msg-user" : "inpage-msg-assistant";

    if (role === "user") {
      msgBox.textContent = rawText;
    } else {
      const { discussionText, draftText, hasDraft } = parseResponseDraft(rawText);

      if (discussionText) {
        const discEl = document.createElement("div");
        discEl.className = "inpage-msg-content";
        discEl.textContent = discussionText;
        msgBox.appendChild(discEl);
      }

      if (hasDraft) {
        const draftBox = document.createElement("div");
        draftBox.className = "inpage-draft-box";
        draftBox.innerHTML = `
          <div class="inpage-draft-header">
            <span class="inpage-draft-badge">DRAF DOKUMEN SIAP KETIK</span>
          </div>
          <div class="inpage-draft-content">${escapeHtml(draftText)}</div>
        `;
        msgBox.appendChild(draftBox);
      }

      // Content that will be typed into Google Docs (clean draft prioritized)
      const targetContent = hasDraft ? draftText : (discussionText || rawText);

      // Action toolbar for assistant response
      const actionsEl = document.createElement("div");
      actionsEl.className = "inpage-msg-actions";

      const btnType = document.createElement("button");
      btnType.type = "button";
      btnType.className = "inpage-msg-action-btn primary";
      btnType.textContent = "Ketik Otomatis ke Docs";
      btnType.onclick = () => {
        startTypingToDocs(targetContent);
      };

      const btnInsert = document.createElement("button");
      btnInsert.type = "button";
      btnInsert.className = "inpage-msg-action-btn";
      btnInsert.textContent = "Insert";
      btnInsert.onclick = () => {
        if (window.DocsBridge && window.DocsBridge.injectText) {
          window.DocsBridge.injectText(targetContent);
          statusEl.textContent = "Draf dimasukkan ke dokumen.";
        } else {
          navigator.clipboard.writeText(targetContent);
          statusEl.textContent = "Draf disalin ke clipboard.";
        }
      };

      const btnCopy = document.createElement("button");
      btnCopy.type = "button";
      btnCopy.className = "inpage-msg-action-btn";
      btnCopy.textContent = "Salin";
      btnCopy.onclick = () => {
        navigator.clipboard.writeText(targetContent);
        statusEl.textContent = "Draf disalin ke clipboard.";
      };

      actionsEl.appendChild(btnType);
      actionsEl.appendChild(btnInsert);
      actionsEl.appendChild(btnCopy);
      msgBox.appendChild(actionsEl);
    }

    inpageMessagesList.appendChild(msgBox);
    msgBox.scrollIntoView({ behavior: "smooth" });
  }

  // Submit Discuss Turn
  async function submitDiscussTurn() {
    const text = discussInput.value.trim();
    if (!text) return;

    appendInPageMessage("user", text);
    inPageHistory.push({ role: "user", text });

    discussInput.value = "";
    sendDiscussBtn.disabled = true;
    statusEl.innerHTML = '<span class="gemini-pulse-dot"></span> GTyipe sedang menyusun analisis akademis...';

    const selected = getSelectedDocText();
    const profile = activePageProfile || (window.PageLearner ? window.PageLearner.getProfile() : null);

    try {
      if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
        statusEl.textContent = "Ekstensi telah dimuat ulang. Harap refresh tab Docs.";
        sendDiscussBtn.disabled = false;
        return;
      }

      chrome.runtime.sendMessage({
        type: "ASK_GEMINI",
        prompt: text,
        history: inPageHistory.slice(0, -1),
        mode: "discuss",
        selectedContext: selected,
        pageProfile: profile
      }, (res) => {
        sendDiscussBtn.disabled = false;
        if (chrome.runtime.lastError || !res?.success) {
          inPageHistory.pop();
          const rawErr = chrome.runtime.lastError?.message || res?.error || "Gagal memproses";
          statusEl.textContent = `Error: ${rawErr}`;
          return;
        }

        const reply = res.text;
        inPageHistory.push({ role: "model", text: reply });
        appendInPageMessage("assistant", reply);
        statusEl.textContent = "Tanggapan siap. Klik 'Ketik Otomatis ke Docs' untuk mengetik draf ke halaman.";
      });
    } catch (err) {
      sendDiscussBtn.disabled = false;
      statusEl.textContent = `Error: ${err.message || err}`;
    }
  }

  sendDiscussBtn.onclick = () => submitDiscussTurn();
  discussInput.onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitDiscussTurn();
    }
  };

  clearChatBtn.onclick = () => {
    inPageHistory = [];
    inpageMessagesList.innerHTML = "";
    if (inpageDiscussEmpty) inpageDiscussEmpty.style.display = "flex";
    statusEl.textContent = "Riwayat diskusi in-page telah dibersihkan.";
  };

  // Submit Direct Write
  runBtn.onclick = async () => {
    const promptText = promptInput.value.trim();
    if (!promptText) {
      statusEl.textContent = "Ketik instruksi prompt terlebih dahulu.";
      return;
    }

    runBtn.disabled = true;
    statusEl.innerHTML = '<span class="gemini-pulse-dot"></span> GTyipe sedang menyusun draf...';

    promptInput.blur();
    runBtn.blur();

    const selected = getSelectedDocText();
    const profile = activePageProfile || (window.PageLearner ? window.PageLearner.getProfile() : null);

    try {
      if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
        statusEl.textContent = "Ekstensi telah dimuat ulang. Harap refresh tab Docs.";
        runBtn.disabled = false;
        return;
      }

      chrome.runtime.sendMessage({
        type: "ASK_GEMINI",
        prompt: promptText,
        history: [],
        mode: "write",
        selectedContext: selected,
        pageProfile: profile
      }, (res) => {
        runBtn.disabled = false;
        if (chrome.runtime.lastError || !res?.success) {
          const rawErr = chrome.runtime.lastError?.message || res?.error || "Gagal memproses";
          statusEl.textContent = `Error: ${rawErr}`;
          return;
        }

        const { draftText } = parseResponseDraft(res.text);
        startTypingToDocs(draftText);
      });
    } catch (err) {
      runBtn.disabled = false;
      statusEl.textContent = `Error: ${err.message || err}`;
    }
  };

  promptInput.onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      runBtn.click();
    }
  };
})();
