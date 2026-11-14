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

    insertChar(ch) {
      const iframe = this.getEditorIframe();
      const target = this.getEditorTarget();
      if (!target) return false;

      this.focusEditor();

      if (ch === "\n" || ch === "\r") {
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

          target.dispatchEvent(new KeyboardEvent("keypress", {
            key: "Enter",
            code: "Enter",
            charCode: 13,
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

          if (iframe && iframe.contentDocument) {
            try {
              iframe.contentDocument.execCommand("insertParagraph", false);
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

      // Single character
      try {
        const charCode = ch.charCodeAt(0);
        let code = "";
        if (ch >= "A" && ch <= "Z") code = "Key" + ch;
        else if (ch >= "a" && ch <= "z") code = "Key" + ch.toUpperCase();
        else if (ch >= "0" && ch <= "9") code = "Digit" + ch;
        else if (ch === " ") code = "Space";

        target.dispatchEvent(new KeyboardEvent("keydown", {
          key: ch,
          code: code,
          keyCode: charCode,
          which: charCode,
          bubbles: true,
          cancelable: true,
          composed: true
        }));

        target.dispatchEvent(new KeyboardEvent("keypress", {
          key: ch,
          code: code,
          charCode: charCode,
          keyCode: charCode,
          which: charCode,
          bubbles: true,
          cancelable: true,
          composed: true
        }));

        target.dispatchEvent(new InputEvent("beforeinput", {
          inputType: "insertText",
          data: ch,
          bubbles: true,
          cancelable: true,
          composed: true
        }));

        if (iframe && iframe.contentDocument) {
          try {
            iframe.contentDocument.execCommand("insertText", false, ch);
          } catch {}
        }

        target.dispatchEvent(new InputEvent("input", {
          inputType: "insertText",
          data: ch,
          bubbles: true,
          cancelable: false,
          composed: true
        }));

        target.dispatchEvent(new KeyboardEvent("keyup", {
          key: ch,
          code: code,
          keyCode: charCode,
          which: charCode,
          bubbles: true,
          cancelable: true,
          composed: true
        }));

        return true;
      } catch (err) {
        console.warn("[AutoTyper] insertChar failed:", err);
        return false;
      }
    },

    insertChunk(chunk) {
      if (!chunk) return false;
      if (chunk.length === 1) {
        return this.insertChar(chunk);
      }
      const chars = Array.from(chunk);
      for (const ch of chars) {
        this.insertChar(ch);
      }
      return true;
    },

    async typeStream(text, options = {}) {
      const { speedMs = 8, onProgress, onComplete, onCancel, onError } = options;

      if (!text || text.length === 0) {
        if (onComplete) onComplete();
        return;
      }

      this.isTyping = true;
      this.abortRequested = false;

      // Ensure active element in parent document (such as popup prompt input) is blurred
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

      const chars = Array.from(text);
      const total = chars.length;

      for (let i = 0; i < total; i++) {
        if (this.abortRequested) {
          this.isTyping = false;
          this.abortRequested = false;
          if (onCancel) onCancel();
          return;
        }

        const ch = chars[i];
        this.insertChar(ch);

        if (onProgress && (i % 6 === 0 || i === total - 1)) {
          onProgress({ current: i + 1, total, percent: Math.round(((i + 1) / total) * 100) });
        }

        const delay = (ch === "\n" || ch === " ") ? Math.max(3, speedMs / 2) : speedMs;
        if (delay > 0) {
          await new Promise((res) => setTimeout(res, delay));
        }
      }

      this.isTyping = false;
      if (onComplete) onComplete();
    },

    instantInsert(text) {
      if (!text) return false;
      this.focusEditor();
      const target = this.getEditorTarget();
      if (!target) return false;

      const chars = Array.from(text);
      for (const ch of chars) {
        this.insertChar(ch);
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
