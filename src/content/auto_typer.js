/**
 * Docs Paper Copilot - Auto Typer Engine
 * Simulates human-like or high-speed automated typing into Google Docs editor target.
 */

(function initAutoTyper() {
  const AutoTyper = {
    isTyping: false,
    abortRequested: false,

    getEditorIframe() {
      return (
        document.querySelector("iframe.docs-texteventtarget-iframe") ||
        document.querySelector(".docs-texteventtarget-iframe") ||
        document.querySelector("iframe[class*='texteventtarget']")
      );
    },

    getEditorTarget() {
      const iframe = this.getEditorIframe();
      if (iframe) {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (doc) {
            const editable =
              doc.querySelector("[contenteditable='true']") ||
              doc.querySelector("[role='textbox']") ||
              (doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : null) ||
              doc.body;
            if (editable) return editable;
          }
        } catch (e) {
          console.warn("[AutoTyper] Accessing iframe document restricted:", e);
        }
      }

      return (
        document.querySelector(".kix-appview-editor [contenteditable='true']") ||
        document.querySelector(".kix-appview-editor [role='textbox']") ||
        document.querySelector("[contenteditable='true']") ||
        document.querySelector(".kix-appview-editor") ||
        document.body
      );
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
      } catch (err) {
        console.warn("[AutoTyper] focusEditor fallback:", err);
      }
    },

    insertChunk(chunk) {
      const iframe = this.getEditorIframe();
      const target = this.getEditorTarget();
      if (!target) return false;

      this.focusEditor();

      const isNewline = (chunk === "\n" || chunk === "\r\n" || chunk === "\r");

      if (isNewline) {
        try {
          target.dispatchEvent(new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
            composed: true
          }));

          target.dispatchEvent(new InputEvent("beforeinput", {
            inputType: "insertParagraph",
            bubbles: true,
            cancelable: true,
            composed: true
          }));

          let execSuccess = false;
          if (iframe && iframe.contentDocument) {
            try {
              execSuccess = iframe.contentDocument.execCommand("insertParagraph", false);
            } catch {}
          }
          if (!execSuccess) {
            try {
              execSuccess = document.execCommand("insertParagraph", false);
            } catch {}
          }

          target.dispatchEvent(new InputEvent("input", {
            inputType: "insertParagraph",
            bubbles: true,
            cancelable: false,
            composed: true
          }));

          target.dispatchEvent(new KeyboardEvent("keyup", {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
            composed: true
          }));

          return true;
        } catch (e) {
          console.warn("[AutoTyper] insert newline failed:", e);
          return false;
        }
      }

      try {
        target.dispatchEvent(new KeyboardEvent("keydown", {
          key: chunk,
          bubbles: true,
          cancelable: true,
          composed: true
        }));

        target.dispatchEvent(new InputEvent("beforeinput", {
          inputType: "insertText",
          data: chunk,
          bubbles: true,
          cancelable: true,
          composed: true
        }));

        let execHandled = false;
        if (iframe && iframe.contentDocument) {
          try {
            execHandled = iframe.contentDocument.execCommand("insertText", false, chunk);
          } catch {}
        }
        if (!execHandled) {
          try {
            execHandled = document.execCommand("insertText", false, chunk);
          } catch {}
        }

        target.dispatchEvent(new InputEvent("input", {
          inputType: "insertText",
          data: chunk,
          bubbles: true,
          cancelable: false,
          composed: true
        }));

        target.dispatchEvent(new KeyboardEvent("keyup", {
          key: chunk,
          bubbles: true,
          cancelable: true,
          composed: true
        }));

        return true;
      } catch (err) {
        console.warn("[AutoTyper] insertChunk failed:", err);
        return false;
      }
    },

    async typeStream(text, options = {}) {
      const { speedMs = 12, chunkSize = 1, onProgress, onComplete, onCancel, onError } = options;

      if (!text || text.length === 0) {
        if (onComplete) onComplete();
        return;
      }

      this.isTyping = true;
      this.abortRequested = false;

      // Blur any active element in the top document (e.g. extension modal/button)
      if (document.activeElement && typeof document.activeElement.blur === "function") {
        document.activeElement.blur();
      }

      this.focusEditor();
      await new Promise((res) => setTimeout(res, 50));
      this.focusEditor();

      const target = this.getEditorTarget();
      if (!target) {
        this.isTyping = false;
        if (onError) onError("Target editor Google Docs tidak ditemukan.");
        return;
      }

      const tokens = text.match(/(\r\n|\n|\r|[^\S\r\n]+|\S+)/g) || [text];
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

        const isNewlineOrSpace = /^(\r\n|\n|\r|\s+)$/.test(token);
        const delay = isNewlineOrSpace ? Math.max(4, speedMs / 2) : speedMs;
        await new Promise((res) => setTimeout(res, delay));
      }

      this.isTyping = false;
      if (onComplete) onComplete();
    },

    instantInsert(text) {
      if (!text) return false;
      this.focusEditor();
      const target = this.getEditorTarget();
      if (!target) return false;

      const lines = text.split(/\r\n|\n|\r/);
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
          this.insertChunk("\n");
        }
        if (lines[i].length > 0) {
          this.insertChunk(lines[i]);
        }
      }
      return true;
    },

    stop() {
      if (this.isTyping) {
        this.abortRequested = true;
      }
    }
  };

  window.AutoTyper = AutoTyper;
})();
