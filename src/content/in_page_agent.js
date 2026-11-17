/**
 * Docs Paper Copilot - Gemini Web Experience in Google Docs
 * Embedded wide-screen Gemini Web interface with left-corner dock navigation,
 * multi-turn conversation memory, academic markdown rendering, and
 * autonomous typing into Google Docs complying with strict typography protocols.
 * Zero emojis, pure monochrome & Gemini Dark theme.
 */

(function initGeminiWebExtension() {
  if (window.__docsGeminiAgentInitialized) return;
  window.__docsGeminiAgentInitialized = true;

  // ==========================================================================
  // Helper: Escape HTML & Render Markdown
  // ==========================================================================
  function escapeHtml(str) {
    if (!str || typeof str !== "string") return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderMarkdown(text) {
    if (!text || typeof text !== "string") return "";
    let safe = escapeHtml(text);

    // Code blocks: ```code```
    safe = safe.replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/gi, (m, lang, code) => {
      return `<pre><code>${code.trim()}</code></pre>`;
    });

    // Inline code: `code`
    safe = safe.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Headings: ###, ##, #
    safe = safe.replace(/^### (.*$)/gim, "<h3>$1</h3>");
    safe = safe.replace(/^## (.*$)/gim, "<h2>$1</h2>");
    safe = safe.replace(/^# (.*$)/gim, "<h1>$1</h1>");

    // Bold: **text** or __text__
    safe = safe.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    safe = safe.replace(/__(.*?)__/g, "<strong>$1</strong>");

    // Italic: *text* or _text_
    safe = safe.replace(/\*(.*?)\*/g, "<em>$1</em>");
    safe = safe.replace(/_([^_]+)_/g, "<em>$1</em>");

    // Blockquotes: > text
    safe = safe.replace(/^> (.*$)/gim, "<blockquote>$1</blockquote>");

    // Unordered lists
    safe = safe.replace(/^\s*[\*\-]\s+(.*$)/gim, "<li>$1</li>");
    safe = safe.replace(/(<li>[\s\S]*?<\/li>)/gi, "<ul>$1</ul>");
    safe = safe.replace(/<\/ul>\s*<ul>/g, "");

    // Split paragraphs
    const paras = safe.split(/\n{2,}/);
    return paras.map(p => {
      p = p.trim();
      if (!p) return "";
      if (p.startsWith("<h1>") || p.startsWith("<h2>") || p.startsWith("<h3>") ||
          p.startsWith("<ul>") || p.startsWith("<pre>") || p.startsWith("<blockquote>")) {
        return p;
      }
      return `<p>${p.replace(/\n/g, "<br>")}</p>`;
    }).join("\n");
  }

  // ==========================================================================
  // Helper: Parse AI Response for Discussion vs Clean Draft
  // ==========================================================================
  function parseResponseDraft(rawText) {
    if (!rawText || typeof rawText !== "string") {
      return { discussionText: "", draftText: "", hasDraft: false };
    }

    // 1. Tag draf lengkap atau tag pembuka yang terpotong (unclosed)
    const openMatch = rawText.match(/<{2,4}\s*DRAF[_\s]*DOKUMEN\s*>{2,4}/i);
    if (openMatch) {
      const discussionHead = rawText.substring(0, openMatch.index).trim();
      const afterOpen = rawText.substring(openMatch.index + openMatch[0].length);

      const closeMatch = afterOpen.match(/<{2,4}\s*AKHIR[_\s]*DRAF[_\s]*DOKUMEN\s*>{2,4}/i);
      let draftText = "";
      let discussionTail = "";

      if (closeMatch) {
        draftText = afterOpen.substring(0, closeMatch.index).trim();
        discussionTail = afterOpen.substring(closeMatch.index + closeMatch[0].length).trim();
      } else {
        // Output terpotong di tengah jalan atau tidak ada tag penutup: seluruh isi setelah pembuka adalah draf
        draftText = afterOpen.trim();
      }

      const discussionText = [discussionHead, discussionTail].filter(Boolean).join("\n\n");
      return {
        discussionText: discussionText.trim(),
        draftText: draftText.trim(),
        hasDraft: Boolean(draftText)
      };
    }

    // 2. Tag penutup saja
    const closeMatch = rawText.match(/<{2,4}\s*AKHIR[_\s]*DRAF[_\s]*DOKUMEN\s*>{2,4}/i);
    if (closeMatch) {
      const before = rawText.substring(0, closeMatch.index).trim();
      const after = rawText.substring(closeMatch.index + closeMatch[0].length).trim();
      const headingMatch = before.match(/(?:^|\n+)(BAB\s+(?:[IVXLCDM]+|\d+)|DAFTAR\s+ISI|[A-Z0-9\s,:()\-]{15,}\n|\d+\.\d+\s+[A-Z])/i);
      if (headingMatch && headingMatch.index !== undefined) {
        const splitIdx = headingMatch.index === 0 ? 0 : headingMatch.index;
        const discHead = before.substring(0, splitIdx).trim();
        const draft = before.substring(splitIdx).trim();
        const discussionText = (discHead ? discHead + "\n\n" : "") + after;
        return { discussionText: discussionText.trim(), draftText: draft, hasDraft: true };
      }
      return { discussionText: after, draftText: before, hasDraft: true };
    }

    // 3. Header akademis natural (BAB 1 / DAFTAR ISI)
    const headingMatch = rawText.match(/(?:^|\n+)(BAB\s+(?:[IVXLCDM]+|\d+)|DAFTAR\s+ISI|[A-Z0-9\s,:()\-]{15,}\n|\d+\.\d+\s+[A-Z])/i);
    if (headingMatch && headingMatch.index !== undefined) {
      if (headingMatch.index === 0) {
        return { discussionText: "", draftText: rawText.trim(), hasDraft: true };
      }
      const discHead = rawText.substring(0, headingMatch.index).trim();
      let draft = rawText.substring(headingMatch.index).trim();

      const trailMatch = draft.match(/\n+(?:Bagaimana menurut Anda|Apakah Anda|Silakan beritahu|Jika Anda ingin).*$/is);
      let discTail = "";
      if (trailMatch && trailMatch.index !== undefined) {
        discTail = draft.substring(trailMatch.index).trim();
        draft = draft.substring(0, trailMatch.index).trim();
      }
      const discussionText = [discHead, discTail].filter(Boolean).join("\n\n");
      return { discussionText: discussionText.trim(), draftText: draft, hasDraft: true };
    }

    // Bersihkan sisa tag jika ada yang tertinggal
    const cleanText = rawText
      .replace(/<{2,4}\s*DRAF[_\s]*DOKUMEN\s*>{2,4}/gi, "")
      .replace(/<{2,4}\s*AKHIR[_\s]*DRAF[_\s]*DOKUMEN\s*>{2,4}/gi, "")
      .trim();

    return { discussionText: cleanText, draftText: cleanText, hasDraft: false };
  }

  // ==========================================================================
  // Document Context Extraction
  // ==========================================================================
  function getDocTitle() {
    const titleInput = document.querySelector(".docs-title-input") || document.querySelector("#docs-title-widget input");
    if (titleInput && titleInput.value && titleInput.value.trim()) {
      return titleInput.value.trim();
    }
    const rawTitle = document.title || "";
    const cleaned = rawTitle.replace(/\s*-\s*Google (?:Dokumen|Docs).*$/i, "").trim();
    return cleaned || "Dokumen Google Docs";
  }

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

  // ==========================================================================
  // DOM Mount: Bottom-Right Dock & Wide Gemini Web Overlay
  // ==========================================================================
  const root = document.createElement("div");
  root.id = "docs-gemini-agent-root";
  root.innerHTML = `
    <!-- Bottom-Right Floating Dock Navigation (Gemini) -->
    <div id="gemini-dock-nav" class="gemini-dock-nav" title="Buka Gemini Docs (Alt+G)">
      <svg class="gemini-dock-sparkle" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"/>
      </svg>
      <span class="gemini-dock-title">Gemini</span>
      <span id="gemini-dock-status" class="gemini-dock-status-text">Memasukkan draf...</span>
      <span class="gemini-dock-shortcut">Alt+G</span>
    </div>

    <!-- Wide Gemini Web Overlay -->
    <div id="gemini-wide-overlay" class="gemini-wide-overlay" style="display: none;">
      <div id="gemini-wide-backdrop" class="gemini-wide-backdrop"></div>
      
      <div id="gemini-wide-window" class="gemini-wide-window mode-wide">
        <!-- Header Bar -->
        <div class="gemini-window-header">
          <div class="gemini-header-left">
            <button type="button" id="gemini-toggle-sidebar" class="gemini-icon-btn" title="Buka/Tutup Sidebar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <div class="gemini-brand-badge">
              <svg class="gemini-brand-sparkle" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"/>
              </svg>
              <span class="gemini-brand-title">Gemini</span>
              <span class="gemini-model-badge">Gemini 2.5 Pro</span>
            </div>
          </div>

          <div class="gemini-header-center">
            <span id="gemini-doc-meta-title" class="gemini-doc-meta-title">Dokumen Google Docs</span>
            <span id="gemini-page-format-chip" class="gemini-page-format-chip">Arial 12pt • Justify</span>
          </div>

          <div class="gemini-header-right">
            <button type="button" id="gemini-btn-split" class="gemini-icon-btn" title="Mode Layar Terpisah / Penuh">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="12" y1="3" x2="12" y2="21"></line>
              </svg>
            </button>
            <button type="button" id="gemini-btn-minimize" class="gemini-icon-btn" title="Perkecil ke Dock (Esc)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <button type="button" id="gemini-btn-close" class="gemini-icon-btn danger" title="Tutup Window">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <!-- Window Body: Sidebar + Main Canvas -->
        <div class="gemini-window-body">
          <!-- Collapsible Sidebar -->
          <div id="gemini-sidebar" class="gemini-sidebar">
            <button type="button" id="gemini-new-chat" class="gemini-new-chat-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>+ Chat Baru</span>
            </button>

            <div class="gemini-sidebar-section-title">Format Dokumen</div>
            <div class="gemini-page-format-card">
              <div class="gemini-format-row">
                <span class="gemini-format-label">Font</span>
                <span id="gemini-sidebar-font" class="gemini-format-val">Memindai...</span>
              </div>
              <div class="gemini-format-row">
                <span class="gemini-format-label">Spasi</span>
                <span id="gemini-sidebar-spacing" class="gemini-format-val">1.5 spasi</span>
              </div>
              <div class="gemini-format-row">
                <span class="gemini-format-label">Perataan</span>
                <span id="gemini-sidebar-align" class="gemini-format-val">Justify</span>
              </div>
              <div class="gemini-format-row">
                <span class="gemini-format-label">Gaya</span>
                <span id="gemini-sidebar-tone" class="gemini-format-val">Skripsi Formal</span>
              </div>
              <button type="button" id="gemini-relearn-btn" class="gemini-relearn-btn" title="Kalibrasi ulang font ke standar baku 12pt">
                Kalibrasi Baku 12pt
              </button>
            </div>

            <div class="gemini-sidebar-section-title">Riwayat Sesi</div>
            <div id="gemini-history-list" class="gemini-history-list"></div>

            <div class="gemini-sidebar-footer">
              <button type="button" id="gemini-clear-chat" class="gemini-clear-btn">Bersihkan Percakapan</button>
            </div>
          </div>

          <!-- Center Main Chat Area -->
          <div class="gemini-chat-area">
            <div id="gemini-chat-scroll" class="gemini-chat-scroll">
              <!-- Welcome State (Real Gemini Web Layout) -->
              <div id="gemini-welcome-container" class="gemini-welcome-container">
                <div class="gemini-welcome-heading">
                  <div class="gemini-welcome-hello">Halo,</div>
                  <div class="gemini-welcome-subtitle">Ada yang bisa kubantu tulis hari ini?</div>
                </div>
                <div class="gemini-cards-grid">
                  <div class="gemini-prompt-card" data-prompt="Tuliskan Bab 1 Pendahuluan lengkap dengan latar belakang masalah 4 alinea deduktif, identifikasi masalah, rumusan masalah, dan tujuan penelitian berbobot akademik tinggi">
                    <div class="gemini-card-header">Buat Bab 1 Pendahuluan</div>
                    <div class="gemini-card-desc">Susun latar belakang 4 alinea deduktif, rumusan masalah, dan tujuan penelitian formal.</div>
                  </div>
                  <div class="gemini-prompt-card" data-prompt="Review teks yang sedang saya pilih di dokumen, analisis celah argumennya, dan berikan revisi yang lebih tajam dan akademis">
                    <div class="gemini-card-header">Review & Koreksi Tulisan</div>
                    <div class="gemini-card-desc">Kritisi alur logika, periksa kesesuaian PUEBI, dan perbaiki formulasi kalimat.</div>
                  </div>
                  <div class="gemini-prompt-card" data-prompt="Bantu susun outline dan kerangka penelitian yang komprehensif mulai dari Bab 1 hingga Bab 5">
                    <div class="gemini-card-header">Susun Outline Penelitian</div>
                    <div class="gemini-card-desc">Rancang kerangka bab dari Bab 1 sampai Bab 5 secara sistematis.</div>
                  </div>
                  <div class="gemini-prompt-card" data-prompt="Parafrase kalimat/paragraf ini menjadi gaya bahasa akademik formal dengan sudut pandang pasif objektif dan bernas">
                    <div class="gemini-card-header">Parafrase Akademik Formal</div>
                    <div class="gemini-card-desc">Ubah register bahasa agar bernas, ilmiah, dan bebas dari redundansi kata.</div>
                  </div>
                </div>
              </div>

              <!-- Message Stream -->
              <div id="gemini-messages-list" class="gemini-messages-list"></div>
            </div>

            <!-- Bottom Floating Prompt Bar -->
            <div class="gemini-prompt-bar-area">
              <div class="gemini-quick-chips-row">
                <button type="button" class="gemini-chip-btn" data-prompt="Tuliskan draf pembuka tentang urgensi topik ini">Draf Pembuka</button>
                <button type="button" class="gemini-chip-btn" data-prompt="Lanjutkan paragraf ini dengan argumen ilmiah dan landasan teori yang kuat">Lanjutkan Naskah</button>
                <button type="button" class="gemini-chip-btn" data-prompt="Koreksi salah ketik, tanda baca, dan tata bahasa PUEBI pada teks ini">Koreksi PUEBI</button>
                <button type="button" class="gemini-chip-btn" data-prompt="Parafrase bagian ini menggunakan sudut pandang pasif formal">Parafrase Formal</button>
                <button type="button" class="gemini-chip-btn" data-prompt="Susun Daftar Isi lengkap dengan perataan dot leaders dan nomor halaman tanpa indentasi tab">Daftar Isi Rapi</button>
                <button type="button" class="gemini-chip-btn" data-prompt="Kritisi argumen pada bagian ini dan temukan kelemahan logikanya">Kritik Argumen</button>
              </div>

              <div class="gemini-input-card">
                <textarea id="gemini-textarea-input" class="gemini-textarea-input" rows="1" placeholder="Tanya apa saja, minta draf bab, revisi, atau ide penelitian..."></textarea>
                <div class="gemini-input-bottom-bar">
                  <div class="gemini-input-status-indicator">
                    <span class="gemini-pulse-dot"></span>
                    <span id="gemini-status-text">Siap membantu penulisan dokumen</span>
                  </div>
                  <button type="button" id="gemini-send-btn" class="gemini-send-button" title="Kirim Prompt (Enter)">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  // ==========================================================================
  // Element References
  // ==========================================================================
  const dockNav = document.getElementById("gemini-dock-nav");
  const dockStatus = document.getElementById("gemini-dock-status");
  const overlay = document.getElementById("gemini-wide-overlay");
  const backdrop = document.getElementById("gemini-wide-backdrop");
  const windowEl = document.getElementById("gemini-wide-window");

  const btnClose = document.getElementById("gemini-btn-close");
  const btnMinimize = document.getElementById("gemini-btn-minimize");
  const btnSplit = document.getElementById("gemini-btn-split");
  const btnToggleSidebar = document.getElementById("gemini-toggle-sidebar");
  const sidebar = document.getElementById("gemini-sidebar");

  const docMetaTitle = document.getElementById("gemini-doc-meta-title");
  const headerFormatChip = document.getElementById("gemini-page-format-chip");
  const sidebarFont = document.getElementById("gemini-sidebar-font");
  const sidebarSpacing = document.getElementById("gemini-sidebar-spacing");
  const sidebarAlign = document.getElementById("gemini-sidebar-align");
  const sidebarTone = document.getElementById("gemini-sidebar-tone");
  const btnRelearn = document.getElementById("gemini-relearn-btn");

  const btnNewChat = document.getElementById("gemini-new-chat");
  const btnClearChat = document.getElementById("gemini-clear-chat");
  const historyList = document.getElementById("gemini-history-list");

  const chatScroll = document.getElementById("gemini-chat-scroll");
  const welcomeContainer = document.getElementById("gemini-welcome-container");
  const messagesList = document.getElementById("gemini-messages-list");

  const textareaInput = document.getElementById("gemini-textarea-input");
  const sendBtn = document.getElementById("gemini-send-btn");
  const statusText = document.getElementById("gemini-status-text");

  // ==========================================================================
  // State Management
  // ==========================================================================
  let isWindowOpen = false;
  let isSplitMode = false;
  let activePageProfile = null;
  let chatHistory = []; // [{ role: "user" | "model", text: string }]
  let recentPrompts = [];
  let isTypingInProgress = false;

  // ==========================================================================
  // Auto-resize Textarea
  // ==========================================================================
  function autoResizeTextarea() {
    textareaInput.style.height = "auto";
    const nextH = Math.min(textareaInput.scrollHeight, 180);
    textareaInput.style.height = `${nextH}px`;
  }
  textareaInput.addEventListener("input", autoResizeTextarea);

  // ==========================================================================
  // Window Toggle & Modes
  // ==========================================================================
  function setWindowVisible(visible) {
    isWindowOpen = visible;
    if (visible) {
      overlay.style.display = "flex";
      updateHeaderDocInfo();
      updateLearnedPageProfile(false);
      setTimeout(() => {
        textareaInput.focus();
        autoResizeTextarea();
      }, 60);
    } else {
      overlay.style.display = "none";
    }
  }

  function toggleWindow() {
    setWindowVisible(!isWindowOpen);
  }

  dockNav.onclick = () => toggleWindow();
  backdrop.onclick = () => setWindowVisible(false);
  btnClose.onclick = () => setWindowVisible(false);
  btnMinimize.onclick = () => setWindowVisible(false);

  // Split View Mode (50% left Gemini, 50% right Google Docs)
  btnSplit.onclick = () => {
    isSplitMode = !isSplitMode;
    if (isSplitMode) {
      windowEl.classList.remove("mode-wide");
      windowEl.classList.add("mode-split");
      btnSplit.title = "Mode Layar Penuh (Wide View)";
    } else {
      windowEl.classList.remove("mode-split");
      windowEl.classList.add("mode-wide");
      btnSplit.title = "Mode Layar Terpisah (Split View)";
    }
  };

  // Toggle Sidebar
  btnToggleSidebar.onclick = () => {
    sidebar.classList.toggle("collapsed");
  };

  // Global Shortcuts: Alt+G to toggle, Escape to close
  window.addEventListener("keydown", (e) => {
    if (e.altKey && (e.key === "g" || e.key === "G" || e.key === "k" || e.key === "K")) {
      e.preventDefault();
      toggleWindow();
      return;
    }
    if (e.key === "Escape" && isWindowOpen) {
      e.preventDefault();
      setWindowVisible(false);
    }
  });

  // ==========================================================================
  // Update Profile & Document Header
  // ==========================================================================
  function updateHeaderDocInfo() {
    if (docMetaTitle) {
      docMetaTitle.textContent = getDocTitle();
      docMetaTitle.title = docMetaTitle.textContent;
    }
  }

  function updateLearnedPageProfile(forceRefresh = false) {
    if (window.PageLearner) {
      activePageProfile = forceRefresh ? window.PageLearner.learnPage() : window.PageLearner.getProfile();
      if (activePageProfile) {
        const fontDesc = `${activePageProfile.fontFamily} ${activePageProfile.fontSize}`;
        if (headerFormatChip) {
          headerFormatChip.textContent = `${fontDesc} • ${activePageProfile.alignment.includes("Justify") ? "Justify" : "Rata Kiri"}`;
        }
        if (sidebarFont) sidebarFont.textContent = fontDesc;
        if (sidebarSpacing) sidebarSpacing.textContent = `Spasi ${activePageProfile.lineSpacing.split(" ")[0]}`;
        if (sidebarAlign) sidebarAlign.textContent = activePageProfile.alignment.includes("Justify") ? "Justify" : "Rata Kiri";
        if (sidebarTone) sidebarTone.textContent = activePageProfile.genreTag || "Skripsi Formal";
      }
    }
  }

  btnRelearn.onclick = async (e) => {
    e.preventDefault();
    statusText.textContent = "Mengalibrasi tipografi Google Docs ke standar 12pt...";
    if (window.AutoTyper && typeof window.AutoTyper.calibrateTo12 === "function") {
      await window.AutoTyper.calibrateTo12();
    }
    updateLearnedPageProfile(true);
    statusText.textContent = "Format dokumen diselaraskan ke standar baku (12 pt).";
  };

  // ==========================================================================
  // Autonomous Typing to Google Docs Engine
  // Sesuai TYPING_PROTOCOL.md: 14pt Center Bab, 12pt Justify Body + 1x Tab, No SpellWiz
  // ==========================================================================
  function startTypingToDocs(textToType) {
    if (!textToType || !textToType.trim()) {
      statusText.textContent = "Tidak ada draf yang dapat dimasukkan.";
      return;
    }

    const cleanContent = (window.AutoTyper && typeof window.AutoTyper.cleanMarkdownForDocs === "function")
      ? window.AutoTyper.cleanMarkdownForDocs(textToType)
      : textToType;

    // Minimize wide overlay or switch to split mode so user sees Docs being typed
    if (!isSplitMode) {
      setWindowVisible(false);
    }

    isTypingInProgress = true;
    dockNav.classList.add("typing");
    dockStatus.textContent = "Mengetik draf (0%)...";
    statusText.textContent = "Memasukkan draf lengkap ke Google Docs...";

    if (window.AutoTyper) {
      setTimeout(() => {
        window.AutoTyper.typeDraft(cleanContent, {
          onProgress: (p) => {
            const pctMsg = `Mengetik (${p.percent}%)...`;
            dockStatus.textContent = pctMsg;
            statusText.textContent = `Memasukkan draf ke dokumen (${p.percent}%)...`;
          },
          onComplete: () => {
            isTypingInProgress = false;
            dockNav.classList.remove("typing");
            dockStatus.textContent = "Selesai (100%)";
            statusText.textContent = "Draf berhasil diketik lengkap ke Google Docs.";
            updateLearnedPageProfile(true);
            setTimeout(() => {
              dockStatus.textContent = "";
            }, 5000);
          },
          onError: (err) => {
            isTypingInProgress = false;
            dockNav.classList.remove("typing");
            dockStatus.textContent = "Error pengetikan";
            statusText.textContent = `Error: ${err}`;
          },
          onCancel: () => {
            isTypingInProgress = false;
            dockNav.classList.remove("typing");
            dockStatus.textContent = "Pengetikan dibatalkan";
            statusText.textContent = "Pengetikan dihentikan.";
          }
        });
      }, 50);
    } else {
      isTypingInProgress = false;
      dockNav.classList.remove("typing");
      statusText.textContent = "Error: AutoTyper engine tidak tersedia.";
    }
  }

  // ==========================================================================
  // Render Assistant Message with Gemini Web Aesthetics & Super Action Button
  // ==========================================================================
  function appendMessage(role, text) {
    if (welcomeContainer) welcomeContainer.style.display = "none";

    const row = document.createElement("div");
    row.className = `gemini-msg-row ${role}`;

    if (role === "user") {
      const bubble = document.createElement("div");
      bubble.className = "gemini-msg-bubble user";
      bubble.textContent = text;
      row.appendChild(bubble);
    } else {
      // Gemini Avatar
      const avatar = document.createElement("div");
      avatar.className = "gemini-assistant-avatar";
      avatar.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
          <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"/>
        </svg>
      `;
      row.appendChild(avatar);

      // Gemini Bubble
      const bubble = document.createElement("div");
      bubble.className = "gemini-msg-bubble assistant";

      const { discussionText, draftText, hasDraft } = parseResponseDraft(text);

      // Markdown body
      if (discussionText) {
        const mdEl = document.createElement("div");
        mdEl.className = "gemini-markdown-body";
        mdEl.innerHTML = renderMarkdown(discussionText);
        bubble.appendChild(mdEl);
      }

      // Ready Draft Container
      if (hasDraft && draftText) {
        const draftBox = document.createElement("div");
        draftBox.className = "gemini-draft-box";
        draftBox.innerHTML = `
          <div class="gemini-draft-tag-badge">
            <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13">
              <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
            </svg>
            DRAF DOKUMEN SIAP KETIK
          </div>
          <div class="gemini-draft-text-preview">${escapeHtml(draftText)}</div>
        `;
        bubble.appendChild(draftBox);
      }

      const targetDraftContent = hasDraft ? draftText : (discussionText || text);

      // Super Action Toolbar
      const actionsEl = document.createElement("div");
      actionsEl.className = "gemini-actions-toolbar";

      // 1. PRIMARY: Ketik Otomatis ke Docs
      const btnType = document.createElement("button");
      btnType.type = "button";
      btnType.className = "gemini-action-btn-type";
      btnType.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
          <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
        </svg>
        <span>Ketik Otomatis ke Docs</span>
      `;
      btnType.onclick = () => {
        startTypingToDocs(targetDraftContent);
      };

      // 2. SUB: Salin Teks
      const btnCopy = document.createElement("button");
      btnCopy.type = "button";
      btnCopy.className = "gemini-action-btn-sub";
      btnCopy.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span>Salin</span>
      `;
      btnCopy.onclick = async () => {
        try {
          await navigator.clipboard.writeText(targetDraftContent);
          btnCopy.querySelector("span").textContent = "Tersalin!";
          setTimeout(() => { btnCopy.querySelector("span").textContent = "Salin"; }, 2000);
        } catch {
          statusText.textContent = "Gagal menyalin teks.";
        }
      };

      // 3. SUB: Insert Langsung
      const btnInsert = document.createElement("button");
      btnInsert.type = "button";
      btnInsert.className = "gemini-action-btn-sub";
      btnInsert.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
        <span>Insert</span>
      `;
      btnInsert.onclick = () => {
        if (window.DocsBridge && window.DocsBridge.injectText) {
          window.DocsBridge.injectText(targetDraftContent);
          statusText.textContent = "Draf berhasil dimasukkan ke posisi kursor.";
        } else {
          navigator.clipboard.writeText(targetDraftContent);
          statusText.textContent = "Draf disalin ke clipboard.";
        }
      };

      actionsEl.appendChild(btnType);
      actionsEl.appendChild(btnCopy);
      actionsEl.appendChild(btnInsert);
      bubble.appendChild(actionsEl);

      row.appendChild(bubble);
    }

    messagesList.appendChild(row);
    chatScroll.scrollTo({ top: chatScroll.scrollHeight, behavior: "smooth" });
  }

  // ==========================================================================
  // Sidebar Session History
  // ==========================================================================
  function addHistoryItem(promptText) {
    recentPrompts.push(promptText);
    const item = document.createElement("div");
    item.className = "gemini-history-item active";
    item.textContent = promptText.length > 28 ? promptText.slice(0, 28) + "..." : promptText;
    item.title = promptText;

    // Deselect other items
    document.querySelectorAll(".gemini-history-item").forEach(el => el.classList.remove("active"));
    historyList.prepend(item);
  }

  // ==========================================================================
  // Prompt Execution: Send to Gemini Backend
  // ==========================================================================
  async function submitPrompt(customText = null) {
    const text = (customText !== null ? customText : textareaInput.value).trim();
    if (!text) return;

    appendMessage("user", text);
    chatHistory.push({ role: "user", text });
    addHistoryItem(text);

    textareaInput.value = "";
    autoResizeTextarea();
    sendBtn.disabled = true;
    statusText.textContent = "Gemini sedang memproses & menyusun draf dokumen...";

    const selected = getSelectedDocText();
    const profile = activePageProfile || (window.PageLearner ? window.PageLearner.getProfile() : null);

    try {
      if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
        statusText.textContent = "Ekstensi telah dimuat ulang. Harap refresh tab Google Docs.";
        sendBtn.disabled = false;
        return;
      }

      chrome.runtime.sendMessage({
        type: "ASK_GEMINI",
        prompt: text,
        history: chatHistory.slice(0, -1),
        mode: "discuss",
        selectedContext: selected,
        pageProfile: profile
      }, (res) => {
        sendBtn.disabled = false;
        if (chrome.runtime.lastError || !res?.success) {
          chatHistory.pop();
          const rawErr = chrome.runtime.lastError?.message || res?.error || "Gagal memproses";
          statusText.textContent = `Error: ${rawErr}`;
          return;
        }

        const reply = res.text;
        chatHistory.push({ role: "model", text: reply });
        appendMessage("assistant", reply);
        statusText.textContent = "Tanggapan siap. Klik 'Ketik Otomatis ke Docs' untuk memasukkan draf ke halaman.";
      });
    } catch (err) {
      sendBtn.disabled = false;
      statusText.textContent = `Error: ${err.message || err}`;
    }
  }

  sendBtn.onclick = () => submitPrompt();
  textareaInput.onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitPrompt();
    }
  };

  // Suggestion Cards on Welcome Screen
  document.querySelectorAll(".gemini-prompt-card").forEach((card) => {
    card.onclick = () => {
      const p = card.dataset.prompt;
      if (p) submitPrompt(p);
    };
  });

  // Quick Chips Row
  document.querySelectorAll(".gemini-chip-btn").forEach((chip) => {
    chip.onclick = () => {
      const p = chip.dataset.prompt;
      if (p) submitPrompt(p);
    };
  });

  // New Chat Button
  btnNewChat.onclick = () => {
    chatHistory = [];
    messagesList.innerHTML = "";
    if (welcomeContainer) welcomeContainer.style.display = "flex";
    statusText.textContent = "Sesi baru dimulai. Siap menerima prompt.";
    textareaInput.value = "";
    textareaInput.focus();
    autoResizeTextarea();
  };

  // Clear Chat Button
  btnClearChat.onclick = () => {
    chatHistory = [];
    messagesList.innerHTML = "";
    historyList.innerHTML = "";
    recentPrompts = [];
    if (welcomeContainer) welcomeContainer.style.display = "flex";
    statusText.textContent = "Seluruh riwayat chat telah dibersihkan.";
  };

  // Initial Profiling on Load
  setTimeout(() => {
    updateHeaderDocInfo();
    updateLearnedPageProfile(false);
  }, 1000);
})();
