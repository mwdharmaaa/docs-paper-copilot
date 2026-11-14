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

    cleanMarkdownForDocs(text) {
      if (!text || typeof text !== "string") return "";

      let s = text;

      // 1. Remove markdown code block markers
      s = s.replace(/^```[a-zA-Z]*\r?\n/gm, "");
      s = s.replace(/\r?\n```$/gm, "");
      s = s.replace(/```/g, "");

      // 2. Remove horizontal rules (---, ***, ___)
      s = s.replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, "");

      // 3. Remove markdown headers (# Title, ## Subtitle, etc.)
      s = s.replace(/^[ \t]*#{1,6}\s*/gm, "");

      // 4. Standardize bullet points: replace '* item' with '- item'
      s = s.replace(/^[ \t]*\*[ \t]+/gm, "- ");

      // 5. Clean parenthesized asterisk terms: (*Cyprinus carpio*) -> (Cyprinus carpio)
      s = s.replace(/\(\*+([^*]+)\*+\)/g, "($1)");

      // 6. Strip bold/italic asterisks: ***text*** -> text, **text** -> text, *text* -> text
      s = s.replace(/\*{3}([^*]+)\*{3}/g, "$1");
      s = s.replace(/\*{2}([^*]+)\*{2}/g, "$1");
      s = s.replace(/\*([^*\r\n]+)\*/g, "$1");

      // 7. Strip any remaining stray asterisks
      s = s.replace(/\*/g, "");

      // 8. Strip markdown backticks
      s = s.replace(/`/g, "");

      // 9. Normalize multiple consecutive blank lines to max 2 newlines
      s = s.replace(/(\r?\n){3,}/g, "\n\n");

      return s.trim();
    },

    ensureNormalFont() {
      try {
        const iframe = this.getEditorIframe();

        // 1. Check iframe document queryCommandState
        if (iframe && iframe.contentDocument) {
          try {
            if (iframe.contentDocument.queryCommandState && iframe.contentDocument.queryCommandState("bold")) {
              iframe.contentDocument.execCommand("bold", false, null);
            }
          } catch (e) {
            console.warn("[AutoTyper] queryCommandState bold check:", e);
          }
        }

        // 2. Check Google Docs toolbar bold button
        const boldBtn = document.getElementById("boldButton") ||
                        document.querySelector(".docs-material-button[id*='bold']") ||
                        document.querySelector("[aria-label*='Tebal']") ||
                        document.querySelector("[aria-label*='Bold']");
        if (boldBtn) {
          const isPressed = boldBtn.getAttribute("aria-pressed") === "true" ||
                            boldBtn.getAttribute("aria-checked") === "true" ||
                            boldBtn.classList.contains("goog-toolbar-button-checked") ||
                            boldBtn.classList.contains("docs-material-button-checked");
          if (isPressed) {
            boldBtn.click();
          }
        }
      } catch (err) {
        console.warn("[AutoTyper] ensureNormalFont error:", err);
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

    splitIntoParagraphs(text) {
      if (!text || typeof text !== "string") return [];
      if (/\r?\n\s*\r?\n/.test(text)) {
        return text.split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean);
      }
      return text.split(/\r?\n/).map((p) => p.trim()).filter(Boolean);
    },

    async typeParagraphs(rawText, options = {}) {
      const {
        paragraphDelayMs = 350,
        onProgress,
        onComplete,
        onCancel,
        onError
      } = options;

      if (!rawText || rawText.length === 0) {
        if (onComplete) onComplete();
        return true;
      }

      this.isTyping = true;
      this.abortRequested = false;

      // Blur parent window active elements (e.g. prompt textarea / button)
      if (document.activeElement && typeof document.activeElement.blur === "function") {
        document.activeElement.blur();
      }

      this.focusEditor();
      this.ensureNormalFont();
      await new Promise((res) => setTimeout(res, 40));
      this.focusEditor();

      const target = this.getEditorTarget();
      if (!target) {
        this.isTyping = false;
        if (onError) onError("Target editor Google Docs tidak ditemukan.");
        return false;
      }

      const cleanText = this.cleanMarkdownForDocs(rawText);
      const paragraphs = this.splitIntoParagraphs(cleanText);
      const total = paragraphs.length;

      if (total === 0) {
        this.isTyping = false;
        if (onComplete) onComplete();
        return true;
      }

      for (let i = 0; i < total; i++) {
        if (this.abortRequested) {
          this.isTyping = false;
          this.abortRequested = false;
          if (onCancel) onCancel();
          return false;
        }

        // Ensure Docs remains in regular (normal) font
        this.ensureNormalFont();

        const p = paragraphs[i];
        const lines = p.split(/\r?\n/);
        for (let l = 0; l < lines.length; l++) {
          const line = lines[l];
          const chars = Array.from(line);
          for (let c = 0; c < chars.length; c++) {
            this.insertChar(chars[c]);
          }
          if (l < lines.length - 1) {
            this.insertChar("\n");
          }
        }

        const percent = Math.round(((i + 1) / total) * 100);
        if (onProgress) {
          onProgress({
            current: i + 1,
            total,
            percent,
            paragraphIndex: i + 1,
            totalParagraphs: total
          });
        }

        // Insert paragraph separation and pause with an elegant cadence
        if (i < total - 1) {
          this.insertChar("\n");
          this.insertChar("\n");

          if (paragraphDelayMs > 0) {
            await new Promise((res) => setTimeout(res, paragraphDelayMs));
          }
        }
      }

      this.isTyping = false;
      if (onComplete) onComplete();
      return true;
    },

    instantInsert(rawText, options = {}) {
      return this.typeParagraphs(rawText, {
        paragraphDelayMs: 0,
        ...options
      });
    },

    async typeStream(text, options = {}) {
      const { speedMs, paragraphDelayMs, ...rest } = options;
      const delay = paragraphDelayMs !== undefined
        ? paragraphDelayMs
        : (speedMs ? Math.max(120, speedMs * 30) : 350);

      return this.typeParagraphs(text, {
        paragraphDelayMs: delay,
        ...rest
      });
    },

    stop() {
      if (this.isTyping) {
        this.abortRequested = true;
      }
    }
  };

  window.AutoTyper = AutoTyper;
})();
