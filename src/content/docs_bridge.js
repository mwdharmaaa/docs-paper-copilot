/**
 * Docs Paper Copilot - Content Script Bridge
 * Handles text insertion and clipboard synchronization with Docs editor.
 * Strictly zero emojis and pure monochrome styling.
 */

(function initDocsBridge() {
  function getDocsEditorTarget() {
    if (window.AutoTyper && typeof window.AutoTyper.getEditorTarget === "function") {
      return window.AutoTyper.getEditorTarget();
    }
    const iframe = document.querySelector(".docs-texteventtarget-iframe");
    if (iframe && iframe.contentDocument) {
      return (
        iframe.contentDocument.querySelector("[contenteditable=true]") ||
        iframe.contentDocument.querySelector("[role=textbox]") ||
        iframe.contentDocument.body
      );
    }
    return document.activeElement || document.body;
  }

  function simulatePaste(text) {
    if (window.AutoTyper && typeof window.AutoTyper.instantInsert === "function") {
      const inserted = window.AutoTyper.instantInsert(text);
      if (inserted) return true;
    }

    const target = getDocsEditorTarget();
    if (!target) return false;

    try {
      const dt = new DataTransfer();
      dt.setData("text/plain", text);
      const pasteEvent = new ClipboardEvent("paste", {
        clipboardData: dt,
        bubbles: true,
        cancelable: true
      });
      target.dispatchEvent(pasteEvent);
      return true;
    } catch (err) {
      console.warn("Direct paste dispatch fallback:", err);
      return false;
    }
  }

  function showDocsNotification(message) {
    const existing = document.getElementById("docs-paper-copilot-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "docs-paper-copilot-toast";
    toast.textContent = message;
    toast.style.position = "fixed";
    toast.style.bottom = "24px";
    toast.style.right = "24px";
    toast.style.zIndex = "999999";
    toast.style.backgroundColor = "#181818";
    toast.style.color = "#f0f0f0";
    toast.style.border = "1px solid #383838";
    toast.style.borderRadius = "8px";
    toast.style.padding = "10px 16px";
    toast.style.fontSize = "12px";
    toast.style.fontFamily = "system-ui, -apple-system, sans-serif";
    toast.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.6)";
    toast.style.transition = "opacity 0.2s ease";

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  window.DocsBridge = {
    injectText(text) {
      const cleanText = (window.AutoTyper && typeof window.AutoTyper.cleanMarkdownForDocs === "function")
        ? window.AutoTyper.cleanMarkdownForDocs(text)
        : text;

      navigator.clipboard.writeText(cleanText).then(() => {
        let injected = false;
        if (window.AutoTyper && typeof window.AutoTyper.instantInsert === "function") {
          injected = window.AutoTyper.instantInsert(cleanText);
        } else {
          injected = simulatePaste(cleanText);
        }

        if (injected) {
          showDocsNotification("Revisi berhasil dimasukkan ke dokumen.");
        } else {
          showDocsNotification("Teks telah disalin ke clipboard. Tekan Ctrl+V di Docs.");
        }
      }).catch(() => {
        showDocsNotification("Teks gagal dimasukkan.");
      });
    },
    showNotification: showDocsNotification
  };

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || !request.action) return false;

    if (request.action === "APPLY_REVISION") {
      const { text } = request;
      if (!text) {
        sendResponse({ success: false, error: "Empty text payload" });
        return false;
      }

      window.DocsBridge.injectText(text);
      sendResponse({ success: true });
      return true;
    }

    if (request.action === "AUTO_TYPE_REVISION") {
      const { text } = request;
      if (!text) {
        sendResponse({ success: false, error: "Empty text payload" });
        return false;
      }

      if (window.AutoTyper) {
        window.AutoTyper.typeDraft(text, {
          onComplete: () => {
            showDocsNotification("Selesai memasukkan satu draf ke dokumen.");
          },
          onError: (err) => {
            showDocsNotification(err || "Gagal memasukkan draf ke dokumen.");
          }
        });
        sendResponse({ success: true, started: true });
      } else {
        const cleanText = (window.AutoTyper && typeof window.AutoTyper.cleanMarkdownForDocs === "function")
          ? window.AutoTyper.cleanMarkdownForDocs(text)
          : text;
        const injected = simulatePaste(cleanText);
        sendResponse({ success: true, fallback: "paste", pasted: injected });
      }
      return true;
    }

    return false;
  });
})();
