# Protokol Pengetikan & Format GTyipe (Google Docs Paper Copilot)

> [!CAUTION]
> **ATURAN MUTLAK / LOCKED PROTOCOL: JANGAN UBAH PROTOKOL INI PADA UPDATE APAPUN!**
> Berdasarkan instruksi tegas pemilik proyek:
> *"untuk selanjutnya jangan ubah protokolnya kalo update apapun, tapi ganti aja deh protokolnya jadi langsung selesai satu draf, biar sekali selesai langsung selesai semua"*
> *"dan tetepin juga protokol deffault kalau bikin paragraph baru tu harus ditab sekali pada awal kalimatnya. pokoknya rencana aku tu ngejadiin gtype ini bukan cuma ngetik aja, tapi ngerti format dan lain lain"*

---

## 1. Definisi Protokol Resmi: Langsung Selesai Satu Draf (Instant Whole Draft)
* **Perilaku Standar**: Sekali pengguna menekan tombol *"Ketik Otomatis ke Docs"*, *"Insert"*, atau menggunakan pembuat naskah inline (`Alt+G`), seluruh naskah/draf dokumen dimasukkan ke halaman kanvas Google Docs secara **langsung dalam satu proses selesai (instant execution)**.
* **Jeda Karakter (`charDelayMs`)**: **0 ms** (tidak ada pengetikan lambat per huruf).
* **Jeda Antar-Paragraf (`paragraphDelayMs`)**: **0 ms** (tidak ada penundaan jeda buatan antar paragraf).
* **Mekanisme Pengetikan di Google Docs**:
  * Tetap mengirimkan rangkaian keyboard event lengkap (`keydown`, `keypress`, `beforeinput`, `input`, `keyup`) per karakter karena kanvas Google Docs mewajibkan event tersebut untuk menerima karakter teks tanpa merusak layout.
  * Referensi target editor (`target`) dan iframe (`docs-texteventtarget-iframe`) di-*cache* selama proses penulisan untuk menghilangkan overhead ribuan kali DOM query.
  * Micro-yield periodik (setiap ~120 karakter) dengan `setTimeout(0)` untuk menjaga UI browser tetap responsif dan memberi ruang pada mesin render kanvas Google Docs tanpa risiko kehilangan karakter (*anti-drop*).

---

## 2. Protokol Indentasi Paragraf Baru (Wajib 1x Tab)
* **Aturan Mutlak**: Setiap kali memulai atau membuat paragraf baru (alinea teks dokumen), **WAJIB di-TAB satu kali (`\t`) pada awal kalimat pertama**.
* **Pengecualian**: Baris Judul (Judul 1, Judul 2, Judul 3) dan Daftar Poin (`- ` atau `1. `) tidak diberikan Tab.
* **Penegakan Otomatis di Mesin**: `auto_typer.js` secara otomatis menyisipkan 1x Tab jika paragraf belum memiliki indentasi tab.

---

## 3. Protokol Format Hierarki Judul (Headings) Google Docs
* **Pintasan Keyboard Google Docs**:
  * **Judul 1 (Heading 1)**: `Ctrl+Alt+1` (Digunakan untuk Judul Dokumen Utama, BAB I, BAB II, DAFTAR ISI, DAFTAR PUSTAKA).
  * **Judul 2 (Heading 2)**: `Ctrl+Alt+2` (Digunakan untuk Sub-bab, contoh: 1.1 Latar Belakang).
  * **Judul 3 (Heading 3)**: `Ctrl+Alt+3` (Digunakan untuk Sub-subbab, contoh: 1.1.1 Identifikasi Isu).
  * **Judul 4 (Heading 4)**: `Ctrl+Alt+4` (Digunakan untuk poin abjad: a. Faktor Lingkungan).
  * **Teks Normal (Normal Text)**: `Ctrl+Alt+0` (Otomatis dikembalikan setelah baris judul selesai).
* **Dukungan Tag**: Mendukung penanda eksplisit `[JUDUL_1]`, `[JUDUL_2]`, `[JUDUL_3]`, maupun deteksi pola otomatis BAB Romawi dan penomoran desimal akademik.

---

## 4. Penonaktifan Permanen Pop-up Ejaan Google Docs
* **Target Elemen**: `.docsSpellWizCheckupSurface`, `[class*="docsSpellWiz"]`, `[class*="SpellWiz"]`, dan dialog "Ejaan dan tata bahasa" (tombol Abaikan / Terima).
* **Metode Pemblokiran**:
  1. **CSS Hard-Suppression**: Menyembunyikan total melalui `display: none !important; opacity: 0 !important; pointer-events: none !important; position: fixed !important; top: -99999px !important;`.
  2. **DOM MutationObserver Removal**: Observer aktif yang langsung menghapus node popup dari DOM begitu elemen tersebut terbentuk di halaman dokumen atau iframe.

---

## 5. Arsitektur Akademik Lengkap GTyipe
1. **Daftar Isi (Table of Contents)**: Penyusunan terstruktur dengan titik-titik pemimpin (*dot leaders* `..........`) sejajar ke nomor halaman di sisi kanan, membedakan halaman Romawi kecil (`i, ii, iii`) dan Arab (`1, 2, 3`).
2. **Penomoran Halaman (Page Numbering)**:
   - Bagian Awal: Romawi kecil di tengah bawah.
   - Bagian Isi: Angka Arab, posisi tengah bawah untuk halaman pertama setiap Bab baru, dan kanan atas untuk halaman lanjutan.
3. **Daftar Pustaka & Sitasi**: Format baku APA 7th Edition (alfabetis A-Z, tanpa nomor urut, format *hanging indent* dengan baris kedua menjorok 1x Tab).
4. **Tabel & Gambar**: Judul Tabel diletakkan di atas tabel, Judul Gambar diletakkan di bawah gambar bersumber data.

---

## 6. Komponen yang Terikat pada Protokol Ini
* [`src/content/auto_typer.js`](file:///home/user/space/project/tools/ext/docs-paper-copilot/src/content/auto_typer.js): Mesin eksekusi penulisan instan, indentasi 1x Tab, dan pemformatan Judul 1/2/3.
* [`src/content/docs_observer.js`](file:///home/user/space/project/tools/ext/docs-paper-copilot/src/content/docs_observer.js): Penekan permanen pop-up ejaan Google Docs.
* [`src/content/in_page_agent.css`](file:///home/user/space/project/tools/ext/docs-paper-copilot/src/content/in_page_agent.css): CSS suppression untuk pop-up ejaan.
* [`src/core/prompt_templates.js`](file:///home/user/space/project/tools/ext/docs-paper-copilot/src/core/prompt_templates.js): Direktif pemikiran arsitek dokumen akademik senior.
* [`src/sidepanel/gemini_card.js`](file:///home/user/space/project/tools/ext/docs-paper-copilot/src/sidepanel/gemini_card.js): Tombol aksi format cepat (*Format Judul*, *Daftar Isi*, *Daftar Pustaka*).
