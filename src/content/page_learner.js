/**
 * GTyipe - Google Docs Page Learner Engine
 * Inspects active Google Docs typography, layout, margins, paragraph structure,
 * and document writing style to guide AI generation.
 */

(function initPageLearner() {
  const PageLearner = {
    cachedProfile: null,

    /**
     * Dapatkan judul dokumen aktif Google Docs.
     */
    getDocTitle() {
      const titleInput = document.querySelector(".docs-title-input") || document.querySelector("#docs-title-widget input");
      if (titleInput && titleInput.value && titleInput.value.trim()) {
        return titleInput.value.trim();
      }
      const labelInner = document.querySelector(".docs-title-input-label-inner");
      if (labelInner && labelInner.textContent && labelInner.textContent.trim()) {
        return labelInner.textContent.trim();
      }
      const rawTitle = document.title || "";
      const cleaned = rawTitle.replace(/\s*-\s*Google (?:Dokumen|Docs).*$/i, "").trim();
      return cleaned || "Dokumen Google Docs";
    },

    /**
     * Ekstraksi teks lengkap, outline, statistik, dan titik henti penulisan dokumen.
     */
    extractFullDocument(maxLength = 50000) {
      const docTitle = this.getDocTitle();
      const paragraphs = [];

      // 1. Primary: Ambil setiap alinea dari .kix-paragraphrenderer
      const rendererNodes = document.querySelectorAll(".kix-paragraphrenderer");
      if (rendererNodes && rendererNodes.length > 0) {
        for (const node of rendererNodes) {
          const raw = (node.innerText || node.textContent || "")
            .replace(/\u00A0/g, " ")
            .replace(/\u200B/g, "")
            .trim();
          if (raw && raw.length > 0) {
            paragraphs.push(raw);
          }
        }
      }

      // 2. Fallback: Ekstrak dari .kix-lineview jika paragraphrenderer kosong
      if (paragraphs.length === 0) {
        const lineNodes = document.querySelectorAll(".kix-lineview");
        let currentPara = [];
        for (const line of lineNodes) {
          const raw = (line.innerText || line.textContent || "")
            .replace(/\u00A0/g, " ")
            .replace(/\u200B/g, "")
            .trim();
          if (raw) {
            currentPara.push(raw);
          } else if (currentPara.length > 0) {
            paragraphs.push(currentPara.join(" "));
            currentPara = [];
          }
        }
        if (currentPara.length > 0) {
          paragraphs.push(currentPara.join(" "));
        }
      }

      // 3. Fallback: Ekstrak dari .kix-appview-editor
      if (paragraphs.length === 0) {
        const editor = document.querySelector(".kix-appview-editor");
        if (editor) {
          const raw = (editor.innerText || "")
            .replace(/\u00A0/g, " ")
            .replace(/\u200B/g, "");
          const lines = raw.split(/\n+/).map(p => p.trim()).filter(Boolean);
          for (const l of lines) {
            paragraphs.push(l);
          }
        }
      }

      // Bersihkan dan de-duplikasi paragraf yang berulang akibat rendering ganda
      const cleanParagraphs = [];
      for (let i = 0; i < paragraphs.length; i++) {
        const p = paragraphs[i];
        if (i === 0 || p !== paragraphs[i - 1]) {
          cleanParagraphs.push(p);
        }
      }

      const fullText = cleanParagraphs.join("\n\n").slice(0, maxLength);
      const totalWords = fullText.trim() ? fullText.trim().split(/\s+/).length : 0;
      const totalChars = fullText.length;

      // Ekstrak struktur bab / outline dokumen
      const outline = [];
      const outlineItems = document.querySelectorAll(
        ".navigation-item, .docs-navigation-tab-button, .docs-navigation-item, [role='treeitem']"
      );
      if (outlineItems && outlineItems.length > 0) {
        for (const item of outlineItems) {
          const t = item.textContent?.trim();
          if (t && t.length > 2 && !outline.includes(t)) {
            outline.push(t);
          }
        }
      }

      // Deteksi heading dari baris paragraf
      for (const p of cleanParagraphs) {
        if (/^BAB\s+(?:[IVXLCDM]+|\d+)/i.test(p) || /^\d+\.\d+(\.\d+)?\s+[A-Z]/i.test(p) || /^(?:DAFTAR\s+ISI|DAFTAR\s+PUSTAKA|ABSTRAK|KATA\s+PENGANTAR)$/i.test(p)) {
          if (!outline.includes(p)) {
            outline.push(p);
          }
        }
      }

      // Identifikasi bagian akhir / titik henti pengetikan dokumen
      const lastParagraphs = cleanParagraphs.slice(-3);
      const lastParagraphText = cleanParagraphs.length > 0 ? cleanParagraphs[cleanParagraphs.length - 1] : "";

      let lastHeading = "";
      for (let i = cleanParagraphs.length - 1; i >= 0; i--) {
        const p = cleanParagraphs[i];
        if (/^BAB\s+(?:[IVXLCDM]+|\d+)/i.test(p) || /^\d+\.\d+(\.\d+)?\s+[A-Z]/i.test(p) || /^(?:DAFTAR\s+ISI|DAFTAR\s+PUSTAKA|ABSTRAK|KATA\s+PENGANTAR)$/i.test(p)) {
          lastHeading = p;
          break;
        }
      }
      if (!lastHeading && outline.length > 0) {
        lastHeading = outline[outline.length - 1];
      }

      let continuationHint = "";
      if (lastHeading) {
        continuationHint = `Naskah terakhir berada pada '${lastHeading}'.`;
      }
      if (lastParagraphText) {
        continuationHint += ` Alinea terakhir: "${lastParagraphText.slice(0, 160)}${lastParagraphText.length > 160 ? '...' : ''}". Pengetikan kelanjutan siap disambung di akhir dokumen.`;
      }

      return {
        docTitle,
        fullText,
        paragraphs: cleanParagraphs,
        outline,
        lastHeading,
        lastParagraphs,
        lastParagraphText,
        continuationHint,
        wordCount: totalWords,
        paragraphCount: cleanParagraphs.length,
        charCount: totalChars
      };
    },

    /**
     * Detect the active or dominant font family in the document.
     */
    detectFontFamily() {
      // 1. Try Google Docs toolbar font combo box
      const fontSelectors = [
        ".docs-font-family-select .goog-toolbar-combo-button-input",
        ".docs-font-family-select",
        "#fontFamily",
        "div[id*='fontFamily']",
        "div[aria-label*='Font:']",
        "div[aria-label*='Font']",
        "[aria-label*='Jenis font']"
      ];

      for (const sel of fontSelectors) {
        try {
          const el = document.querySelector(sel);
          if (el) {
            const fontVal = el.value || el.innerText || el.textContent || el.getAttribute("aria-label");
            if (fontVal && typeof fontVal === "string") {
              const clean = fontVal.replace(/^(Font:?|Jenis font:?)/i, "").trim();
              if (clean && clean.length > 1 && !clean.includes("Combo")) {
                return clean;
              }
            }
          }
        } catch {}
      }

      // 2. Sample computed styles from document text elements
      const textSpans = document.querySelectorAll(
        ".kix-lineview-text-block span, .kix-word-htmlelement, .kix-paragraphrenderer span, .kix-appview-editor span"
      );

      const fontCounts = {};
      let checked = 0;

      for (const span of textSpans) {
        const text = span.textContent?.trim();
        if (text && text.length > 2 && /[a-zA-Z]/.test(text)) {
          try {
            const font = window.getComputedStyle(span).fontFamily;
            if (font) {
              const primaryFont = font.split(",")[0].replace(/['"]/g, "").trim();
              if (primaryFont && !primaryFont.startsWith("docs-")) {
                fontCounts[primaryFont] = (fontCounts[primaryFont] || 0) + 1;
                checked++;
                if (checked >= 20) break;
              }
            }
          } catch {}
        }
      }

      let dominantFont = "";
      let maxCount = 0;
      for (const [font, count] of Object.entries(fontCounts)) {
        if (count > maxCount) {
          maxCount = count;
          dominantFont = font;
        }
      }

      return dominantFont || "Times New Roman";
    },

    /**
     * Detect font size of active text or dominant body paragraphs.
     */
    detectFontSize() {
      // 1. Selector ID langsung elemen input font size Docs (#fontSizeInputElement)
      const directInput = document.getElementById("fontSizeInputElement");
      if (directInput) {
        const val = parseInt(directInput.value || directInput.getAttribute("value"), 10);
        if (val && !isNaN(val) && val >= 6 && val <= 100) {
          return `${val}pt`;
        }
      }

      // 2. Toolbar scoped font size input (DILARANG query generic combo button agar tidak salah baca zoom 100%)
      const sizeSelectors = [
        "#fontSizeSelect input",
        "div[id*='fontSizeSelect'] input",
        ".docs-font-size-inc-dec-combobox input",
        "[aria-label*='Ukuran font'] input",
        "[aria-label*='Font size'] input"
      ];

      for (const sel of sizeSelectors) {
        try {
          const el = document.querySelector(sel);
          if (el) {
            const val = parseInt(el.value || el.innerText || el.textContent, 10);
            if (val && !isNaN(val) && val >= 6 && val <= 100) {
              return `${val}pt`;
            }
          }
        } catch {}
      }

      // 3. Frequency histogram sampling from text spans (mencari ukuran dominan alinea isi)
      const textSpans = document.querySelectorAll(
        ".kix-lineview-text-block span, .kix-word-htmlelement, .kix-paragraphrenderer span"
      );
      const sizeCounts = {};
      let checked = 0;

      for (const span of textSpans) {
        const text = span.textContent?.trim();
        if (text && text.length > 5) {
          try {
            const fs = window.getComputedStyle(span).fontSize;
            if (fs) {
              const px = parseFloat(fs);
              if (px > 0) {
                const pt = Math.round(px * 0.75);
                if (pt >= 8 && pt <= 72) {
                  sizeCounts[pt] = (sizeCounts[pt] || 0) + 1;
                  checked++;
                  if (checked >= 30) break;
                }
              }
            }
          } catch {}
        }
      }

      let dominantSize = 12;
      let maxCount = 0;
      for (const [ptStr, count] of Object.entries(sizeCounts)) {
        const countNum = parseInt(count, 10);
        if (countNum > maxCount) {
          maxCount = countNum;
          dominantSize = parseInt(ptStr, 10);
        }
      }

      if (maxCount > 0) {
        return `${dominantSize}pt`;
      }

      return "12pt";
    },

    /**
     * Detect page margins, paper dimensions, and standard formats.
     */
    detectMarginsAndPage() {
      const pageWrapper =
        document.querySelector(".kix-page-content-wrapper") ||
        document.querySelector(".kix-page") ||
        document.querySelector(".kix-page-paginated");

      let leftPx = 96;
      let rightPx = 96;
      let topPx = 96;
      let bottomPx = 96;
      let widthPx = 794;

      if (pageWrapper) {
        try {
          const style = window.getComputedStyle(pageWrapper);
          leftPx = parseFloat(style.paddingLeft) || parseFloat(style.marginLeft) || 96;
          rightPx = parseFloat(style.paddingRight) || parseFloat(style.marginRight) || 96;
          topPx = parseFloat(style.paddingTop) || parseFloat(style.marginTop) || 96;
          bottomPx = parseFloat(style.paddingBottom) || parseFloat(style.marginBottom) || 96;
          widthPx = parseFloat(style.width) || 794;
        } catch {}
      }

      const pxToCm = (px) => (px / 96 * 2.54).toFixed(1);
      const leftCm = parseFloat(pxToCm(leftPx));
      const rightCm = parseFloat(pxToCm(rightPx));
      const topCm = parseFloat(pxToCm(topPx));
      const bottomCm = parseFloat(pxToCm(bottomPx));

      // Detect standard Indonesian Skripsi / Academic Thesis format (4-4-3-3 cm)
      const isSkripsiMargin =
        (Math.abs(leftCm - 4.0) <= 0.6 || Math.abs(leftCm - 3.8) <= 0.5) &&
        (Math.abs(topCm - 4.0) <= 0.6 || Math.abs(topCm - 3.8) <= 0.5) &&
        (Math.abs(rightCm - 3.0) <= 0.5 || Math.abs(rightCm - 2.8) <= 0.5);

      // Detect standard 1 inch (2.54 cm) Normal margin
      const isNormalMargin =
        Math.abs(leftCm - 2.5) <= 0.4 &&
        Math.abs(rightCm - 2.5) <= 0.4;

      let marginDescription = `Kiri: ${leftCm} cm, Atas: ${topCm} cm, Kanan: ${rightCm} cm, Bawah: ${bottomCm} cm`;
      if (isSkripsiMargin) {
        marginDescription = `Format Skripsi / Karya Ilmiah (Kiri: 4cm, Atas: 4cm, Kanan: 3cm, Bawah: 3cm)`;
      } else if (isNormalMargin) {
        marginDescription = `Standar Normal (1 inci / 2.54 cm)`;
      }

      const pageSize = widthPx <= 800 ? "A4 (21 x 29.7 cm)" : "Letter (8.5 x 11 inci)";

      return {
        margins: marginDescription,
        pageSize,
        isSkripsiMargin
      };
    },

    /**
     * Detect paragraph text alignment (Justify, Left, Center, Right).
     */
    detectAlignment() {
      // 1. Check toolbar alignment buttons
      const justifyBtn =
        document.getElementById("alignJustify") ||
        document.querySelector("[aria-label*='Rata kanan-kiri']") ||
        document.querySelector("[aria-label*='Justify']") ||
        document.querySelector("[id*='alignJustify']");

      if (justifyBtn) {
        const isChecked =
          justifyBtn.getAttribute("aria-pressed") === "true" ||
          justifyBtn.getAttribute("aria-checked") === "true" ||
          justifyBtn.classList.contains("goog-toolbar-button-checked") ||
          justifyBtn.classList.contains("docs-material-button-checked");
        if (isChecked) return "Justify (Rata Kanan-Kiri)";
      }

      const leftBtn =
        document.getElementById("alignLeft") ||
        document.querySelector("[aria-label*='Rata kiri']") ||
        document.querySelector("[aria-label*='Align left']") ||
        document.querySelector("[aria-label*='Left align']");

      if (leftBtn) {
        const isChecked =
          leftBtn.getAttribute("aria-pressed") === "true" ||
          leftBtn.getAttribute("aria-checked") === "true" ||
          leftBtn.classList.contains("goog-toolbar-button-checked") ||
          leftBtn.classList.contains("docs-material-button-checked");
        if (isChecked) return "Align Left (Rata Kiri)";
      }

      // 2. Sample computed textAlign from paragraphs
      const paragraphs = document.querySelectorAll(".kix-paragraphrenderer, .kix-lineview");
      for (const p of paragraphs) {
        try {
          const align = window.getComputedStyle(p).textAlign;
          if (align === "justify") return "Justify (Rata Kanan-Kiri)";
          if (align === "left" || align === "start") return "Align Left (Rata Kiri)";
        } catch {}
      }

      return "Justify (Rata Kanan-Kiri)";
    },

    /**
     * Detect line spacing (1.5, Double 2.0, 1.15, Single 1.0).
     */
    detectLineSpacing() {
      // 1. Check toolbar line spacing button
      const spacingBtn =
        document.getElementById("lineSpacingMenuButton") ||
        document.querySelector("[aria-label*='Jarak antarbaris']") ||
        document.querySelector("[aria-label*='Line & paragraph spacing']") ||
        document.querySelector("[id*='lineSpacing']");

      if (spacingBtn) {
        const label = spacingBtn.getAttribute("aria-label") || spacingBtn.textContent || "";
        if (label.includes("1,5") || label.includes("1.5")) return "1.5 spasi";
        if (label.includes("Ganda") || label.includes("Double") || label.includes("2")) return "2.0 (Ganda / Double)";
        if (label.includes("1,15") || label.includes("1.15")) return "1.15 spasi";
        if (label.includes("Tunggal") || label.includes("Single") || label.includes("1,0")) return "1.0 (Tunggal)";
      }

      // 2. Sample computed lineHeight
      const textSpans = document.querySelectorAll(".kix-lineview-text-block span, .kix-paragraphrenderer");
      for (const span of textSpans) {
        try {
          const style = window.getComputedStyle(span);
          const lh = parseFloat(style.lineHeight);
          const fs = parseFloat(style.fontSize);
          if (lh > 0 && fs > 0) {
            const ratio = lh / fs;
            if (ratio >= 1.7) return "2.0 (Ganda / Double)";
            if (ratio >= 1.35) return "1.5 spasi";
            if (ratio >= 1.1) return "1.15 spasi";
            return "1.0 (Tunggal)";
          }
        } catch {}
      }

      return "1.5 spasi";
    },

    /**
     * Detect paragraph indentation style.
     */
    detectIndentStyle() {
      const paragraphs = document.querySelectorAll(".kix-paragraphrenderer, .kix-lineview");
      for (const p of paragraphs) {
        try {
          const style = window.getComputedStyle(p);
          const textIndent = parseFloat(style.textIndent) || 0;
          if (textIndent > 15) {
            return "Alinea Menjorok (First-line indent ~1.25 cm / 5 ketukan)";
          }
        } catch {}
      }

      // Fallback check on text content leading tabs/spaces
      const sample = this.sampleDocumentText(500);
      if (/^\s{4,8}\S/m.test(sample) || /^\t\S/m.test(sample)) {
        return "Alinea Menjorok (First-line indent ~1.25 cm / 5 ketukan)";
      }

      return "Blok Paragraf (Pemisah baris kosong)";
    },

    /**
     * Extract a representative text sample from rendered document nodes.
     */
    sampleDocumentText(maxLength = 2500) {
      const doc = this.extractFullDocument(maxLength);
      return doc.fullText || "";
    },

    /**
     * Analyze document content to determine writing register, tone, and heading conventions.
     */
    detectToneAndStructure(sampleText) {
      const text = sampleText || "";

      // Indonesian academic keywords
      const academicKeywords = [
        "bab", "latar belakang", "rumusan masalah", "tujuan penelitian",
        "kajian pustaka", "landasan teori", "tinjauan pustaka", "metode penelitian",
        "metodologi", "hasil dan pembahasan", "kesimpulan", "saran", "penelitian",
        "berdasarkan", "signifikan", "variabel", "analisis", "efektivitas", "hipotesis"
      ];

      // Corporate/business report keywords
      const businessKeywords = [
        "executive summary", "ringkasan eksekutif", "laporan kinerja", "target",
        "anggaran", "strategi", "rekomendasi", "proyek", "karyawan", "perusahaan", "kuartal"
      ];

      // English academic keywords
      const englishAcademic = [
        "abstract", "introduction", "methodology", "literature review",
        "results", "discussion", "conclusion", "framework", "hypothesis"
      ];

      const lower = text.toLowerCase();

      let academicHits = 0;
      for (const kw of academicKeywords) {
        if (lower.includes(kw)) academicHits++;
      }

      let businessHits = 0;
      for (const kw of businessKeywords) {
        if (lower.includes(kw)) businessHits++;
      }

      let englishHits = 0;
      for (const kw of englishAcademic) {
        if (lower.includes(kw)) englishHits++;
      }

      const hasRomanBab = /\bBAB\s+([IVXLCDM]+|[0-9]+)\b/i.test(text);
      const hasDecimalHeading = /^[0-9]+\.[0-9]+/m.test(text);

      if (englishHits >= 3) {
        return {
          writingStyle: "Academic Research Paper (Formal Academic English)",
          headingPattern: "Numbered Sections (1.0 Introduction, 2.0 Methodology)",
          genreTag: "Academic Paper"
        };
      }

      if (academicHits >= 2 || hasRomanBab) {
        return {
          writingStyle: "Karya Ilmiah / Skripsi Formal (PUEBI Baku, Bahasa Pasif Objektif)",
          headingPattern: hasRomanBab
            ? "Format BAB Romawi (BAB I) & Subbab Desimal (1.1, 1.2)"
            : "Format Subbab Desimal (1.1, 1.2, 1.3)",
          genreTag: "Skripsi Formal"
        };
      }

      if (businessHits >= 2) {
        return {
          writingStyle: "Laporan Bisnis / Korporat (Profesional, Ringkas, Solutif)",
          headingPattern: "Poin-poin Utama & Subjudul Terarah",
          genreTag: "Laporan Bisnis"
        };
      }

      return {
        writingStyle: "Dokumen Formal Standar (Bahasa Indonesia Baku & PUEBI)",
        headingPattern: hasDecimalHeading ? "Subbab Desimal (1.1, 1.2)" : "Judul dan Subjudul Berjenjang",
        genreTag: "Dokumen Formal"
      };
    },

    /**
     * Master function: Learn the page's complete typography, layout, and style profile.
     */
    learnPage() {
      const fontFamily = this.detectFontFamily();
      const fontSize = this.detectFontSize();
      const { margins, pageSize, isSkripsiMargin } = this.detectMarginsAndPage();
      const alignment = this.detectAlignment();
      const lineSpacing = this.detectLineSpacing();
      const indentStyle = this.detectIndentStyle();
      const docInfo = this.extractFullDocument(50000);
      const { writingStyle, headingPattern, genreTag } = this.detectToneAndStructure(docInfo.fullText);

      // Create human-friendly badge summary for UI
      const cleanAlign = alignment.includes("Justify") ? "Justify" : "Rata Kiri";
      const cleanSpacing = lineSpacing.split(" ")[0];
      const badgeText = `${fontFamily} ${fontSize} • Spasi ${cleanSpacing} • ${cleanAlign} • ${genreTag}`;

      const profile = {
        docTitle: docInfo.docTitle || "Dokumen Google Docs",
        fontFamily,
        fontSize,
        margins,
        pageSize,
        alignment,
        lineSpacing,
        indentStyle,
        writingStyle,
        headingPattern,
        genreTag,
        isSkripsiMargin,
        outline: docInfo.outline || [],
        lastHeading: docInfo.lastHeading || "",
        lastParagraphs: docInfo.lastParagraphs || [],
        lastParagraphText: docInfo.lastParagraphText || "",
        continuationHint: docInfo.continuationHint || "",
        wordCount: docInfo.wordCount || 0,
        paragraphCount: docInfo.paragraphCount || 0,
        charCount: docInfo.charCount || 0,
        fullText: docInfo.fullText || "",
        sampleExcerpt: docInfo.fullText ? docInfo.fullText.slice(0, 1500) : "",
        badgeText,
        timestamp: Date.now()
      };

      this.cachedProfile = profile;
      window.__gtypePageProfile = profile;
      return profile;
    },

    /**
     * Return cached profile or learn anew.
     */
    getProfile() {
      if (this.cachedProfile && Date.now() - this.cachedProfile.timestamp < 30000) {
        return this.cachedProfile;
      }
      return this.learnPage();
    }
  };

  window.PageLearner = PageLearner;
})();
