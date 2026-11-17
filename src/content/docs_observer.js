/**
 * Docs Paper Copilot - Content Script Observer
 * Monitors active document metadata and user selection state.
 */

(function initDocsObserver() {
  function getDocTitle() {
    const titleInput = document.querySelector(".docs-title-input");
    if (titleInput && titleInput.value) {
      return titleInput.value.trim();
    }
    const docTitleEl = document.querySelector(".docs-title-input-label-inner");
    if (docTitleEl && docTitleEl.textContent) {
      return docTitleEl.textContent.trim();
    }
    return document.title.replace(" - Google Docs", "").trim() || "Untitled Document";
  }

  function getDocId() {
    const match = window.location.pathname.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  function getSelectedTextFallback() {
    try {
      const iframe = document.querySelector(".docs-texteventtarget-iframe");
      if (iframe && iframe.contentDocument) {
        const frameSel = iframe.contentDocument.getSelection()?.toString().trim();
        if (frameSel) return frameSel;
      }
    } catch {}
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) {
      return sel.toString().trim();
    }
    return "";
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || !request.action) return false;

    if (request.action === "GET_DOC_INFO") {
      const pageProfile = window.PageLearner ? window.PageLearner.getProfile() : null;
      sendResponse({
        id: getDocId(),
        title: getDocTitle(),
        url: window.location.href,
        hasSelection: Boolean(getSelectedTextFallback()),
        pageProfile
      });
      return false;
    }

    if (request.action === "GET_PAGE_PROFILE" || request.action === "LEARN_PAGE_FORMAT") {
      const forceRefresh = Boolean(request.forceRefresh);
      const profile = window.PageLearner
        ? (forceRefresh ? window.PageLearner.learnPage() : window.PageLearner.getProfile())
        : null;
      sendResponse({
        success: true,
        pageProfile: profile
      });
      return false;
    }

    if (request.action === "GET_SELECTED_TEXT") {
      const selected = getSelectedTextFallback();
      sendResponse({
        text: selected,
        characterCount: selected.length
      });
      return false;
    }

    return false;
  });

  // ==========================================================================
  // Permanent Google Docs Spell & Grammar Checkup Suppressor
  // Mencegah dan mematikan total popup "Ejaan dan tata bahasa" (Abaikan/Terima).
  // ==========================================================================
  function initSpellCheckSuppressor() {
    const styleId = "gtype-spellcheck-suppressor";

    function ensureStyle(doc) {
      if (!doc || doc.getElementById(styleId)) return;
      try {
        const style = doc.createElement("style");
        style.id = styleId;
        style.textContent = `
          div[class*="docsSpellWiz"],
          div[class*="SpellWiz"],
          div[class*="spellwiz"],
          div[id*="docsSpellWiz"],
          div[id*="SpellWiz"],
          div[id*="av-WBCd"],
          .docsSpellWizCheckupSurface,
          .docsSpellWizCheckupSurfaceHeader,
          .docsSpellWizCheckupSurfaceOriginalWord,
          .docsSpellWizCheckupSurfaceSuggestionButtonContainer,
          .docsSpellWizCheckupSurfaceButtonContainer,
          .docs-spell-bubble,
          .docs-spellcheck-bubble,
          .kix-spell-bubble,
          .docs-bubble:has([class*="SpellWiz"]),
          .docs-bubble:has([class*="spell"]),
          .docs-bubble:has([class*="Spell"]),
          .docs-callout-bubble:has([class*="SpellWiz"]),
          .docs-callout-bubble:has([class*="spell"]),
          div:has(> .docsSpellWizCheckupSurface),
          div:has(> [class*="SpellWiz"]),
          div:has(> [class*="docsSpellWiz"]),
          div[aria-label*="Ejaan dan tata bahasa"],
          div[aria-label*="Spelling and grammar"],
          div[aria-label*="Saran ejaan"],
          div[aria-label*="Spelling suggestion"] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            position: fixed !important;
            top: -99999px !important;
            left: -99999px !important;
            z-index: -999999 !important;
            width: 0 !important;
            height: 0 !important;
            max-width: 0 !important;
            max-height: 0 !important;
            clip: rect(0, 0, 0, 0) !important;
          }
        `;
        (doc.head || doc.documentElement).appendChild(style);
      } catch {}
    }

    ensureStyle(document);

    function dismissSpellPopups(root = document) {
      try {
        const iframe = document.querySelector(".docs-texteventtarget-iframe");
        if (iframe && iframe.contentDocument) {
          ensureStyle(iframe.contentDocument);
          if (iframe.contentDocument.body) {
            iframe.contentDocument.body.setAttribute("spellcheck", "false");
          }
        }

        const elements = root.querySelectorAll(
          '.docsSpellWizCheckupSurface, [class*="docsSpellWiz"], [class*="SpellWiz"], [class*="spellwiz"], [id*="docsSpellWiz"], [id*="SpellWiz"], .docs-spell-bubble, .docs-spellcheck-bubble, div[aria-label*="Ejaan dan tata bahasa"], div[aria-label*="Spelling and grammar"]'
        );

        for (const el of elements) {
          try {
            const ignoreBtn = el.querySelector("button, [role='button']") ||
                              el.closest("div")?.querySelector("button, [role='button']");
            if (ignoreBtn && /abaikan|ignore/i.test(ignoreBtn.textContent || "")) {
              ignoreBtn.click();
            }

            const container = el.closest(".docs-bubble, .docs-callout-bubble, div[role='dialog'], div[style*='z-index']") || el;
            container.style.display = "none";
            container.style.visibility = "hidden";
            container.style.opacity = "0";
            container.remove();
          } catch {
            try { el.remove(); } catch { el.style.display = "none"; }
          }
        }
      } catch {}
    }

    try {
      const observer = new MutationObserver((mutations) => {
        let hasSpell = false;
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const className = node.className || "";
              const id = node.id || "";
              if (
                (typeof className === "string" && (className.includes("SpellWiz") || className.includes("docsSpellWiz") || className.includes("spell-bubble"))) ||
                (typeof id === "string" && (id.includes("docsSpellWiz") || id.includes("SpellWiz") || id.includes("av-WBCd"))) ||
                (node.textContent && node.textContent.includes("Ejaan dan tata bahasa")) ||
                node.querySelector?.('.docsSpellWizCheckupSurface, [class*="SpellWiz"], [class*="docsSpellWiz"]')
              ) {
                hasSpell = true;
                const container = node.closest(".docs-bubble, .docs-callout-bubble, div[role='dialog'], div[style*='z-index']") || node;
                try { container.remove(); } catch { container.style.display = "none"; }
              }
            }
          }
        }
        if (hasSpell) {
          dismissSpellPopups();
        }
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    } catch {}

    setInterval(() => {
      ensureStyle(document);
      dismissSpellPopups();
    }, 600);
  }

  initSpellCheckSuppressor();
})();
