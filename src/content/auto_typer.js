/**
 * Docs Paper Copilot - Auto Typer Engine
 * Protokol Resmi: LANGSUNG SELESAI SATU DRAF (Instant Whole Draft)
 * 
 * STANDAR TIPOGRAFI & UKURAN FONT RESMI:
 * 1. Judul Utama: 16 pt, BOLD.
 * 2. Judul Bab / Bagian Utama (BAB 1 / BAB I, DAFTAR ISI, DAFTAR PUSTAKA, dsb.): 14 pt, BOLD.
 * 3. Sub-judul (1.1, 1.2, dsb.): 12 pt, BOLD.
 * 4. Sub-sub-judul (1.1.1, dsb.): 12 pt, BOLD.
 * 5. Seluruh Teks Isi Dokumen / Paragraf Normal: 12 pt, NORMAL (tidak bold), RATA KANAN-KIRI (Justify).
 * 
 * ATURAN INDENTASI ALINEA:
 * - Paragraf baru wajib diawali dengan 1x Tab (7 non-breaking spaces = ~1.27 cm).
 * - Daftar Isi DILARANG KERAS diberi indentasi Tab alinea.
 * 
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

      // 4. Bersihkan asterisk penanda tebal/miring dari teks Docs murni
      s = s.replace(/\*{3}([^*]+)\*{3}/g, "$1");
      s = s.replace(/\*{2}([^*]+)\*{2}/g, "$1");
      s = s.replace(/\*([^*\r\n]+)\*/g, "$1");
      s = s.replace(/\*/g, "");

      // 5. Hapus backtick
      s = s.replace(/`/g, "");

      // 6. Normalisasi jarak baris berlebih
      s = s.replace(/(\r?\n){3,}/g, "\n\n");

      return s.trim();
    },

    /**
     * Mengatur ketebalan huruf (Bold / Unbold).
     */
    setBold(shouldBeBold, target = null, iframe = null) {
      try {
        const boldBtn = document.getElementById("boldButton") ||
                        document.querySelector(".docs-material-button[id*='bold']") ||
                        document.querySelector("[aria-label*='Tebal']") ||
                        document.querySelector("[aria-label*='Bold']");

        const ifr = iframe || this.getEditorIframe();
        let isBold = false;

        if (ifr && ifr.contentDocument && ifr.contentDocument.queryCommandState) {
          try {
            isBold = Boolean(ifr.contentDocument.queryCommandState("bold"));
          } catch {}
        }

        if (!isBold && boldBtn) {
          isBold = boldBtn.getAttribute("aria-pressed") === "true" ||
                   boldBtn.getAttribute("aria-checked") === "true" ||
                   boldBtn.classList.contains("goog-toolbar-button-checked") ||
                   boldBtn.classList.contains("docs-material-button-checked");
        }

        if (isBold !== Boolean(shouldBeBold)) {
          if (boldBtn && typeof boldBtn.click === "function") {
            boldBtn.click();
          } else {
            const tgt = target || this.getEditorTarget();
            if (tgt) {
              tgt.dispatchEvent(new KeyboardEvent("keydown", {
                key: "b",
                code: "KeyB",
                keyCode: 66,
                which: 66,
                ctrlKey: true,
                bubbles: true,
                cancelable: true,
                composed: true
              }));
              tgt.dispatchEvent(new KeyboardEvent("keyup", {
                key: "b",
                code: "KeyB",
                keyCode: 66,
                which: 66,
                ctrlKey: true,
                bubbles: true,
                cancelable: true,
                composed: true
              }));
            }
          }
        }
      } catch (err) {
        console.warn("[AutoTyper] setBold error:", err);
      }
    },

    /**
     * Mengatur Ukuran Font Google Docs (16pt, 14pt, 12pt).
     */
    setFontSize(sizePt) {
      const pt = parseInt(sizePt, 10);
      if (!pt || isNaN(pt)) return false;

      const sizeSelectors = [
        "#fontSizeSelect input",
        "div[id*='fontSizeSelect'] input",
        ".docs-font-size-inc-dec-combobox input",
        "#fontSizeInputElement",
        "[aria-label*='Ukuran font'] input",
        "[aria-label*='Font size'] input",
        ".docs-font-size-select input"
      ];

      for (const sel of sizeSelectors) {
        try {
          const input = document.querySelector(sel);
          if (input) {
            const currentVal = parseInt(input.value || input.getAttribute("value"), 10);
            if (currentVal === pt) return true;

            input.focus();
            input.value = String(pt);
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
            input.dispatchEvent(new KeyboardEvent("keydown", {
              key: "Enter",
              code: "Enter",
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true
            }));
            input.dispatchEvent(new KeyboardEvent("keyup", {
              key: "Enter",
              code: "Enter",
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true
            }));
            this.focusEditor();
            return true;
          }
        } catch {}
      }
      return false;
    },

    /**
     * Memastikan teks kembali ke standar normal (12 pt, unbold).
     */
    ensureNormalFont(target = null, iframe = null) {
      this.setBold(false, target, iframe);
      this.setFontSize(12);
    },

    /**
     * Terapkan Format Rata Kiri-Kanan (Justify Alignment: Ctrl+Shift+J).
     */
    applyJustifyAlignment(target = null, iframe = null) {
      const tgt = target || this.getEditorTarget();
      if (!tgt) return false;

      try {
        tgt.dispatchEvent(new KeyboardEvent("keydown", {
          key: "J",
          code: "KeyJ",
          keyCode: 74,
          which: 74,
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
          composed: true
        }));

        tgt.dispatchEvent(new KeyboardEvent("keyup", {
          key: "J",
          code: "KeyJ",
          keyCode: 74,
          which: 74,
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
          composed: true
        }));
      } catch (e) {
        console.warn("[AutoTyper] Justify shortcut dispatch:", e);
      }

      try {
        const justifyBtn =
          document.getElementById("alignJustify") ||
          document.querySelector("[aria-label*='Rata kanan kiri']") ||
          document.querySelector("[aria-label*='Justify']") ||
          document.querySelector("[id*='alignJustify']") ||
          document.querySelector(".docs-icon-align-justify")?.closest("[role='button']");

        if (justifyBtn) {
          const isChecked =
            justifyBtn.getAttribute("aria-pressed") === "true" ||
            justifyBtn.getAttribute("aria-checked") === "true" ||
            justifyBtn.classList.contains("goog-toolbar-button-checked") ||
            justifyBtn.classList.contains("docs-material-button-checked");

          if (!isChecked && typeof justifyBtn.click === "function") {
            justifyBtn.click();
          }
        }
      } catch (e) {
        console.warn("[AutoTyper] Justify button click:", e);
      }

      return true;
    },

    /**
     * Terapkan Format Judul Google Docs (Heading 1..6 / Normal Text)
     * - Ctrl+Alt+1: Judul 1 (Heading 1)
     * - Ctrl+Alt+2: Judul 2 (Heading 2)
     * - Ctrl+Alt+3: Judul 3 (Heading 3)
     * - Ctrl+Alt+0: Teks Normal (Normal Text)
     */
    applyHeading(level = 0, target = null, iframe = null) {
      const tgt = target || this.getEditorTarget();
      if (!tgt) return false;

      const lvl = Math.max(0, Math.min(6, parseInt(level, 10) || 0));
      const keyStr = String(lvl);
      const charCode = 48 + lvl;
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
     * Memasukkan Indentasi 1x Tab Resmi Skripsi (Visible First-Line Indent).
     * Menggunakan sequence 7 non-breaking spaces (\u00A0) dan event Tab (~1.27 cm).
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
      } catch {}

      const tabSpaces = "\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0";
      for (const ch of tabSpaces) {
        this.insertChar(ch, tgt, ifr);
      }

      try {
        tgt.dispatchEvent(new KeyboardEvent("keyup", {
          key: "Tab",
          code: "Tab",
          keyCode: 9,
          which: 9,
          bubbles: true,
          cancelable: true,
          composed: true
        }));
      } catch {}

      return true;
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
        else if (ch === " " || ch === "\u00A0") code = "Space";

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
     * Deteksi apakah baris merupakan bagian dari Daftar Isi (Table of Contents).
     * Baris Daftar Isi DILARANG diberi indentasi Tab alinea!
     */
    isTableOfContentsLine(rawLine) {
      if (!rawLine || typeof rawLine !== "string") return false;
      const trimmed = rawLine.trim();

      // Mengandung titik-titik pemimpin (dot leaders, e.g. "...", ".......")
      if (/\.{2,}/.test(trimmed)) return true;

      // Diakhiri nomor halaman setelah titik/spasi (e.g. "... 1", "... ii", "... 25")
      if (/(?:\.|\s)+\s*(?:[ivxlcdm]+|\d+)\s*$/i.test(trimmed)) return true;

      // Header Daftar Isi itu sendiri
      if (/^\[?(?:JUDUL_1|H1)?\]?\s*DAFTAR\s+ISI/i.test(trimmed)) return true;

      return false;
    },

    /**
     * Menganalisis tingkat judul, ukuran font, dan status tebal (bold).
     */
    parseLineHeading(rawLine) {
      if (!rawLine || typeof rawLine !== "string") {
        return { level: 0, text: "", isHeading: false, fontSize: 12, isBold: false };
      }

      const trimmed = rawLine.trim();

      // 1. Tag Eksplisit
      let m = trimmed.match(/^\[(?:JUDUL_DOKUMEN|TITLE|JUDUL_UTAMA)\]\s*(.*)$/i);
      if (m) {
        // Judul Utama: 16 pt, BOLD
        return { level: 1, text: m[1].trim(), isHeading: true, isDocTitle: true, fontSize: 16, isBold: true };
      }

      m = trimmed.match(/^\[(?:JUDUL_1|H1)\]\s*(.*)$/i);
      if (m) {
        // Judul Bab: 14 pt, BOLD
        return { level: 1, text: m[1].trim(), isHeading: true, fontSize: 14, isBold: true };
      }

      m = trimmed.match(/^\[(?:JUDUL_2|H2)\]\s*(.*)$/i);
      if (m) {
        // Sub-judul: 12 pt, BOLD
        return { level: 2, text: m[1].trim(), isHeading: true, fontSize: 12, isBold: true };
      }

      m = trimmed.match(/^\[(?:JUDUL_3|H3)\]\s*(.*)$/i);
      if (m) {
        // Sub-sub-judul: 12 pt, BOLD
        return { level: 3, text: m[1].trim(), isHeading: true, fontSize: 12, isBold: true };
      }

      m = trimmed.match(/^\[(?:JUDUL_4|H4)\]\s*(.*)$/i);
      if (m) {
        return { level: 4, text: m[1].trim(), isHeading: true, fontSize: 12, isBold: true };
      }

      m = trimmed.match(/^\[SUBJUDUL\]\s*(.*)$/i);
      if (m) {
        return { level: 2, text: m[1].trim(), isHeading: true, fontSize: 12, isBold: true };
      }

      // 2. Deteksi Konvensi Akademik Otomatis
      // BAB 1, BAB 2, BAB I, BAB II (14 pt, BOLD)
      if (/^BAB\s+(?:[IVXLCDM]+|\d+)(\s+.*)?$/i.test(trimmed)) {
        return { level: 1, text: trimmed, isHeading: true, fontSize: 14, isBold: true };
      }

      // DAFTAR ISI, DAFTAR PUSTAKA, KATA PENGANTAR, ABSTRAK (14 pt, BOLD)
      if (/^(?:DAFTAR\s+ISI|DAFTAR\s+PUSTAKA|KATA\s+PENGANTAR|ABSTRAK|RINGKASAN|DAFTAR\s+TABEL|DAFTAR\s+GAMBAR|LAMPIRAN)$/i.test(trimmed)) {
        return { level: 1, text: trimmed, isHeading: true, fontSize: 14, isBold: true };
      }

      // Sub-judul desimal: 1.1 Latar Belakang, 2.1 bla bla (12 pt, BOLD)
      if (/^\d+\.\d+\s+[A-Z]/.test(trimmed)) {
        return { level: 2, text: trimmed, isHeading: true, fontSize: 12, isBold: true };
      }

      // Sub-sub-judul: 1.1.1 Identifikasi Masalah (12 pt, BOLD)
      if (/^\d+\.\d+\.\d+\s+[A-Z]/.test(trimmed)) {
        return { level: 3, text: trimmed, isHeading: true, fontSize: 12, isBold: true };
      }

      // Paragraf biasa / isi dokumen (12 pt, NORMAL / UNBOLD)
      return { level: 0, text: rawLine, isHeading: false, fontSize: 12, isBold: false };
    },

    /**
     * PROTOKOL UTAMA: Langsung Selesai Satu Draf (Instant Whole Draft)
     * Mengintegrasikan:
     * - Ukuran font: Judul Utama (16 pt bold), Bab (14 pt bold), Sub-judul (12 pt bold), Isi (12 pt normal)
     * - Indentasi 1x Tab di setiap paragraf baru
     * - Format Rata Kanan-Kiri (Justify)
     * - Daftar Isi bebas tab
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

      // Terapkan default dokumen Rata Kanan-Kiri (Justify) dan ukuran 12 pt
      this.applyJustifyAlignment(target, iframe);
      this.setFontSize(12);

      let inTocBlock = false;

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

          // Deteksi apakah sedang dalam blok Daftar Isi
          if (/^\[?(?:JUDUL_1|H1)?\]?\s*DAFTAR\s+ISI/i.test(rawLine)) {
            inTocBlock = true;
          } else if (inTocBlock && /^\[?(?:JUDUL_1|H1)?\]?\s*BAB\s+(?:[IVXLCDM]+|\d+)/i.test(rawLine)) {
            inTocBlock = false;
          }

          const hInfo = this.parseLineHeading(rawLine);
          const isTocLine = inTocBlock || this.isTableOfContentsLine(rawLine);

          if (hInfo.isHeading && hInfo.level > 0 && !isTocLine) {
            // ========================================================
            // EKSEKUSI FORMAT JUDUL (Judul 1, Judul 2, Judul 3, dst.)
            // - Judul Utama: 16 pt BOLD
            // - Judul Bab (BAB 1 / DAFTAR ISI): 14 pt BOLD
            // - Sub-judul (1.1): 12 pt BOLD
            // ========================================================
            this.applyHeading(hInfo.level, target, iframe);
            this.setFontSize(hInfo.fontSize || 14);
            this.setBold(true, target, iframe);

            const chars = Array.from(hInfo.text);
            for (let c = 0; c < chars.length; c++) {
              if (this.abortRequested) break;
              this.insertChar(chars[c], target, iframe);
            }

            if (l < lines.length - 1 || i < total - 1) {
              this.insertNewline(target, iframe);
              // Kembalikan ke Normal Text (12 pt, unbold, Rata Kanan-Kiri) untuk baris berikutnya
              this.applyHeading(0, target, iframe);
              this.ensureNormalFont(target, iframe);
              this.applyJustifyAlignment(target, iframe);
            }
          } else if (isTocLine) {
            // ========================================================
            // EKSEKUSI BARIS DAFTAR ISI (TABLE OF CONTENTS)
            // Header Daftar Isi: 14 pt BOLD
            // Baris entri daftar isi: 12 pt NORMAL, BEBAS DARI INDENTASI TAB
            // ========================================================
            const isTocHeader = /^\[?(?:JUDUL_1|H1)?\]?\s*DAFTAR\s+ISI/i.test(rawLine);
            if (isTocHeader) {
              this.applyHeading(1, target, iframe);
              this.setFontSize(14);
              this.setBold(true, target, iframe);
            } else {
              this.applyHeading(0, target, iframe);
              this.setFontSize(12);
              this.setBold(false, target, iframe);
            }

            const cleanTocText = rawLine.replace(/^\[(?:JUDUL_\d|H\d)\]\s*/i, "");
            const chars = Array.from(cleanTocText);
            for (let c = 0; c < chars.length; c++) {
              if (this.abortRequested) break;
              this.insertChar(chars[c], target, iframe);
            }

            if (l < lines.length - 1) {
              this.insertNewline(target, iframe);
            }
          } else {
            // ========================================================
            // EKSEKUSI PARAGRAF BIASA / ISI DOKUMEN
            // - Ukuran font: 12 pt
            // - Format font: NORMAL (unbold)
            // - Format alinea: RATA KANAN-KIRI (Justify)
            // - Indentasi: Wajib 1x Tab (7 non-breaking spaces) pada awal kalimat alinea baru
            // ========================================================
            this.applyHeading(0, target, iframe);
            this.setFontSize(12);
            this.setBold(false, target, iframe);
            this.applyJustifyAlignment(target, iframe);

            const isList = /^[-*•]\s+/.test(hInfo.text) || /^\d+\.\s+/.test(hInfo.text);
            let textToType = hInfo.text;

            if (textToType.startsWith("\t")) {
              textToType = textToType.replace(/^\t+/, "");
            }

            // Sisipkan 1x Tab jika baris pertama alinea dan bukan daftar poin
            if (l === 0 && !isList && textToType.length > 0) {
              this.insertTab(target, iframe);
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

  /**
   * ==========================================================================
   * SMART CURSOR NAVIGATOR ENGINE (Gerak-gerakin Kursor & Pencari Bagian Tepat)
   * Memungkinkan GTyipe menavigasikan kursor ke atas, ke bawah, ke bab/judul
   * spesifik, atau mencari cuplikan teks di dokumen untuk perbaikan draf.
   * ==========================================================================
   */
  const CursorNavigator = {
    getEditorTarget() {
      return AutoTyper.getEditorTarget();
    },

    getEditorIframe() {
      return AutoTyper.getEditorIframe();
    },

    /**
     * Gerakkan kursor ke paling atas dokumen (Ctrl + Home).
     */
    moveToTop() {
      const tgt = this.getEditorTarget();
      if (!tgt) return false;
      AutoTyper.focusEditor();

      tgt.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Home",
        code: "Home",
        keyCode: 36,
        which: 36,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
        composed: true
      }));

      tgt.dispatchEvent(new KeyboardEvent("keyup", {
        key: "Home",
        code: "Home",
        keyCode: 36,
        which: 36,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
        composed: true
      }));

      return true;
    },

    /**
     * Gerakkan kursor ke paling bawah dokumen (Ctrl + End).
     */
    moveToBottom() {
      const tgt = this.getEditorTarget();
      if (!tgt) return false;
      AutoTyper.focusEditor();

      tgt.dispatchEvent(new KeyboardEvent("keydown", {
        key: "End",
        code: "End",
        keyCode: 35,
        which: 35,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
        composed: true
      }));

      tgt.dispatchEvent(new KeyboardEvent("keyup", {
        key: "End",
        code: "End",
        keyCode: 35,
        which: 35,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
        composed: true
      }));

      return true;
    },

    /**
     * Cari bagian/judul/bab atau cuplikan teks di dokumen dan tempatkan kursor di sana.
     * Mendukung pencarian outline Google Docs dan pencarian teks kanvas kix.
     */
    async moveToSection(sectionQuery) {
      if (!sectionQuery || typeof sectionQuery !== "string") return false;
      const q = sectionQuery.toLowerCase().trim();

      // Kasus khusus arah dokumen
      if (q.includes("paling atas") || q.includes("bagian atas") || q.includes("awal dokumen")) {
        return this.moveToTop();
      }
      if (q.includes("paling bawah") || q.includes("bagian bawah") || q.includes("akhir dokumen")) {
        return this.moveToBottom();
      }

      // 1. Coba klik Google Docs Document Outline jika query berupa Judul/Bab
      const outlineItems = document.querySelectorAll(
        ".docs-navigation-tab-button, .navigation-item, .docs-navigation-item, [role='treeitem']"
      );
      for (const item of outlineItems) {
        const txt = item.textContent?.toLowerCase() || "";
        if (txt.includes(q)) {
          item.click();
          await new Promise((r) => setTimeout(r, 80));
          AutoTyper.focusEditor();
          return true;
        }
      }

      // 2. Cari di elemen paragraf dan baris yang dirender di kanvas editor Google Docs
      const paragraphs = document.querySelectorAll(
        ".kix-paragraphrenderer, .kix-lineview, .kix-lineview-text-block, .kix-word-htmlelement"
      );

      for (const p of paragraphs) {
        const txt = p.textContent?.toLowerCase() || "";
        if (txt.includes(q)) {
          p.scrollIntoView({ behavior: "smooth", block: "center" });
          await new Promise((r) => setTimeout(r, 100));

          const rect = p.getBoundingClientRect();
          const clientX = rect.left + Math.min(30, rect.width / 2);
          const clientY = rect.top + Math.min(12, rect.height / 2);

          const opts = { bubbles: true, cancelable: true, view: window, clientX, clientY };
          p.dispatchEvent(new MouseEvent("mousedown", opts));
          p.dispatchEvent(new MouseEvent("mouseup", opts));
          p.dispatchEvent(new MouseEvent("click", opts));

          AutoTyper.focusEditor();
          return true;
        }
      }

      // 3. Fallback: Dispatch shortcut find Google Docs (Ctrl+F)
      const tgt = this.getEditorTarget();
      if (tgt) {
        tgt.dispatchEvent(new KeyboardEvent("keydown", {
          key: "f",
          code: "KeyF",
          keyCode: 70,
          which: 70,
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
          composed: true
        }));
      }

      return false;
    }
  };

  AutoTyper.cursor = CursorNavigator;
  window.AutoTyper = AutoTyper;
  window.CursorNavigator = CursorNavigator;
})();
