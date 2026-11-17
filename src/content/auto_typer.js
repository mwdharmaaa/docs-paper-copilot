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

      // 0. Ekstrak bagian draf jika ada tag pembungkus
      const draftMatch = s.match(/<{2,4}\s*DRAF[_\s]*DOKUMEN\s*>{2,4}([\s\S]*?)<{2,4}\s*AKHIR[_\s]*DRAF[_\s]*DOKUMEN\s*>{2,4}/i);
      if (draftMatch) {
        s = draftMatch[1];
      } else {
        const closeMatch = s.match(/<{2,4}\s*AKHIR[_\s]*DRAF[_\s]*DOKUMEN\s*>{2,4}/i);
        if (closeMatch) {
          s = s.substring(0, closeMatch.index);
        }
      }

      // Hapus sisa-sisa tag jika masih ada
      s = s.replace(/<{2,4}\s*(?:DRAF|AKHIR)[_\s]*DOKUMEN\s*>{2,4}/gi, "");

      // 1. Bersihkan kalimat obrolan/sapaan pengantar AI di awal naskah jika ada
      // Contoh: "Sebagai GTyipe di Google Docs...", "Tentu, ini drafnya:", dsb.
      const academicStart = s.match(/(?:^|\n\n)(BAB\s+(?:[IVXLCDM]+|\d+)|DAFTAR\s+ISI|[A-Z0-9\s,:()\-]{15,}\n|\d+\.\d+\s+[A-Z])/i);
      if (academicStart && academicStart.index !== undefined && academicStart.index > 0) {
        const splitIdx = academicStart.index === 0 ? 0 : academicStart.index + (academicStart[0].startsWith("\n\n") ? 2 : 0);
        s = s.substring(splitIdx);
      } else {
        s = s.replace(/^(?:Sebagai GTyipe|Halo|Hai|Tentu|Baik|Berikut).*?\n\n/is, "");
      }

      // Buang pertanyaan penutup obrolan di akhir (misal: "Bagaimana menurut Anda...")
      s = s.replace(/\n+(?:Bagaimana menurut Anda|Apakah Anda|Silakan beritahu|Jika Anda ingin).*$/is, "");

      // 2. Bersihkan tag mesin jika ada: [JUDUL_DOKUMEN], [JUDUL_1], [JUDUL_2], dsb.
      s = s.replace(/\[(?:JUDUL_\d|H\d|JUDUL_DOKUMEN|TITLE|JUDUL_UTAMA|SUBJUDUL)\]\s*/gi, "");

      // 3. Bersihkan penanda header Markdown (#, ##, ###, dst.)
      s = s.replace(/^[ \t]*#+\s+(.*)$/gm, "$1");

      // 4. Hapus markdown code block markers
      s = s.replace(/^```[a-zA-Z]*\r?\n/gm, "");
      s = s.replace(/\r?\n```$/gm, "");
      s = s.replace(/```/g, "");

      // 5. Hapus garis horizontal (---, ***, ___)
      s = s.replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, "");

      // 6. Bersihkan asterisk penanda tebal/miring dari teks Docs murni
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

    /**
     * Mengatur status tebal huruf (Bold / Unbold).
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
          }

          const tgt = target || this.getEditorTarget();
          if (tgt) {
            try {
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
            } catch {}
          }
        }
      } catch (err) {
        console.warn("[AutoTyper] setBold error:", err);
      }
    },

    /**
     * Membaca ukuran font aktif secara nyata dari toolbar Google Docs.
     */
    getActualFontSize() {
      try {
        const input = document.querySelector(
          "#fontSizeInputElement, .docs-font-size-inc-dec-combobox input, #fontSizeSelect input, input.goog-toolbar-combo-button-input"
        );
        if (input) {
          const val = parseInt(input.value || input.getAttribute("value"), 10);
          if (val && !isNaN(val)) return val;
        }
        if (window.PageLearner && typeof window.PageLearner.detectFontSize === "function") {
          const val = parseInt(window.PageLearner.detectFontSize(), 10);
          if (val && !isNaN(val)) return val;
        }
      } catch {}
      return 12;
    },

    /**
     * Mengatur Ukuran Font Google Docs secara presisi ke targetPt (16, 14, atau 12).
     * Memanfaatkan input langsung toolbar dan tombol +/- tanpa risiko double-step.
     */
    changeFontSize(targetPt, currentPt = null, target = null, iframe = null) {
      const tgtPt = parseInt(targetPt, 10) || 12;
      const actualNow = this.getActualFontSize();
      if (actualNow === tgtPt) {
        return tgtPt;
      }

      // 1. Coba input langsung pada combobox font size toolbar Google Docs
      try {
        const input = document.querySelector(
          "#fontSizeInputElement, .docs-font-size-inc-dec-combobox input, #fontSizeSelect input, input.goog-toolbar-combo-button-input"
        );
        if (input) {
          input.focus();
          input.value = String(tgtPt);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          input.dispatchEvent(new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            which: 13,
            bubbles: true
          }));
          input.dispatchEvent(new KeyboardEvent("keyup", {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            which: 13,
            bubbles: true
          }));

          const updated = this.getActualFontSize();
          if (updated === tgtPt) {
            this.focusEditor();
            return tgtPt;
          }
        }
      } catch {}

      // 2. Jika input langsung belum mengubah, gunakan tombol Increment (+) atau Decrement (-)
      try {
        const cur = this.getActualFontSize();
        const diff = tgtPt - cur;
        if (diff !== 0) {
          const isInc = diff > 0;
          const btnSelector = isInc
            ? "#fontSizeIncrement, [aria-label*='Besarkan ukuran font'], [aria-label*='Increase font size'], .docs-font-size-inc-button"
            : "#fontSizeDecrement, [aria-label*='Kecilkan ukuran font'], [aria-label*='Decrease font size'], .docs-font-size-dec-button";
          const btn = document.querySelector(btnSelector);

          if (btn && typeof btn.click === "function") {
            const steps = Math.abs(diff);
            for (let s = 0; s < steps; s++) {
              btn.click();
            }
            this.focusEditor();
            return tgtPt;
          }

          // 3. Fallback: Shortcut keyboard universal Docs HANYA ke target editor kanvas
          const tgt = target || this.getEditorTarget();
          if (tgt) {
            const steps = Math.abs(diff);
            for (let s = 0; s < steps; s++) {
              tgt.dispatchEvent(new KeyboardEvent("keydown", {
                key: isInc ? ">" : "<",
                code: isInc ? "Period" : "Comma",
                keyCode: isInc ? 190 : 188,
                which: isInc ? 190 : 188,
                ctrlKey: true,
                shiftKey: true,
                bubbles: true,
                cancelable: true,
                composed: true
              }));
              tgt.dispatchEvent(new KeyboardEvent("keyup", {
                key: isInc ? ">" : "<",
                code: isInc ? "Period" : "Comma",
                keyCode: isInc ? 190 : 188,
                which: isInc ? 190 : 188,
                ctrlKey: true,
                shiftKey: true,
                bubbles: true,
                cancelable: true,
                composed: true
              }));
            }
          }
        }
      } catch {}

      this.focusEditor();
      return tgtPt;
    },

    stepFontSize(direction = "inc", target = null, iframe = null) {
      const tgt = target || this.getEditorTarget();
      const isInc = direction === "inc";
      const btnSelector = isInc
        ? "#fontSizeIncrement, [aria-label*='Besarkan ukuran font'], [aria-label*='Increase font size'], .docs-font-size-inc-button"
        : "#fontSizeDecrement, [aria-label*='Kecilkan ukuran font'], [aria-label*='Decrease font size'], .docs-font-size-dec-button";
      const btn = document.querySelector(btnSelector);
      if (btn && typeof btn.click === "function") {
        btn.click();
        return;
      }
      if (tgt) {
        tgt.dispatchEvent(new KeyboardEvent("keydown", {
          key: isInc ? ">" : "<",
          code: isInc ? "Period" : "Comma",
          keyCode: isInc ? 190 : 188,
          which: isInc ? 190 : 188,
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
          composed: true
        }));
        tgt.dispatchEvent(new KeyboardEvent("keyup", {
          key: isInc ? ">" : "<",
          code: isInc ? "Period" : "Comma",
          keyCode: isInc ? 190 : 188,
          which: isInc ? 190 : 188,
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
          composed: true
        }));
      }
    },

    /**
     * Alias backward-compatible setFontSize
     */
    setFontSize(sizePt, target = null, iframe = null) {
      return this.changeFontSize(sizePt, null, target, iframe);
    },

    /**
     * Terapkan Perataan Paragraf Google Docs:
     * - Center: Ctrl+Shift+E (Judul Utama & Judul Bab)
     * - Left: Ctrl+Shift+L (Sub-bab & Entri Daftar Isi)
     * - Justify: Ctrl+Shift+J (Paragraf Isi Rata Kanan-Kiri)
     */
    applyAlignment(align = "justify", target = null, iframe = null) {
      const tgt = target || this.getEditorTarget();
      const ifr = iframe || this.getEditorIframe();

      const config = {
        center: {
          key: "E", code: "KeyE", keyCode: 69,
          cmd: "justifyCenter",
          btnSelectors: ["#alignCenter", "[aria-label*='Rata tengah']", "[aria-label*='Center align']", ".docs-icon-align-center"]
        },
        left: {
          key: "L", code: "KeyL", keyCode: 76,
          cmd: "justifyLeft",
          btnSelectors: ["#alignLeft", "[aria-label*='Rata kiri']", "[aria-label*='Left align']", ".docs-icon-align-left"]
        },
        justify: {
          key: "J", code: "KeyJ", keyCode: 74,
          cmd: "justifyFull",
          btnSelectors: ["#alignJustify", "[aria-label*='Rata kanan kiri']", "[aria-label*='Justify']", ".docs-icon-align-justify"]
        }
      }[align] || {
        key: "J", code: "KeyJ", keyCode: 74,
        cmd: "justifyFull",
        btnSelectors: ["#alignJustify", "[aria-label*='Rata kanan kiri']", "[aria-label*='Justify']", ".docs-icon-align-justify"]
      };

      // 1. Coba klik tombol toolbar perataan jika ada
      try {
        let btn = null;
        for (const sel of config.btnSelectors) {
          btn = document.querySelector(sel);
          if (btn) break;
        }
        if (btn && typeof btn.click === "function") {
          const isChecked =
            btn.getAttribute("aria-pressed") === "true" ||
            btn.getAttribute("aria-checked") === "true" ||
            btn.classList.contains("goog-toolbar-button-checked") ||
            btn.classList.contains("docs-material-button-checked");
          if (!isChecked) {
            btn.click();
          }
        }
      } catch {}

      // 2. Dispatch shortcut Google Docs ke target editor
      if (tgt) {
        try {
          tgt.dispatchEvent(new KeyboardEvent("keydown", {
            key: config.key,
            code: config.code,
            keyCode: config.keyCode,
            which: config.keyCode,
            ctrlKey: true,
            shiftKey: true,
            bubbles: true,
            cancelable: true,
            composed: true
          }));
          tgt.dispatchEvent(new KeyboardEvent("keyup", {
            key: config.key,
            code: config.code,
            keyCode: config.keyCode,
            which: config.keyCode,
            ctrlKey: true,
            shiftKey: true,
            bubbles: true,
            cancelable: true,
            composed: true
          }));
        } catch {}
      }

      // 3. Eksekusi native command di iframe
      if (ifr && ifr.contentDocument) {
        try { ifr.contentDocument.execCommand(config.cmd, false, null); } catch {}
      }

      return true;
    },

    applyJustifyAlignment(target = null, iframe = null) {
      return this.applyAlignment("justify", target, iframe);
    },

    /**
     * Memastikan teks kembali ke standar normal (12 pt, unbold, Justified).
     */
    ensureNormalFont(target = null, iframe = null) {
      this.setBold(false, target, iframe);
      this.applyAlignment("justify", target, iframe);
    },

    /**
     * Menghilangkan popup spellcheck Google Docs jika sempat muncul.
     */
    dismissSpellPopup() {
      try {
        const popups = document.querySelectorAll(
          '.docsSpellWizCheckupSurface, [class*="docsSpellWiz"], [class*="SpellWiz"], [id*="docsSpellWiz"], .docs-spell-bubble'
        );
        for (const p of popups) {
          const container = p.closest(".docs-bubble, .docs-callout-bubble, div[role='dialog']") || p;
          container.style.display = "none";
          container.remove();
        }
      } catch {}
    },

    /**
     * Terapkan Format Judul Google Docs (Heading 1..6 / Normal Text)
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
      let tgt = target;
      let ifr = iframe;
      if (!tgt || !tgt.isConnected) {
        this.focusEditor();
        tgt = this.getEditorTarget();
        ifr = this.getEditorIframe();
      }
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
     * Memasukkan Indentasi 1x Tab Resmi Skripsi (~1.27 cm / 0.5 inci).
     * Mengeksekusi penekanan tombol Tab asli Docs dan input \t tanpa spasi berlebih.
     */
    insertTab(target = null, iframe = null) {
      let tgt = target;
      let ifr = iframe;
      if (!tgt || !tgt.isConnected) {
        this.focusEditor();
        tgt = this.getEditorTarget();
        ifr = this.getEditorIframe();
      }
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

    /**
     * Mengetikkan teks secara cepat dan andal ke Google Docs menggunakan event keyboard asli.
     * Dilengkapi deteksi koneksi DOM otomatis (isConnected) dan pemulihan fokus
     * agar tidak pernah terhenti atau terpotong saat terjadi page break / pagination!
     */
    async typeText(text, target = null, iframe = null) {
      if (!text || typeof text !== "string") return true;

      const chars = Array.from(text);
      for (let c = 0; c < chars.length; c++) {
        if (this.abortRequested) break;

        // Pastikan target masih terhubung ke DOM kanvas Docs
        let tgt = target;
        let ifr = iframe;
        if (!tgt || !tgt.isConnected) {
          this.focusEditor();
          tgt = this.getEditorTarget();
          ifr = this.getEditorIframe();
        }

        this.insertChar(chars[c], tgt, ifr);

        // Jeda sangat singkat (2 ms) setiap 35 karakter agar thread render Google Docs
        // dapat memproses event tanpa drop event dan tanpa lag
        if (c > 0 && c % 35 === 0) {
          await new Promise((res) => setTimeout(res, 2));
        }
      }
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

    /**
     * Memeriksa apakah suatu baris merupakan judul akademik (Bab, Sub-bab, atau Judul Utama).
     */
    isHeadingLine(line) {
      if (!line || typeof line !== "string") return false;
      const trimmed = line.trim();
      if (trimmed.length === 0) return false;

      // Tag eksplisit jika ada
      if (/^\[(?:JUDUL_\d|H\d|JUDUL_DOKUMEN|TITLE|JUDUL_UTAMA|SUBJUDUL)\]/i.test(trimmed)) {
        return true;
      }

      // Bab: BAB 1, BAB 2, BAB I, BAB II
      if (/^BAB\s+(?:[IVXLCDM]+|\d+)(?:\s+.*)?$/i.test(trimmed)) {
        return true;
      }

      // Bagian Utama Dokumen: DAFTAR ISI, DAFTAR PUSTAKA, dsb.
      if (/^(?:DAFTAR\s+ISI|DAFTAR\s+PUSTAKA|KATA\s+PENGANTAR|ABSTRAK|RINGKASAN|DAFTAR\s+TABEL|DAFTAR\s+GAMBAR|LAMPIRAN)$/i.test(trimmed)) {
        return true;
      }

      // Sub-bab desimal: 1.1 Latar Belakang, 2.1 bla bla
      if (/^\d+\.\d+\.?\s+[A-Z]/.test(trimmed)) {
        return true;
      }

      // Sub-sub-bab desimal: 1.1.1 Identifikasi Masalah
      if (/^\d+\.\d+\.\d+\.?\s+[A-Z]/.test(trimmed)) {
        return true;
      }

      // Poin sub-bab abjad tunggal: a. Faktor Internal, b. Faktor Eksternal
      if (/^[a-z]\.\s+[A-Z]/.test(trimmed)) {
        return true;
      }

      // Judul Dokumen Utama: Baris huruf kapital semua tanpa titik di akhir, panjang >= 15 karakter
      if (/^[A-Z0-9\s,:()\-]{15,}$/.test(trimmed) && !/[a-z]/.test(trimmed) && !/\.\s*$/.test(trimmed)) {
        return true;
      }

      return false;
    },

    /**
     * Memecah draf menjadi unit-unit penulisan mandiri.
     * Setiap Judul (Dokumen, Bab, Sub-bab) dan setiap Alinea Paragraf
     * diisolasi menjadi entitas tersendiri, menjamin indentasi 1x Tab
     * dan format tipografi selalu 100% konsisten.
     */
    splitIntoParagraphs(text) {
      if (!text || typeof text !== "string") return [];
      const lines = text.split(/\r?\n/);
      const paragraphs = [];
      let currentBody = [];

      const flushBody = () => {
        if (currentBody.length > 0) {
          const bodyStr = currentBody.join(" ").trim();
          if (bodyStr.length > 0) {
            paragraphs.push(bodyStr);
          }
          currentBody = [];
        }
      };

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) {
          flushBody();
          continue;
        }

        const isHeading = this.isHeadingLine(line);
        const isToc = this.isTableOfContentsLine(line);

        if (isHeading || isToc) {
          flushBody();
          paragraphs.push(line);
        } else {
          currentBody.push(line);
        }
      }
      flushBody();
      return paragraphs;
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
     * Menganalisis tingkat judul, ukuran font, perataan, dan status tebal (bold).
     * Standar Resmi:
     * - Judul Utama Dokumen: 16 pt, BOLD, Center
     * - Judul Bab / Bagian Utama (BAB 1, DAFTAR ISI): 14 pt, BOLD, Center
     * - Sub-judul (1.1, 1.2): 12 pt, BOLD, Left
     * - Sub-sub-judul (1.1.1): 12 pt, BOLD, Left
     * - Seluruh Teks Isi Paragraf: 12 pt, NORMAL (unbold), Justify
     */
    parseLineHeading(rawLine) {
      if (!rawLine || typeof rawLine !== "string") {
        return { level: 0, text: "", isHeading: false, fontSize: 12, isBold: false, align: "justify" };
      }

      let text = rawLine.trim();

      // Deteksi tag eksplisit
      const isExplicitDocTitle = /^\[(?:JUDUL_DOKUMEN|TITLE|JUDUL_UTAMA)\]/i.test(text);
      const isExplicitBab = /^\[(?:JUDUL_1|H1)\]/i.test(text);
      const isExplicitSub = /^\[(?:JUDUL_2|H2|SUBJUDUL)\]/i.test(text);
      const isExplicitSubSub = /^\[(?:JUDUL_3|H3|JUDUL_4|H4)\]/i.test(text);

      text = text.replace(/^\[(?:JUDUL_\d|H\d|JUDUL_DOKUMEN|TITLE|JUDUL_UTAMA|SUBJUDUL)\]\s*/i, "").trim();

      // 1. Judul Utama Dokumen: 16 pt, BOLD, Center
      if (
        isExplicitDocTitle ||
        (/^BAB\s+/i.test(text) === false &&
         /^[A-Z0-9\s,:()\-]{15,}$/.test(text) &&
         !/[a-z]/.test(text) &&
         !/\.\s*$/.test(text))
      ) {
        return { level: 1, isDocTitle: true, isHeading: true, fontSize: 16, isBold: true, align: "center", text };
      }

      // 2. Judul Bab / Bagian Utama (BAB 1, DAFTAR ISI, DAFTAR PUSTAKA): 14 pt, BOLD, Center
      if (
        isExplicitBab ||
        /^BAB\s+(?:[IVXLCDM]+|\d+)(?:\s+.*)?$/i.test(text) ||
        /^(?:DAFTAR\s+ISI|DAFTAR\s+PUSTAKA|KATA\s+PENGANTAR|ABSTRAK|RINGKASAN|DAFTAR\s+TABEL|DAFTAR\s+GAMBAR|LAMPIRAN)$/i.test(text)
      ) {
        return { level: 1, isDocTitle: false, isHeading: true, fontSize: 14, isBold: true, align: "center", text };
      }

      // 3. Sub-judul desimal (1.1 Latar Belakang): 12 pt, BOLD, Left
      if (isExplicitSub || /^\d+\.\d+\.?\s+[A-Z]/.test(text)) {
        return { level: 2, isHeading: true, fontSize: 12, isBold: true, align: "left", text };
      }

      // 4. Sub-sub-judul (1.1.1): 12 pt, BOLD, Left
      if (isExplicitSubSub || /^\d+\.\d+\.\d+\.?\s+[A-Z]/.test(text) || /^[a-z]\.\s+[A-Z]/.test(text)) {
        return { level: 3, isHeading: true, fontSize: 12, isBold: true, align: "left", text };
      }

      // 5. Paragraf biasa / isi dokumen (12 pt, NORMAL / UNBOLD, Justify)
      return { level: 0, text, isHeading: false, fontSize: 12, isBold: false, align: "justify" };
    },

    /**
     * PROTOKOL UTAMA: Langsung Selesai Satu Draf (Instant Whole Draft)
     * Mengintegrasikan:
     * - Ukuran font: Judul Utama (16 pt bold, Center), Bab (14 pt bold, Center), Sub-judul (12 pt bold, Left), Isi (12 pt normal, Justify)
     * - Indentasi 1x Tab (~1.27 cm) di setiap awal paragraf baru
     * - Format Rata Kanan-Kiri (Justify)
     * - Daftar Isi bebas tab
     * - Bebas popup spellcheck
     * - Resilient terhadap batas halaman (anti-cutoff)
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
      await new Promise((res) => setTimeout(res, 40));
      this.focusEditor();

      let target = this.getEditorTarget();
      let iframe = this.getEditorIframe();
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

      // Standarisasi awal naskah: Bawa ukuran font ke 12pt, unbold, dan Rata Kanan-Kiri (Justify)
      this.changeFontSize(12, null, target, iframe);
      this.setBold(false, target, iframe);
      this.applyAlignment("justify", target, iframe);

      let inTocBlock = false;

      for (let i = 0; i < total; i++) {
        if (this.abortRequested) {
          this.isTyping = false;
          this.abortRequested = false;
          if (onCancel) onCancel();
          return false;
        }

        // Re-focus dan ambil target editor mutakhir sebelum memproses alinea.
        // Sangat krusial saat teks melintasi batas halaman (page break / pagination)
        // di mana kanvas Docs mereposisi atau mendetach node target sebelumnya.
        this.focusEditor();
        target = this.getEditorTarget();
        iframe = this.getEditorIframe();

        const block = paragraphs[i].trim();
        if (!block) continue;

        // Tutup jika ada popup spellcheck yang muncul
        this.dismissSpellPopup();

        // Deteksi status blok Daftar Isi
        if (/^DAFTAR\s+ISI/i.test(block)) {
          inTocBlock = true;
        } else if (inTocBlock && /^BAB\s+(?:[IVXLCDM]+|\d+)/i.test(block)) {
          inTocBlock = false;
        }

        const hInfo = this.parseLineHeading(block);
        const isTocLine = inTocBlock || this.isTableOfContentsLine(block);

        if (hInfo.isHeading && !isTocLine) {
          // ========================================================
          // EKSEKUSI FORMAT JUDUL (HEADINGS):
          // - Judul Dokumen Utama: 16 pt, BOLD, Center
          // - Judul Bab (BAB 1 / KATA PENGANTAR): 14 pt, BOLD, Center
          // - Sub-judul (1.1): 12 pt, BOLD, Left
          // - Sub-sub-judul (1.1.1): 12 pt, BOLD, Left
          // ========================================================
          this.changeFontSize(hInfo.fontSize, null, target, iframe);
          this.setBold(true, target, iframe);
          this.applyAlignment(hInfo.align || "center", target, iframe);

          // Ketik teks judul ke Google Docs
          await this.typeText(hInfo.text, target, iframe);

          // Baris baru setelah judul
          this.insertNewline(target, iframe);

          // Kembalikan ke standar teks isi (12 pt, unbold, Justified)
          this.changeFontSize(12, null, target, iframe);
          this.setBold(false, target, iframe);
          this.applyAlignment("justify", target, iframe);
        } else if (isTocLine) {
          // ========================================================
          // EKSEKUSI BARIS DAFTAR ISI (TABLE OF CONTENTS)
          // Header Daftar Isi: 14 pt BOLD, Center
          // Baris entri daftar isi: 12 pt NORMAL, Left, BEBAS TAB!
          // ========================================================
          const isTocHeader = /^DAFTAR\s+ISI/i.test(block);
          if (isTocHeader) {
            this.changeFontSize(14, null, target, iframe);
            this.setBold(true, target, iframe);
            this.applyAlignment("center", target, iframe);
          } else {
            this.changeFontSize(12, null, target, iframe);
            this.setBold(false, target, iframe);
            this.applyAlignment("left", target, iframe);
          }

          const cleanTocText = block.replace(/^\[(?:JUDUL_\d|H\d)\]\s*/i, "").trim();
          await this.typeText(cleanTocText, target, iframe);

          this.insertNewline(target, iframe);

          // Kembalikan ke standar teks isi jika selesai baris TOC
          this.changeFontSize(12, null, target, iframe);
          this.setBold(false, target, iframe);
          this.applyAlignment("justify", target, iframe);
        } else {
          // ========================================================
          // EKSEKUSI PARAGRAF BIASA / ISI DOKUMEN:
          // - Ukuran font: 12 pt
          // - Format font: NORMAL (unbold)
          // - Format alinea: RATA KANAN-KIRI (Justify)
          // - Indentasi: WAJIB 1x TAB (~1.27 cm) di awal kalimat pertama
          // ========================================================
          this.changeFontSize(12, null, target, iframe);
          this.setBold(false, target, iframe);
          this.applyAlignment("justify", target, iframe);

          const isList = /^[-*•]\s+/.test(block) || /^\d+\.\s+/.test(block);
          let textToType = block;

          if (textToType.startsWith("\t")) {
            textToType = textToType.replace(/^\t+/, "");
          }

          // WAJIB 1x Tab pada awal paragraf baru jika bukan daftar poin
          if (!isList && textToType.length > 0) {
            this.insertTab(target, iframe);
          }

          // Ketik teks alinea menggunakan sequence event keyboard asli Docs
          await this.typeText(textToType, target, iframe);

          this.insertNewline(target, iframe);
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

        // Jeda singkat (45ms) antar unit agar kanvas Google Docs
        // selesai mereflow layout dan pagination tanpa lag
        await new Promise((res) => setTimeout(res, 45));
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
