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
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) {
      return sel.toString().trim();
    }
    return "";
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || !request.action) return false;

    if (request.action === "GET_DOC_INFO") {
      sendResponse({
        id: getDocId(),
        title: getDocTitle(),
        url: window.location.href,
        hasSelection: Boolean(getSelectedTextFallback())
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
})();
