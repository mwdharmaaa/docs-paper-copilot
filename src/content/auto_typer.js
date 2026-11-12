/**
 * Docs Paper Copilot - Auto Typer Engine
 * Simulates human-like or high-speed automated typing into Google Docs editor target.
 */

(function initAutoTyper() {
  const AutoTyper = {
    isTyping: false,
    abortRequested: false,

    getEditorIframe() {
      return document.querySelector(".docs-texteventtarget-iframe");
    },

    getEditorTarget() {
      const iframe = this.getEditorIframe();
      if (iframe && iframe.contentDocument) {
        return iframe.contentDocument.body || iframe.contentDocument.activeElement;
      }
      return document.activeElement || document.body;
    },

    focusEditor() {
      try {
        const iframe = this.getEditorIframe();
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.focus();
        }
        const target = this.getEditorTarget();
        if (target && typeof target.focus === "function") {
          target.focus();
        }
      } catch {
        // Fallback if cross-frame restrictions occur
      }
    },

    insertChunk(chunk) {
      this.focusEditor();
      const iframe = this.getEditorIframe();
      let handled = false;

      // Strategy 1: execCommand insertText in iframe context
      if (iframe && iframe.contentDocument) {
        try {
          handled = iframe.contentDocument.execCommand("insertText", false, chunk);
        } catch {
          handled = false;
        }
      }

      // Strategy 2: Synthetic Clipboard paste event
      if (!handled) {
        const target = this.getEditorTarget();
        try {
          const dt = new DataTransfer();
          dt.setData("text/plain", chunk);
          const pasteEv = new ClipboardEvent("paste", {
            clipboardData: dt,
            bubbles: true,
            cancelable: true
          });
          target.dispatchEvent(pasteEv);
          handled = true;
        } catch {
          handled = false;
        }
      }

      // Strategy 3: Synthetic inputEvent
      if (!handled) {
        const target = this.getEditorTarget();
        try {
          const inputEv = new InputEvent("beforeinput", {
            bubbles: true,
            cancelable: true,
            inputType: "insertText",
            data: chunk
          });
          target.dispatchEvent(inputEv);
          handled = true;
        } catch {
          handled = false;
        }
      }

      return handled;
    },

    async typeStream(text, options = {}) {
      const { speedMs = 18, chunkSize = 1, onProgress, onComplete, onCancel } = options;

      if (!text || text.length === 0) {
        if (onComplete) onComplete();
        return;
      }

      this.isTyping = true;
      this.abortRequested = false;

      const tokens = text.match(/(\s+|\S+)/g) || [text];
      const total = tokens.length;

      for (let i = 0; i < total; i++) {
        if (this.abortRequested) {
          this.isTyping = false;
          this.abortRequested = false;
          if (onCancel) onCancel();
          return;
        }

        const token = tokens[i];
        this.insertChunk(token);

        if (onProgress) {
          onProgress({ current: i + 1, total, percent: Math.round(((i + 1) / total) * 100) });
        }

        const delay = token.trim().length === 0 ? speedMs / 2 : speedMs;
        await new Promise((res) => setTimeout(res, delay));
      }

      this.isTyping = false;
      if (onComplete) onComplete();
    },

    instantInsert(text) {
      this.focusEditor();
      return this.insertChunk(text);
    },

    stop() {
      if (this.isTyping) {
        this.abortRequested = true;
      }
    }
  };

  window.AutoTyper = AutoTyper;
})();
