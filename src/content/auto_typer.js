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
    isPaused: false,
    pauseRequested: false,
    abortRequested: false,
    currentDraftContext: null,
    currentFontSize: null,
    currentBold: null,
    currentAlign: null,

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
        const openMatch = s.match(/<{2,4}\s*DRAF[_\s]*DOKUMEN\s*>{2,4}/i);
        if (openMatch) {
          s = s.substring(openMatch.index + openMatch[0].length);
        }
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
     * Memeriksa status tebal (Bold) aktual dari toolbar Google Docs.
     */
    isBoldActive() {
      try {
        const boldBtn = document.getElementById("boldButton") ||
                        document.querySelector("#boldButton, [aria-label*='Tebal'], [aria-label*='Bold']");
        if (boldBtn) {
          const ariaPressed = boldBtn.getAttribute("aria-pressed");
          const ariaChecked = boldBtn.getAttribute("aria-checked");
          if (ariaPressed !== null) return ariaPressed === "true";
          if (ariaChecked !== null) return ariaChecked === "true";
          return boldBtn.classList.contains("goog-toolbar-button-checked") ||
                 boldBtn.classList.contains("docs-material-button-checked");
        }
      } catch {}
      return false;
    },

    /**
     * Mengatur status tebal huruf (Bold / Unbold).
     * Mencegah pembatalan ganda (anti-double-toggle):
     * Memeriksa status nyata toolbar Docs terlebih dahulu,
     * hanya mengeksekusi tepat satu aksi (klik tombol toolbar atau Ctrl+B fallback),
     * dan tidak pernah memicu keduanya sekaligus yang menyebabkan bold batal (on lalu off).
     */
    async setBold(shouldBeBold, target = null, iframe = null) {
      try {
        const targetBool = Boolean(shouldBeBold);
        const boldBtn = document.getElementById("boldButton") ||
                        document.querySelector("#boldButton, [aria-label*='Tebal (Ctrl+B)'], [aria-label*='Bold (Ctrl+B)'], [aria-label*='Tebal'], [aria-label*='Bold']");

        const current = this.isBoldActive();
        if (current === targetBool) {
          this.currentBold = targetBool;
          return targetBool;
        }

        // Jalankan HANYA SATU metode toggle untuk mencegah pembatalan ganda (anti-double-toggle)!
        let toggled = false;
        if (boldBtn) {
          // Klik tombol toolbar Bold menggunakan urutan pointer/mouse yang bersih
          const opts = { bubbles: true, cancelable: true, view: window };
          boldBtn.dispatchEvent(new MouseEvent("mousedown", opts));
          boldBtn.dispatchEvent(new MouseEvent("mouseup", opts));
          boldBtn.dispatchEvent(new MouseEvent("click", opts));

          // Verifikasi apakah state toolbar sudah berubah sesuai target
          if (this.isBoldActive() === targetBool) {
            toggled = true;
          }
        }

        // Fallback: HANYA jika tombol toolbar tidak merespons, dispatch Ctrl+B satu kali
        if (!toggled) {
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

        this.currentBold = targetBool;
        this.focusEditor();
        return targetBool;
      } catch (err) {
        console.warn("[AutoTyper] setBold error:", err);
      }
    },

    /**
     * Helper untuk mengklik elemen kontrol Docs dengan rangkaian pointer/mouse event lengkap.
     * Menjamin Google Closure Component mendeteksi interaksi tombol secara andal.
     */
    clickElement(el) {
      if (!el) return false;
      try {
        const rect = el.getBoundingClientRect();
        const clientX = rect.left + Math.max(1, rect.width / 2);
        const clientY = rect.top + Math.max(1, rect.height / 2);
        const opts = {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX,
          clientY
        };
        el.dispatchEvent(new PointerEvent("pointerdown", opts));
        el.dispatchEvent(new MouseEvent("mousedown", opts));
        el.dispatchEvent(new PointerEvent("pointerup", opts));
        el.dispatchEvent(new MouseEvent("mouseup", opts));
        el.dispatchEvent(new MouseEvent("click", opts));
        if (typeof el.click === "function") {
          el.click();
        }
        return true;
      } catch {
        try {
          if (typeof el.click === "function") {
            el.click();
            return true;
          }
        } catch {}
      }
      return false;
    },

    /**
     * Membaca ukuran font aktif secara nyata dari toolbar Google Docs.
     * MENGGUNAKAN SELECTOR KHUSUS FONT SIZE (DILARANG query generic combo button agar tidak salah baca zoom 100%!).
     */
    getActualFontSize() {
      try {
        // 1. Selector ID langsung elemen input font size (standar Google Docs)
        const directInput = document.getElementById("fontSizeInputElement");
        if (directInput) {
          const val = parseInt(directInput.value || directInput.getAttribute("value"), 10);
          if (val && !isNaN(val) && val >= 6 && val <= 100) return val;
        }

        // 2. Input yang scoped di dalam container font size Docs
        const scopedInput = document.querySelector(
          "#fontSizeSelect input, .docs-font-size-inc-dec-combobox input, [id*='fontSize'] input"
        );
        if (scopedInput) {
          const val = parseInt(scopedInput.value || scopedInput.getAttribute("value"), 10);
          if (val && !isNaN(val) && val >= 6 && val <= 100) return val;
        }

        // 3. Baca teks container combo button font size
        const fontContainer = document.getElementById("fontSizeSelect") ||
                              document.querySelector(".docs-font-size-inc-dec-combobox");
        if (fontContainer) {
          const txt = fontContainer.textContent || fontContainer.innerText || "";
          const m = txt.match(/\b(\d{1,2})\b/);
          if (m) {
            const val = parseInt(m[1], 10);
            if (val >= 6 && val <= 100) return val;
          }
        }

        // 4. Fallback ke state internal jika sudah ada
        if (this.currentFontSize && !isNaN(this.currentFontSize)) {
          return this.currentFontSize;
        }
      } catch (err) {
        console.warn("[AutoTyper] getActualFontSize warning:", err);
      }
      return 12;
    },

    /**
     * Input langsung angka font size ke input toolbar Google Docs (#fontSizeInputElement).
     */
    setDirectFontSizeInput(targetPt) {
      try {
        const input = document.getElementById("fontSizeInputElement") ||
                      document.querySelector("#fontSizeSelect input, .docs-font-size-inc-dec-combobox input");
        if (!input) return false;

        input.focus();
        if (typeof input.select === "function") {
          input.select();
        }

        try {
          document.execCommand("selectAll", false, null);
          document.execCommand("insertText", false, String(targetPt));
        } catch {}

        input.value = String(targetPt);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));

        const enterOpts = {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        };
        input.dispatchEvent(new KeyboardEvent("keydown", enterOpts));
        input.dispatchEvent(new KeyboardEvent("keypress", enterOpts));
        input.dispatchEvent(new KeyboardEvent("keyup", enterOpts));

        return true;
      } catch (err) {
        console.warn("[AutoTyper] setDirectFontSizeInput warning:", err);
        return false;
      }
    },

    /**
     * Kirimkan pintasan keyboard universal Google Docs untuk menaikkan/menurunkan ukuran font 1 pt.
     * Inc: Ctrl+Shift+. (Period / >)
     * Dec: Ctrl+Shift+, (Comma / <)
     */
    sendFontStepShortcut(direction = "inc", target = null, iframe = null) {
      const tgt = target || this.getEditorTarget();
      const ifr = iframe || this.getEditorIframe();
      const isInc = direction === "inc";

      const keyChar = isInc ? ">" : "<";
      const codeStr = isInc ? "Period" : "Comma";
      const keyCodeNum = isInc ? 190 : 188;

      const eventTargets = [
        tgt,
        ifr?.contentDocument?.body,
        ifr?.contentDocument,
        ifr?.contentWindow
      ].filter(Boolean);

      for (const t of eventTargets) {
        try {
          t.dispatchEvent(new KeyboardEvent("keydown", {
            key: keyChar,
            code: codeStr,
            keyCode: keyCodeNum,
            which: keyCodeNum,
            ctrlKey: true,
            shiftKey: true,
            bubbles: true,
            cancelable: true,
            composed: true
          }));
          t.dispatchEvent(new KeyboardEvent("keyup", {
            key: keyChar,
            code: codeStr,
            keyCode: keyCodeNum,
            which: keyCodeNum,
            ctrlKey: true,
            shiftKey: true,
            bubbles: true,
            cancelable: true,
            composed: true
          }));
        } catch {}
      }
    },

    /**
     * Mengatur Ukuran Font Google Docs secara presisi ke targetPt (16, 14, atau 12).
     * Mencegah runaway drift: jika sudah di ukuran target, langsung no-op.
     */
    async changeFontSize(targetPt, target = null, iframe = null) {
      const tgtPt = parseInt(targetPt, 10) || 12;

      // 0. State Guard: jika state internal sudah di target, JANGAN SENTUH APAPUN!
      if (this.currentFontSize === tgtPt) {
        return tgtPt;
      }

      // 1. Cek toolbar nyata
      const actualNow = this.getActualFontSize();
      if (actualNow === tgtPt) {
        this.currentFontSize = tgtPt;
        return tgtPt;
      }

      const cur = (this.currentFontSize && !isNaN(this.currentFontSize)) ? this.currentFontSize : actualNow;
      const diff = tgtPt - cur;

      // 2. Jalankan Direct Input ke input box Docs
      this.setDirectFontSizeInput(tgtPt);
      await new Promise((r) => setTimeout(r, 25));

      const afterDirect = this.getActualFontSize();
      if (afterDirect === tgtPt) {
        this.currentFontSize = tgtPt;
        this.focusEditor();
        return tgtPt;
      }

      // 3. Fallback: Gunakan tombol Increment (+) atau Decrement (-) serta keyboard shortcut
      if (diff !== 0) {
        const isInc = diff > 0;
        const btnId = isInc ? "fontSizeIncrement" : "fontSizeDecrement";
        const btn = document.getElementById(btnId) ||
                    document.querySelector(isInc
                      ? "[aria-label*='Besarkan ukuran font'], [aria-label*='Increase font size'], .docs-font-size-inc-button"
                      : "[aria-label*='Kecilkan ukuran font'], [aria-label*='Decrease font size'], .docs-font-size-dec-button");

        const steps = Math.abs(diff);
        for (let s = 0; s < steps; s++) {
          let clicked = false;
          if (btn) {
            clicked = this.clickElement(btn);
          }
          if (!clicked) {
            this.sendFontStepShortcut(isInc ? "inc" : "dec", target, iframe);
          }
        }
      }

      this.currentFontSize = tgtPt;
      this.focusEditor();
      return tgtPt;
    },

    /**
     * Kalibrasi dokumen ke standar resmi skripsi: 12 pt.
     * Sangat berguna untuk memulihkan dokumen yang sebelumnya terketik 19 pt / ukuran salah.
     */
    async calibrateTo12(target = null, iframe = null) {
      const actual = this.getActualFontSize();
      this.currentFontSize = actual;
      await this.changeFontSize(12, target, iframe);
      this.currentFontSize = 12;
      await this.setBold(false, target, iframe);
      this.applyAlignment("justify", target, iframe);
      return 12;
    },

    stepFontSize(direction = "inc", target = null, iframe = null) {
      const isInc = direction === "inc";
      const btnId = isInc ? "fontSizeIncrement" : "fontSizeDecrement";
      const btn = document.getElementById(btnId) ||
                  document.querySelector(isInc
                    ? "[aria-label*='Besarkan ukuran font'], [aria-label*='Increase font size']"
                    : "[aria-label*='Kecilkan ukuran font'], [aria-label*='Decrease font size']");
      if (btn && this.clickElement(btn)) {
        if (this.currentFontSize) {
          this.currentFontSize += (isInc ? 1 : -1);
        }
        return;
      }
      this.sendFontStepShortcut(direction, target, iframe);
      if (this.currentFontSize) {
        this.currentFontSize += (isInc ? 1 : -1);
      }
    },

    /**
     * Alias backward-compatible setFontSize
     */
    setFontSize(sizePt, target = null, iframe = null) {
      return this.changeFontSize(sizePt, target, iframe);
    },

    /**
     * Terapkan Perataan Paragraf Google Docs:
     * - Center: Ctrl+Shift+E (Judul Utama & Judul Bab)
     * - Left: Ctrl+Shift+L (Sub-bab & Entri Daftar Isi)
     * - Justify: Ctrl+Shift+J (Paragraf Isi Rata Kanan-Kiri)
     */
    applyAlignment(align = "justify", target = null, iframe = null) {
      if (this.currentAlign === align) {
        return true;
      }

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
        if (btn) {
          const isChecked =
            btn.getAttribute("aria-pressed") === "true" ||
            btn.getAttribute("aria-checked") === "true" ||
            btn.classList.contains("goog-toolbar-button-checked") ||
            btn.classList.contains("docs-material-button-checked");
          if (!isChecked) {
            this.clickElement(btn);
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

      this.currentAlign = align;
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
     * Mengetikkan teks secara instan ke Google Docs (Langsung Jadi).
     * Memancarkan seluruh sequence keyboard asli Docs (keydown, keypress, beforeinput, input, keyup)
     * secara synchronous murni tanpa per-character setTimeout sehingga seluruh alinea
     * muncul secara instan dalam 1 render frame.
     */
    async typeText(text, target = null, iframe = null) {
      if (!text || typeof text !== "string") return true;

      let tgt = target;
      let ifr = iframe;
      if (!tgt || !tgt.isConnected) {
        this.focusEditor();
        tgt = this.getEditorTarget();
        ifr = this.getEditorIframe();
      }

      const chars = Array.from(text);
      const len = chars.length;
      for (let c = 0; c < len; c++) {
        if (this.abortRequested) break;
        this.insertChar(chars[c], tgt, ifr);
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
      if (/^[A-Z0-9\s,:()\-'"\/]{15,}$/.test(trimmed) && !/[a-z]/.test(trimmed) && !/\.\s*$/.test(trimmed)) {
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
         /^[A-Z0-9\s,:()\-'"\/]{15,}$/.test(text) &&
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
      if (!rawText || rawText.length === 0) {
        if (options.onComplete) options.onComplete();
        return true;
      }

      this.isTyping = true;
      this.isPaused = false;
      this.pauseRequested = false;
      this.abortRequested = false;

      if (document.activeElement && typeof document.activeElement.blur === "function") {
        document.activeElement.blur();
      }

      this.focusEditor();
      await new Promise((res) => setTimeout(res, 30));
      this.focusEditor();

      let target = this.getEditorTarget();
      let iframe = this.getEditorIframe();
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

      // SMART POSITIONING PROTOCOL:
      // Pastikan pengetikan kelanjutan draf diarahkan ke tempat yang tepat (akhir dokumen / target section),
      // BUKAN di posisi acak tempat pointer mouse pengguna diklik.
      if (options.targetSection && CursorNavigator) {
        await CursorNavigator.moveToSection(options.targetSection);
        await new Promise((r) => setTimeout(r, 60));
      } else if (options.targetPosition === "end" || options.isContinuation || options.targetPosition !== "cursor") {
        if (CursorNavigator) {
          await CursorNavigator.ensureContinuationPosition();
          await new Promise((r) => setTimeout(r, 60));
        }
      }

      target = this.getEditorTarget();
      iframe = this.getEditorIframe();

      // Standarisasi awal naskah: Kalibrasi ke 12pt, unbold, dan Rata Kanan-Kiri (Justify)
      await this.calibrateTo12(target, iframe);

      // Inisialisasi konteks pengetikan draf untuk mendukung jeda & lanjutkan (pause/resume)
      this.currentDraftContext = {
        paragraphs,
        currentIndex: 0,
        inTocBlock: false,
        options
      };

      return this.runDraftLoop(this.currentDraftContext);
    },

    /**
     * Loop pengetikan alinea yang dapat dijeda (pause) dan dilanjutkan (resume) secara mulus.
     */
    async runDraftLoop(ctx) {
      if (!ctx || !Array.isArray(ctx.paragraphs)) return false;

      const paragraphs = ctx.paragraphs;
      const total = paragraphs.length;
      const options = ctx.options || {};
      const { onProgress, onComplete, onPause, onCancel, onError } = options;

      let target = this.getEditorTarget();
      let iframe = this.getEditorIframe();

      for (let i = ctx.currentIndex; i < total; i++) {
        // 1. Cek pembatalan total
        if (this.abortRequested) {
          this.isTyping = false;
          this.isPaused = false;
          this.abortRequested = false;
          this.currentDraftContext = null;
          if (onCancel) onCancel();
          return false;
        }

        // 2. Cek permintaan jeda pengetikan (Pause)
        if (this.pauseRequested) {
          this.isPaused = true;
          this.pauseRequested = false;
          ctx.currentIndex = i; // simpan alinea yang belum diketik
          const percent = Math.round((i / total) * 100);
          if (onPause) {
            onPause({
              current: i,
              total,
              percent,
              paragraphIndex: i,
              totalParagraphs: total
            });
          }
          return false;
        }

        // Re-focus dan ambil target editor mutakhir sebelum memproses alinea.
        // Sangat krusial saat teks melintasi batas halaman (page break / pagination)
        // di mana kanvas Docs mereposisi atau mendetach node target sebelumnya.
        this.focusEditor();
        target = this.getEditorTarget();
        iframe = this.getEditorIframe();

        const block = paragraphs[i].trim();
        if (!block) {
          ctx.currentIndex = i + 1;
          continue;
        }

        // Tutup jika ada popup spellcheck yang muncul
        this.dismissSpellPopup();

        // Deteksi status blok Daftar Isi
        if (/^DAFTAR\s+ISI/i.test(block)) {
          ctx.inTocBlock = true;
        } else if (ctx.inTocBlock && /^BAB\s+(?:[IVXLCDM]+|\d+)/i.test(block)) {
          ctx.inTocBlock = false;
        }

        const hInfo = this.parseLineHeading(block);
        const isTocLine = ctx.inTocBlock || this.isTableOfContentsLine(block);

        if (hInfo.isHeading && !isTocLine) {
          // ========================================================
          // EKSEKUSI FORMAT JUDUL (HEADINGS):
          // - Judul Dokumen Utama: 16 pt, BOLD, Center + 1 BARIS KOSONG PEMISAH
          // - Judul Bab (BAB 1 / KATA PENGANTAR): 14 pt, BOLD, Center + 1 BARIS KOSONG PEMISAH
          // - Sub-judul (1.1): 12 pt, BOLD, Left + 1 BARIS KOSONG PEMISAH
          // - Sub-sub-judul (1.1.1): 12 pt, BOLD, Left + 1 BARIS KOSONG PEMISAH
          // ATURAN MUTLAK: DILARANG MENYATU DENGAN TEKS DI SEKITARNYA!
          // ========================================================
          await this.changeFontSize(hInfo.fontSize, target, iframe);
          await this.setBold(true, target, iframe);
          this.applyAlignment(hInfo.align || "center", target, iframe);

          // Ketik teks judul ke Google Docs
          await this.typeText(hInfo.text, target, iframe);

          // Selesaikan baris judul (Enter 1)
          this.insertNewline(target, iframe);

          // WAJIB: Masukkan 1 baris kosong pemisah (Enter 2)
          // Menjamin Judul Utama, Judul Bab, dan Sub-bab TIDAK PERNAH MENYATU dengan teks di bawahnya!
          this.insertNewline(target, iframe);

          // Kembalikan ke standar teks isi (12 pt, unbold, Justified)
          await this.changeFontSize(12, target, iframe);
          await this.setBold(false, target, iframe);
          this.applyAlignment("justify", target, iframe);
        } else if (isTocLine) {
          // ========================================================
          // EKSEKUSI BARIS DAFTAR ISI (TABLE OF CONTENTS)
          // Header Daftar Isi: 14 pt BOLD, Center
          // Baris entri daftar isi: 12 pt NORMAL, Left, BEBAS TAB!
          // ========================================================
          const isTocHeader = /^DAFTAR\s+ISI/i.test(block);
          if (isTocHeader) {
            await this.changeFontSize(14, target, iframe);
            await this.setBold(true, target, iframe);
            this.applyAlignment("center", target, iframe);
          } else {
            await this.changeFontSize(12, target, iframe);
            await this.setBold(false, target, iframe);
            this.applyAlignment("left", target, iframe);
          }

          const cleanTocText = block.replace(/^\[(?:JUDUL_\d|H\d)\]\s*/i, "").trim();
          await this.typeText(cleanTocText, target, iframe);

          this.insertNewline(target, iframe);
          if (isTocHeader) {
            this.insertNewline(target, iframe);
          }

          // Kembalikan ke standar teks isi jika selesai baris TOC
          await this.changeFontSize(12, target, iframe);
          await this.setBold(false, target, iframe);
          this.applyAlignment("justify", target, iframe);
        } else {
          // ========================================================
          // EKSEKUSI PARAGRAF BIASA / ISI DOKUMEN:
          // - Ukuran font: 12 pt
          // - Format font: NORMAL (unbold)
          // - Format alinea: RATA KANAN-KIRI (Justify)
          // - Indentasi: WAJIB 1x TAB (~1.27 cm) di awal kalimat pertama
          // ========================================================
          await this.changeFontSize(12, target, iframe);
          await this.setBold(false, target, iframe);
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

          // Jika blok berikutnya adalah Judul Baru (Bab atau Sub-bab baru):
          // Tambahkan 1 baris kosong pemisah agar judul baru TIDAK PERNAH MENYATU dengan teks paragraf sebelumnya!
          if (i + 1 < total) {
            const nextBlock = paragraphs[i + 1].trim();
            const nextHInfo = this.parseLineHeading(nextBlock);
            if (nextHInfo.isHeading && !this.isTableOfContentsLine(nextBlock)) {
              this.insertNewline(target, iframe);
            }
          }
        }

        ctx.currentIndex = i + 1;
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

        // Jeda sangat singkat (15 ms) antar alinea agar Google Docs mereflow layout
        // dan event loop browser dapat menangkap interaksi klik jeda (pause) pengguna
        await new Promise((res) => setTimeout(res, 15));
      }

      this.isTyping = false;
      this.isPaused = false;
      this.pauseRequested = false;
      this.currentDraftContext = null;
      if (onComplete) onComplete();
      return true;
    },

    /**
     * Hentikan sementara (Pause) pengetikan draf.
     */
    pause() {
      if (this.isTyping && !this.isPaused) {
        this.pauseRequested = true;
        return true;
      }
      return false;
    },

    /**
     * Lanjutkan kembali (Resume) pengetikan draf dari posisi terakhir.
     */
    resume() {
      if (this.isTyping && this.isPaused && this.currentDraftContext) {
        this.isPaused = false;
        this.pauseRequested = false;
        const ctx = this.currentDraftContext;
        if (ctx.options && typeof ctx.options.onResume === "function") {
          const total = ctx.paragraphs.length;
          const pct = total > 0 ? Math.round((ctx.currentIndex / total) * 100) : 0;
          ctx.options.onResume({ percent: pct });
        }
        this.focusEditor();
        return this.runDraftLoop(ctx);
      }
      return false;
    },

    /**
     * Navigasi Satu Tombol: Bergantian Hentikan / Lanjutkan Pengetikan.
     */
    togglePauseResume() {
      if (!this.isTyping) return false;
      if (this.isPaused) {
        return this.resume();
      } else {
        return this.pause();
      }
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
        this.isTyping = false;
        this.isPaused = false;
        this.pauseRequested = false;
        if (this.currentDraftContext && this.currentDraftContext.options?.onCancel) {
          this.currentDraftContext.options.onCancel();
        }
        this.currentDraftContext = null;
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
      const ifr = this.getEditorIframe();
      AutoTyper.focusEditor();

      const eventTargets = [
        tgt,
        ifr?.contentDocument?.body,
        ifr?.contentDocument,
        ifr?.contentWindow,
        document.activeElement
      ].filter(Boolean);

      for (const t of eventTargets) {
        try {
          t.dispatchEvent(new KeyboardEvent("keydown", {
            key: "Home",
            code: "Home",
            keyCode: 36,
            which: 36,
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
            composed: true
          }));
          t.dispatchEvent(new KeyboardEvent("keyup", {
            key: "Home",
            code: "Home",
            keyCode: 36,
            which: 36,
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
            composed: true
          }));
        } catch {}
      }

      return true;
    },

    /**
     * Gerakkan kursor ke paling bawah dokumen (Ctrl + End & klik garis naskah terakhir).
     */
    async moveToBottom() {
      const tgt = this.getEditorTarget();
      const ifr = this.getEditorIframe();
      AutoTyper.focusEditor();

      // 1. Coba klik ujung kanan baris/paragraf terakhir di DOM Docs
      try {
        const textNodes = document.querySelectorAll(
          ".kix-paragraphrenderer, .kix-lineview, .kix-lineview-text-block"
        );
        if (textNodes && textNodes.length > 0) {
          const lastEl = textNodes[textNodes.length - 1];
          lastEl.scrollIntoView({ behavior: "instant", block: "end" });
          const rect = lastEl.getBoundingClientRect();
          if (rect && rect.width > 0) {
            const clientX = rect.right - 2;
            const clientY = rect.top + (rect.height / 2);
            const mouseOpts = { bubbles: true, cancelable: true, view: window, clientX, clientY };
            lastEl.dispatchEvent(new MouseEvent("mousedown", mouseOpts));
            lastEl.dispatchEvent(new MouseEvent("mouseup", mouseOpts));
            lastEl.dispatchEvent(new MouseEvent("click", mouseOpts));
          }
        }
      } catch {}

      AutoTyper.focusEditor();

      // 2. Dispatch Ctrl+End ke seluruh elemen editor dan iframe
      const eventTargets = [
        tgt,
        ifr?.contentDocument?.body,
        ifr?.contentDocument,
        ifr?.contentWindow,
        document.activeElement
      ].filter(Boolean);

      for (const t of eventTargets) {
        try {
          t.dispatchEvent(new KeyboardEvent("keydown", {
            key: "End",
            code: "End",
            keyCode: 35,
            which: 35,
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
            composed: true
          }));
          t.dispatchEvent(new KeyboardEvent("keyup", {
            key: "End",
            code: "End",
            keyCode: 35,
            which: 35,
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
            composed: true
          }));
        } catch {}
      }

      return true;
    },

    /**
     * PROTOKOL PENEMPATAN KELANJUTAN NASKAH RESMI:
     * Menjamin kursor diposisikan di akhir naskah dokumen pada baris baru yang bersih,
     * BUKAN di posisi acak tempat pointer mouse pengguna diklik.
     */
    async ensureContinuationPosition() {
      AutoTyper.focusEditor();
      await this.moveToBottom();
      await new Promise((r) => setTimeout(r, 60));

      const tgt = this.getEditorTarget();
      const ifr = this.getEditorIframe();

      // Jika dokumen sudah memiliki isi teks, masukkan baris baru (Enter) agar tidak menempel ke kalimat sebelumnya
      const hasText = Boolean(
        (window.PageLearner && window.PageLearner.getProfile()?.fullText?.trim()) ||
        document.querySelector(".kix-lineview-text-block")
      );

      if (hasText) {
        AutoTyper.typeEnter(tgt, ifr);
        await new Promise((r) => setTimeout(r, 50));
      }

      AutoTyper.focusEditor();
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
      if (q.includes("paling bawah") || q.includes("bagian bawah") || q.includes("akhir dokumen") || q.includes("lanjut") || q.includes("kelanjutan")) {
        return this.ensureContinuationPosition();
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
