/**
 * Docs Paper Copilot - Auto Typer Engine
 * Protokol Resmi: LANGSUNG SELESAI SATU DRAF (Instant Whole Draft)
 * Indentasi Baku: 1x TAB DI AWAL SETIAP PARAGRAF BARU
 * Format Judul: DUKUNGAN HIERARKI JUDUL 1, JUDUL 2, JUDUL 3 (Google Docs Headings)
 * 
 * ATURAN MUTLAK / PROTOKOL PERMANEN:
 * Berdasarkan instruksi pengguna: PROTOKOL INI TIDAK BOLEH DIUBAH PADA UPDATE APAPUN.
 * Jangan pernah mengubah kembali ke mode animasi ketik lambat per-karakter.
 * Sekali aksi pengetikan dipicu, seluruh draf dokumen diselesaikan dan dimasukkan secara langsung.
 * Paragraf baru wajib diawali dengan 1x Tab (indentasi alinea).
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

      // 0. Hapus pembatas draf internal jika ada
      s = s.replace(/<<<DRAF_DOKUMEN>>>/g, "");
      s = s.replace(/<<<AKHIR_DRAF_DOKUMEN>>>/g, "");

      // 1. Standarisasi header Markdown ke tag format hierarki judul GTyipe
      s = s.replace(/^[ \t]*#\s+(.*)$/gm, "[JUDUL_1] $1");
      s = s.replace(/^[ \t]*##\s+(.*)$/gm, "[JUDUL_2] $1");
      s = s.replace(/^[ \t]*###\s+(.*)$/gm, "[JUDUL_3] $1");
      s = s.replace(/^[ \t]*####\s+(.*)$/gm, "[JUDUL_4] $1");

      // 2. Hapus markdown code block markers
      s = s.replace(/^```[a-zA-Z]*\r?\n/gm, "");
      s = s.replace(/\r?\n```$/gm, "");
      s = s.replace(/```/g, "");

      // 3. Hapus garis horizontal (---, ***, ___)
      s = s.replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, "");

      // 4. Standarisasi daftar poin
      s = s.replace(/^[ \t]*\*[ \t]+/gm, "- ");

      // 5. Bersihkan asterisk dalam kurung ilmiah: (*Betta splendens*) -> (Betta splendens)
      s = s.replace(/\(\*+([^*]+)\*+\)/g, "($1)");

      // 6. Hapus asterisk penanda tebal/miring dari teks Docs murni
      s = s.replace(/\*{3}([^*]+)\*{3}/g, "$1");
      s = s.replace(/\*{2}([^*]+)\*{2}/g, "$1");
      s = s.replace(/\*([^*\r\n]+)\*/g, "$1");
      s = s.replace(/\*/g, "");

      // 7. Hapus backtick
      s = s.replace(/`/g, "");

      // 8. Normalisasi jarak baris berlebih
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

    /**
     * Terapkan Format Judul Google Docs (Heading 1..6 / Normal Text)
     * Menggunakan pintasan keyboard resmi Google Docs:
     * - Ctrl+Alt+1: Judul 1 (Heading 1)
     * - Ctrl+Alt+2: Judul 2 (Heading 2)
     * - Ctrl+Alt+3: Judul 3 (Heading 3)
     * - Ctrl+Alt+4: Judul 4 (Heading 4)
     * - Ctrl+Alt+0: Teks Normal (Normal Text)
     */
    applyHeading(level = 0, target = null, iframe = null) {
      const tgt = target || this.getEditorTarget();
      if (!tgt) return false;

      const lvl = Math.max(0, Math.min(6, parseInt(level, 10) || 0));
      const keyStr = String(lvl);
      const charCode = 48 + lvl; // 0 -> 48, 1 -> 49, dst.
      const codeStr = lvl === 0 ? "Digit0" : `Digit${lvl}`;

      try {
        tgt.dispatchEvent(new KeyboardEvent("keydown", {
          key: keyStr,
          code: codeStr,
          keyCode: charCode,
          which: charCode,
          ctrlKey: true,
          altKey: true,
          bubbles: true,
          cancelable: true,
          composed: true
        }));

        tgt.dispatchEvent(new KeyboardEvent("keyup", {
          key: keyStr,
          code: codeStr,
          keyCode: charCode,
          which: charCode,
          ctrlKey: true,
          altKey: true,
          bubbles: true,
          cancelable: true,
          composed: true
        }));

        return true;
      } catch (err) {
        console.warn("[AutoTyper] applyHeading failed:", err);
        return false;
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

    /**
     * Memasukkan Karakter Tab (Indentasi Paragraf Baku)
     */
    insertTab(target = null, iframe = null) {
      const tgt = target || this.getEditorTarget();
      const ifr = iframe || this.getEditorIframe();
      if (!tgt) return false;

      try {
        tgt.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Tab",
          code: "Tab",
          keyCode: 9,
          which: 9,
          bubbles: true,
          cancelable: true,
          composed: true
        }));

        tgt.dispatchEvent(new KeyboardEvent("keypress", {
          key: "Tab",
          code: "Tab",
          charCode: 9,
          keyCode: 9,
          which: 9,
          bubbles: true,
          cancelable: true,
          composed: true
        }));

        tgt.dispatchEvent(new InputEvent("beforeinput", {
          inputType: "insertText",
          data: "\t",
          bubbles: true,
          cancelable: true,
          composed: true
        }));

        if (ifr && ifr.contentDocument) {
          try {
            ifr.contentDocument.execCommand("insertText", false, "\t");
          } catch {}
        }

        tgt.dispatchEvent(new InputEvent("input", {
          inputType: "insertText",
          data: "\t",
          bubbles: true,
          cancelable: false,
          composed: true
        }));

        tgt.dispatchEvent(new KeyboardEvent("keyup", {
          key: "Tab",
          code: "Tab",
          keyCode: 9,
          which: 9,
          bubbles: true,
          cancelable: true,
          composed: true
        }));

        return true;
      } catch (err) {
        console.warn("[AutoTyper] insertTab failed:", err);
        return false;
      }
    },

    insertChar(ch, target = null, iframe = null) {
      if (ch === "\n" || ch === "\r") {
        return this.insertNewline(target, iframe);
      }
      if (ch === "\t") {
        return this.insertTab(target, iframe);
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

    splitIntoParagraphs(text) {
      if (!text || typeof text !== "string") return [];
      if (/\r?\n\s*\r?\n/.test(text)) {
        return text.split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean);
      }
      return text.split(/\r?\n/).map((p) => p.trim()).filter(Boolean);
    },

    /**
     * Menganalisis apakah baris teks merupakan Judul (Heading) atau Paragraf biasa.
     */
    parseLineHeading(rawLine) {
      if (!rawLine || typeof rawLine !== "string") {
        return { level: 0, text: "", isHeading: false };
      }

      const trimmed = rawLine.trim();

      // 1. Tag Eksplisit
      let m = trimmed.match(/^\[(?:JUDUL_1|H1)\]\s*(.*)$/i);
      if (m) return { level: 1, text: m[1].trim(), isHeading: true };

      m = trimmed.match(/^\[(?:JUDUL_2|H2)\]\s*(.*)$/i);
      if (m) return { level: 2, text: m[1].trim(), isHeading: true };

      m = trimmed.match(/^\[(?:JUDUL_3|H3)\]\s*(.*)$/i);
      if (m) return { level: 3, text: m[1].trim(), isHeading: true };

      m = trimmed.match(/^\[(?:JUDUL_4|H4)\]\s*(.*)$/i);
      if (m) return { level: 4, text: m[1].trim(), isHeading: true };

      m = trimmed.match(/^\[(?:JUDUL_DOKUMEN|TITLE)\]\s*(.*)$/i);
      if (m) return { level: 1, text: m[1].trim(), isHeading: true, isDocTitle: true };

      m = trimmed.match(/^\[SUBJUDUL\]\s*(.*)$/i);
      if (m) return { level: 2, text: m[1].trim(), isHeading: true };

      // 2. Deteksi Konvensi Akademik Otomatis
      if (/^BAB\s+[IVXLCDM]+(\s+.*)?$/i.test(trimmed)) {
        return { level: 1, text: trimmed, isHeading: true };
      }
      if (/^(?:DAFTAR\s+ISI|DAFTAR\s+PUSTAKA|KATA\s+PENGANTAR|ABSTRAK|RINGKASAN|DAFTAR\s+TABEL|DAFTAR\s+GAMBAR)$/i.test(trimmed)) {
        return { level: 1, text: trimmed, isHeading: true };
      }
      if (/^\d+\.\d+\s+[A-Z]/.test(trimmed)) {
        return { level: 2, text: trimmed, isHeading: true };
      }
      if (/^\d+\.\d+\.\d+\s+[A-Z]/.test(trimmed)) {
        return { level: 3, text: trimmed, isHeading: true };
      }

      return { level: 0, text: rawLine, isHeading: false };
    },

    /**
     * PROTOKOL UTAMA: Langsung Selesai Satu Draf (Instant Whole Draft)
     * Mengintegrasikan format Judul 1/2/3 dan Indentasi Tab Paragraf Baru.
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

        const p = paragraphs[i];
        const lines = p.split(/\r?\n/);

        for (let l = 0; l < lines.length; l++) {
          if (this.abortRequested) break;

          const rawLine = lines[l].trim();
          if (!rawLine) continue;

          const hInfo = this.parseLineHeading(rawLine);

          if (hInfo.isHeading && hInfo.level > 0) {
            // ========================================================
            // EKSEKUSI FORMAT JUDUL (Judul 1, Judul 2, Judul 3, dst.)
            // ========================================================
            this.applyHeading(hInfo.level, target, iframe);

            const chars = Array.from(hInfo.text);
            for (let c = 0; c < chars.length; c++) {
              if (this.abortRequested) break;
              this.insertChar(chars[c], target, iframe);
            }

            if (l < lines.length - 1 || i < total - 1) {
              this.insertNewline(target, iframe);
              // Kembalikan ke Normal Text untuk baris selanjutnya
              this.applyHeading(0, target, iframe);
              this.ensureNormalFont();
            }
          } else {
            // ========================================================
            // EKSEKUSI PARAGRAF BIASA / ISI DOKUMEN
            // PROTOKOL BAKU: Wajib di-Tab 1x pada awal kalimat paragraf baru!
            // ========================================================
            this.applyHeading(0, target, iframe);
            this.ensureNormalFont();

            const isList = /^[-*•]\s+/.test(hInfo.text) || /^\d+\.\s+/.test(hInfo.text);
            let textToType = hInfo.text;

            // Indentasi 1x Tab jika baris pertama alinea dan bukan daftar poin
            if (l === 0 && !isList && !textToType.startsWith("\t") && textToType.length > 0) {
              textToType = "\t" + textToType;
            }

            const chars = Array.from(textToType);
            for (let c = 0; c < chars.length; c++) {
              if (this.abortRequested) break;
              this.insertChar(chars[c], target, iframe);

              if (c > 0 && c % 120 === 0) {
                await new Promise((res) => setTimeout(res, 0));
              }
            }

            if (l < lines.length - 1) {
              this.insertNewline(target, iframe);
            }
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

    async typeParagraphs(rawText, options = {}) {
      return this.typeDraft(rawText, options);
    },

    instantInsert(rawText, options = {}) {
      return this.typeDraft(rawText, options);
    },

    async typeStream(text, options = {}) {
      return this.typeDraft(text, options);
    },

    stop() {
      if (this.isTyping) {
        this.abortRequested = true;
      }
    }
  };

  window.AutoTyper = AutoTyper;
})();
