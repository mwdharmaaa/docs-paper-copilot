/**
 * Docs Paper Copilot - Academic Prompt Templates
 * Standardized system instructions for academic paper refinement.
 */

export const PromptTemplates = {
  puebi: {
    id: "puebi",
    label: "PUEBI & Tata Bahasa",
    description: "Perbaiki ejaan, tanda baca, kapitalisasi, dan kebakuan kata bahasa Indonesia.",
    buildPrompt(text, customInstruction) {
      const extra = customInstruction ? `\nInstruksi khusus tambahan:\n- ${customInstruction.trim()}\n` : "";
      return `Kamu adalah editor bahasa dan reviewer ahli karya tulis ilmiah Indonesia.
Tugas: Perbaiki teks berikut agar sepenuhnya mematuhi Pedoman Umum Ejaan Bahasa Indonesia (PUEBI) dan tata bahasa baku ilmiah.
Aturan:
1. Perbaiki salah ketik (typo), tanda baca, huruf kapital, dan partikel (di-, ke-, -lah, -pun).
2. Pertahankan makna orisinal dan terminologi ilmiah spesifik.
3. Berikan HANYA teks akhir hasil perbaikan tanpa kata pengantar atau penutup.${extra}

Teks sumber:
${text}`;
    }
  },

  paraphrase: {
    id: "paraphrase",
    label: "Parafrase Akademik",
    description: "Tingkatkan objektivitas, kosakata baku ilmiah, dan struktur kalimat formal.",
    buildPrompt(text, customInstruction) {
      const extra = customInstruction ? `\nInstruksi khusus tambahan:\n- ${customInstruction.trim()}\n` : "";
      return `Kamu adalah editor jurnal ilmiah bereputasi tinggi.
Tugas: Parafrase teks berikut menggunakan register bahasa akademis tingkat tinggi.
Aturan:
1. Gunakan gaya kalimat pasif objektif akademis (misal: "data dianalisis" bukan "kita menganalisis").
2. Gunakan kata penghubung antarkalimat yang kohesif (e.g., selain itu, lebih lanjut, oleh karena itu).
3. Hindari bahasa percakapan, redundansi kata, atau emosi subjektif.
4. Berikan HANYA teks akhir hasil revisi.${extra}

Teks sumber:
${text}`;
    }
  },

  plagiarism: {
    id: "plagiarism",
    label: "Reduksi Plagiarisme",
    description: "Ubah struktur kalimat secara mendalam tanpa mengubah esensi temuan/argumen.",
    buildPrompt(text, customInstruction) {
      const extra = customInstruction ? `\nInstruksi khusus tambahan:\n- ${customInstruction.trim()}\n` : "";
      return `Kamu adalah spesialis penulisan ulang karya tulis ilmiah.
Tugas: Tulis ulang teks berikut secara radikal untuk menurunkan tingkat kesamaan (similarity score/turnitin).
Aturan:
1. Ubah susunan klausa, urutan informasi, dan struktur sintaksis secara menyeluruh.
2. Gunakan sinonim ilmiah kontekstual yang tepat.
3. Esensi data, argumen, dan fakta ilmiah wajib tetap 100% akurat.
4. Berikan HANYA teks hasil penulisan ulang.${extra}

Teks sumber:
${text}`;
    }
  },

  citation: {
    id: "citation",
    label: "Format Sitasi & Referensi",
    description: "Standardisasi sitasi dalam teks (in-text citation) ke gaya APA 7th atau IEEE.",
    buildPrompt(text, customInstruction) {
      const extra = customInstruction ? `\nInstruksi khusus tambahan:\n- ${customInstruction.trim()}\n` : "";
      return `Kamu adalah ahli bibliografi dan gaya selingkung publikasi ilmiah.
Tugas: Standardisasi format sitasi dan daftar referensi pada teks berikut sesuai kaidah APA 7th Edition (atau pertahankan IEEE jika berupa angka kurung siku).
Aturan:
1. Pastikan nama penulis, tahun, dan tanda baca sitasi akurat.
2. Susun referensi dengan urutan alfabetis dan format hanging indent jika berupa daftar pustaka.
3. Berikan HANYA teks hasil pemformatan.${extra}

Teks sumber:
${text}`;
    }
  },

  custom: {
    id: "custom",
    label: "Prompt Bebas / Interaktif",
    description: "Ngeprompt bebas sesuai instruksi kustom spesifik yang kamu ketik.",
    buildPrompt(text, customInstruction) {
      const instruction = customInstruction && customInstruction.trim().length > 0
        ? customInstruction.trim()
        : "Perbaiki dan tingkatkan kualitas penyampaian akademis teks ini.";
      return `Kamu adalah asisten AI ahli penulisan akademik dan riset ilmiah.
Tugas: Proses dan transformasikan teks berikut sesuai instruksi interaktif pengguna.

Instruksi Pengguna:
"${instruction}"

Aturan:
1. Jalankan instruksi pengguna secara presisi, cerdas, dan kontekstual.
2. Pertahankan kebenaran esensi data dan fakta ilmiah dalam teks.
3. Berikan HANYA teks akhir hasil pemrosesan tanpa salam pembuka atau penjelasan penutup.

Teks sumber:
${text}`;
    }
  },

  abstract: {
    id: "abstract",
    label: "Generator Abstrak",
    description: "Sintesis abstrak ringkas mencakup latar belakang, metode, hasil, dan kesimpulan.",
    buildPrompt(text) {
      return `Kamu adalah editor publikasi internasional.
Tugas: Susun sebuah Abstrak Terstruktur (Structured Abstract) maksimal 250 kata berdasarkan materi berikut.
Aturan:
1. Cakup empat elemen: Latar Belakang & Tujuan, Metode Penelitian, Temuan/Hasil Utama, dan Kesimpulan.
2. Tambahkan 3-5 kata kunci (Keywords).
3. Berikan versi Bahasa Indonesia diikuti versi Bahasa Inggris.
4. Langsung tampilkan teks abstrak tanpa basa-basi pengantar.

Materi teks:
${text}`;
    }
  }
};
