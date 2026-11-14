/**
 * Docs Paper Copilot - Content Script Bridge
 * Handles text insertion and clipboard synchronization with Docs editor.
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

  function showDocsNotification(message, isSuccess = true) {
    const existing = document.getElementById("docs-paper-copilot-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "docs-paper-copilot-toast";
    toast.textContent = message;
    toast.style.position = "fixed";
    toast.style.bottom = "24px";
    toast.style.right = "24px";
    toast.style.zIndex = "999999";
    toast.style.backgroundColor = isSuccess ? "#18181b" : "#7f1d1d";
    toast.style.color = "#f4f4f5";
    toast.style.border = "1px solid " + (isSuccess ? "#27272a" : "#991b1b");
    toast.style.borderRadius = "8px";
    toast.style.padding = "10px 16px";
    toast.style.fontSize = "13px";
    toast.style.fontFamily = "system-ui, -apple-system, sans-serif";
    toast.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.4)";
    toast.style.transition = "opacity 0.2s ease";

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || !request.action) return false;

    if (request.action === "APPLY_REVISION") {
      const { text } = request;
      if (!text) {
        sendResponse({ success: false, error: "Empty text payload" });
        return false;
      }

      navigator.clipboard.writeText(text).then(() => {
        let injected = false;
        if (window.AutoTyper && typeof window.AutoTyper.instantInsert === "function") {
          injected = window.AutoTyper.instantInsert(text);
        } else {
          injected = simulatePaste(text);
        }

        if (injected) {
          showDocsNotification("Revisi berhasil dimasukkan ke dokumen.");
        } else {
          showDocsNotification("Teks telah disalin ke clipboard. Tekan Ctrl+V di Docs.");
        }
        sendResponse({ success: true, pasted: injected });
      }).catch((err) => {
        showDocsNotification("Clipboard access denied: " + err.message, false);
        sendResponse({ success: false, error: err.message });
      });

      return true;
    }

    if (request.action === "AUTO_TYPE_REVISION") {
      const { text, speedMs } = request;
      if (!text) {
        sendResponse({ success: false, error: "Empty text payload" });
        return false;
      }

      if (window.AutoTyper) {
        window.AutoTyper.typeStream(text, {
          speedMs: speedMs || 12,
          onComplete: () => {
            showDocsNotification("Selesai ngetik otomatis ke dokumen.");
          },
          onError: (err) => {
            showDocsNotification(err || "Gagal ngetik ke dokumen.", false);
          }
        });
        sendResponse({ success: true, started: true });
      } else {
        const injected = simulatePaste(text);
        sendResponse({ success: true, fallback: "paste", pasted: injected });
      }
      return true;
    }

    return false;
  });
})();
