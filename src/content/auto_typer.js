/**
 * Docs Paper Copilot - Auto Typer Engine
 * Protokol Resmi: LANGSUNG SELESAI SATU DRAF (Instant Whole Draft)
 * 
 * ATURAN MUTLAK / PROTOKOL PERMANEN:
 * Berdasarkan instruksi pengguna: PROTOKOL INI TIDAK BOLEH DIUBAH PADA UPDATE APAPUN.
 * Jangan pernah mengubah kembali ke mode animasi ketik lambat per-karakter (char-by-char delay).
 * Sekali aksi pengetikan dipicu, seluruh draf dokumen diselesaikan dan dimasukkan secara langsung.
 * Strictly zero emojis and pure monochrome workflow.
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

      // 0. Remove special draft delimiters if present
      s = s.replace(/<<<DRAF_DOKUMEN>>>/g, "");
      s = s.replace(/<<<AKHIR_DRAF_DOKUMEN>>>/g, "");

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

      // 5. Clean parenthesized asterisk terms: (*Betta splendens*) -> (Betta splendens)
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

    insertNewline(target = null, iframe = null) {
      const tgt = target || this.getEditorTarget();
      const ifr = iframe || this.getEditorIframe();
      if (!tgt) return false;

      try {
        tgt.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
          composed: true
        }));

        tgt.dispatchEvent(new KeyboardEvent("keypress", {
          key: "Enter",
          code: "Enter",
          charCode: 13,
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
          composed: true
        }));

        tgt.dispatchEvent(new InputEvent("beforeinput", {
          inputType: "insertParagraph",
          bubbles: true,
          cancelable: true,
          composed: true
        }));

        if (ifr && ifr.contentDocument) {
          try {
            ifr.contentDocument.execCommand("insertParagraph", false);
          } catch {}
        }

        tgt.dispatchEvent(new InputEvent("input", {
          inputType: "insertParagraph",
          bubbles: true,
          cancelable: false,
          composed: true
        }));

        tgt.dispatchEvent(new KeyboardEvent("keyup", {
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
    },

    insertChar(ch, target = null, iframe = null) {
      if (ch === "\n" || ch === "\r") {
        return this.insertNewline(target, iframe);
      }

      const tgt = target || this.getEditorTarget();
      const ifr = iframe || this.getEditorIframe();
      if (!tgt) return false;

      try {
        const charCode = ch.charCodeAt(0);
        let code = "";
        if (ch >= "A" && ch <= "Z") code = "Key" + ch;
        else if (ch >= "a" && ch <= "z") code = "Key" + ch.toUpperCase();
        else if (ch >= "0" && ch <= "9") code = "Digit" + ch;
        else if (ch === " ") code = "Space";

        tgt.dispatchEvent(new KeyboardEvent("keydown", {
          key: ch,
          code: code,
          keyCode: charCode,
          which: charCode,
          bubbles: true,
          cancelable: true,
          composed: true
        }));

        tgt.dispatchEvent(new KeyboardEvent("keypress", {
          key: ch,
          code: code,
          charCode: charCode,
          keyCode: charCode,
          which: charCode,
          bubbles: true,
          cancelable: true,
          composed: true
        }));

        tgt.dispatchEvent(new InputEvent("beforeinput", {
          inputType: "insertText",
          data: ch,
          bubbles: true,
          cancelable: true,
          composed: true
        }));

        if (ifr && ifr.contentDocument) {
          try {
            ifr.contentDocument.execCommand("insertText", false, ch);
          } catch {}
        }

        tgt.dispatchEvent(new InputEvent("input", {
          inputType: "insertText",
          data: ch,
          bubbles: true,
          cancelable: false,
          composed: true
        }));

        tgt.dispatchEvent(new KeyboardEvent("keyup", {
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

    insertChunk(chunk, target = null, iframe = null) {
      if (!chunk) return false;
      const chars = Array.from(chunk);
      for (const ch of chars) {
        this.insertChar(ch, target, iframe);
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

    /**
     * PROTOKOL UTAMA: Langsung Selesai Satu Draf (Instant Whole Draft)
     * Memasukkan draf lengkap ke Google Docs seketika tanpa jeda animasi lambat.
     */
    async typeDraft(rawText, options = {}) {
      const {
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

      // Blur control eksternal agar fokus editor Docs tidak terganggu
      if (document.activeElement && typeof document.activeElement.blur === "function") {
        document.activeElement.blur();
      }

      this.focusEditor();
      this.ensureNormalFont();
      await new Promise((res) => setTimeout(res, 40));
      this.focusEditor();

      const target = this.getEditorTarget();
      const iframe = this.getEditorIframe();
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

        this.ensureNormalFont();

        const p = paragraphs[i];
        const lines = p.split(/\r?\n/);

        for (let l = 0; l < lines.length; l++) {
          if (this.abortRequested) break;

          const line = lines[l].trim();
          if (line) {
            const chars = Array.from(line);
            for (let c = 0; c < chars.length; c++) {
              if (this.abortRequested) break;
              this.insertChar(chars[c], target, iframe);

              // Micro-yield periodik setiap 120 karakter agar event queue Docs & render thread tetap bernapas
              if (c > 0 && c % 120 === 0) {
                await new Promise((res) => setTimeout(res, 0));
              }
            }
          }

          if (l < lines.length - 1) {
            this.insertNewline(target, iframe);
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

        // Pemisahan alinea draf
        if (i < total - 1) {
          this.insertNewline(target, iframe);
          this.insertNewline(target, iframe);
        }
      }

      this.isTyping = false;
      if (onComplete) onComplete();
      return true;
    },

    /**
     * Backward-compatible typeParagraphs (Default ke Protokol Langsung Selesai Satu Draf)
     */
    async typeParagraphs(rawText, options = {}) {
      const {
        charDelayMs = 0,
        paragraphDelayMs = 0,
        ...rest
      } = options;

      // Jika delay 0 (Protokol Resmi Terkunci), jalankan langsung typeDraft
      if ((!charDelayMs || charDelayMs <= 0) && (!paragraphDelayMs || paragraphDelayMs <= 0)) {
        return this.typeDraft(rawText, { ...rest, ...options });
      }

      // Fallback jika secara eksplisit pengguna/sistem menyertakan jeda animasi
      if (!rawText || rawText.length === 0) {
        if (options.onComplete) options.onComplete();
        return true;
      }

      this.isTyping = true;
      this.abortRequested = false;

      if (document.activeElement && typeof document.activeElement.blur === "function") {
        document.activeElement.blur();
      }

      this.focusEditor();
      this.ensureNormalFont();
      await new Promise((res) => setTimeout(res, 40));
      this.focusEditor();

      const target = this.getEditorTarget();
      const iframe = this.getEditorIframe();
      if (!target) {
        this.isTyping = false;
        if (options.onError) options.onError("Target editor Google Docs tidak ditemukan.");
        return false;
      }

      const cleanText = this.cleanMarkdownForDocs(rawText);
      const paragraphs = this.splitIntoParagraphs(cleanText);
      const total = paragraphs.length;

      if (total === 0) {
        this.isTyping = false;
        if (options.onComplete) options.onComplete();
        return true;
      }

      for (let i = 0; i < total; i++) {
        if (this.abortRequested) {
          this.isTyping = false;
          this.abortRequested = false;
          if (options.onCancel) options.onCancel();
          return false;
        }

        this.ensureNormalFont();

        const p = paragraphs[i];
        const lines = p.split(/\r?\n/);

        for (let l = 0; l < lines.length; l++) {
          if (this.abortRequested) break;

          const line = lines[l].trim();
          if (line) {
            const chars = Array.from(line);
            for (let c = 0; c < chars.length; c++) {
              if (this.abortRequested) break;
              this.insertChar(chars[c], target, iframe);

              if (charDelayMs > 0) {
                await new Promise((res) => setTimeout(res, charDelayMs));
              } else if (c % 120 === 0 && c > 0) {
                await new Promise((res) => setTimeout(res, 0));
              }
            }
          }

          if (l < lines.length - 1) {
            this.insertNewline(target, iframe);
            if (charDelayMs > 0) {
              await new Promise((res) => setTimeout(res, Math.max(20, charDelayMs * 2)));
            }
          }
        }

        const percent = Math.round(((i + 1) / total) * 100);
        if (options.onProgress) {
          options.onProgress({
            current: i + 1,
            total,
            percent,
            paragraphIndex: i + 1,
            totalParagraphs: total
          });
        }

        if (i < total - 1) {
          this.insertNewline(target, iframe);
          this.insertNewline(target, iframe);

          if (paragraphDelayMs > 0) {
            await new Promise((res) => setTimeout(res, paragraphDelayMs));
          }
        }
      }

      this.isTyping = false;
      if (options.onComplete) options.onComplete();
      return true;
    },

    instantInsert(rawText, options = {}) {
      return this.typeDraft(rawText, options);
    },

    async typeStream(text, options = {}) {
      const { speedMs, paragraphDelayMs, charDelayMs, ...rest } = options;
      // Protokol resmi: default langsung selesai satu draf tanpa penundaan
      if (!speedMs && !paragraphDelayMs && !charDelayMs) {
        return this.typeDraft(text, rest);
      }
      return this.typeParagraphs(text, {
        charDelayMs: charDelayMs || (speedMs ? parseInt(speedMs, 10) : 0),
        paragraphDelayMs: paragraphDelayMs || 0,
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
