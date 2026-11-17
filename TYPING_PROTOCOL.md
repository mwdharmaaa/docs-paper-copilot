# Protokol Pengetikan & Format GTyipe (Google Docs Paper Copilot)

> [!CAUTION]
> **ATURAN MUTLAK / LOCKED PROTOCOL: JANGAN UBAH PROTOKOL INI PADA UPDATE APAPUN!**
> Berdasarkan instruksi tegas pemilik proyek:
> *"untuk selanjutnya jangan ubah protokolnya kalo update apapun, tapi ganti aja deh protokolnya jadi langsung selesai satu draf, biar sekali selesai langsung selesai semua"*
> *"dan tetepin juga protokol deffault kalau bikin paragraph baru tu harus ditab sekali pada awal kalimatnya. pokoknya rencana aku tu ngejadiin gtype ini bukan cuma ngetik aja, tapi ngerti format dan lain lain"*

---

## 1. Definisi Protokol Resmi: Langsung Selesai Satu Draf (Instant Whole Draft)
* **Perilaku Standar**: Sekali pengguna menekan tombol *"Ketik Otomatis ke Docs"*, *"Insert"*, atau menggunakan pembuat naskah inline (`Alt+G`), seluruh naskah/draf dokumen dimasukkan ke halaman kanvas Google Docs secara **instan dan langsung jadi (instant execution, 0 ms)** tanpa proses pengetikan per beberapa kata yang lambat.
* **Mekanisme Injeksi Instan (`insertChunk`)**: Setiap judul dan alinea paragraf dimasukkan ke dalam buffer Google Docs dalam satu payload penuh melalui rangkaian `beforeinput` payload, `execCommand("insertText")`, dan Simulated Paste DataTransfer. Seluruh kalimat dalam alinea muncul sekaligus dalam sekejap mata.
* **Proteksi Batas Halaman (Pagination Resilience)**: Sebelum memproses alinea baru, GTyipe memanggil `focusEditor()` dan memperbarui referensi node target aktif secara dinamis (`getEditorTarget()`), dengan jeda mikro-yield (0 ms) agar pembaruan layout dokumen terjadi secepat kilat.
* **Jeda Karakter (`charDelayMs`)**: **0 ms** (tidak ada pengetikan lambat per huruf/kata).
* **Jeda Antar-Paragraf (`paragraphDelayMs`)**: **0 ms** (langsung jadi seketika).
* **Penanganan Toolbar Ciut (Responsive Fallback)**: Saat toolbar Google Docs menciut karena pembagian layar dengan panel GTyipe, sistem secara otomatis mengakses tombol overflow *"Lainnya"* (`#moreButton` / `.docs-toolbar-more-bubble`) serta mengeksekusi pintasan keyboard dokumen (`Ctrl+Shift+J` untuk Justify, `Ctrl+Alt+1/0` untuk judul) sehingga format dokumen tetap 100% konsisten.

---

## 2. Protokol Indentasi Paragraf Baru (Wajib 1x Tab & Rata Kiri-Kanan)
* **Aturan Mutlak 1x Tab**: Setiap kali memulai atau membuat paragraf baru (alinea teks dokumen), **WAJIB di-TAB satu kali pada awal kalimat pertama** (menjorok ~1.27 cm / 0.5 inci).
* **Format Wajib Rata Kanan-Kiri (Justified)**: Seluruh alinea dokumen wajib berformat Rata Kanan-Kiri (menggunakan pintasan keyboard resmi `Ctrl + Shift + J` dan sinkronisasi tombol toolbar Google Docs).
* **Penegakan Visual 1x Tab**: `auto_typer.js` menginjeksikan sequence 7 non-breaking spaces (`\u00A0`) dan event Tab sehingga kanvas Google Docs dijamin menampilkan indentasi alinea secara nyata tanpa terhapus atau diciutkan.
* **Pengecualian Mutlak**: Baris Judul (Judul 1, Judul 2, Judul 3), Daftar Poin (`- ` atau `1. `), dan **Daftar Isi (Table of Contents)** DILARANG KERAS diberi indentasi Tab.

---

## 3. Standar Ukuran Font & Tipografi Resmi (Baku Skripsi)
* **Judul Utama Dokumen**: Ukuran **16 pt, BOLD, Center** (Huruf Kapital Semua).
* **Judul Bab / Bagian Utama** (`BAB 1` / `BAB I`, `DAFTAR ISI`, `DAFTAR PUSTAKA`, `KATA PENGANTAR`, dsb.): Ukuran **14 pt, BOLD, Center** (Huruf Kapital Semua).
* **Sub-judul Desimal** (`1.1`, `1.2`, `2.1`, dsb.): Ukuran **12 pt, BOLD, Left** (Title Case).
* **Sub-sub-judul** (`1.1.1`, `1.1.2`, dsb.): Ukuran **12 pt, BOLD, Left** (Title Case).
* **Seluruh Teks Isi Dokumen / Paragraf Normal**: Ukuran **12 pt, NORMAL (tidak bold)**, berformat **Rata Kanan-Kiri (Justify)**, dan wajib diawali **1x Tab** (~1.27 cm) per alinea baru.
* **Mekanisme Penyesuaian Font Google Docs (Stateful & Anti-Drift)**:
  * **Pencegahan Tabrakan Selector Zoom**: Selector font size secara ketat merujuk `#fontSizeInputElement` dan scoped container `#fontSizeSelect`, DILARANG KERAS menggunakan generic combobox selector (`input.goog-toolbar-combo-button-input`) yang menyebabkan tabrakan dengan dropdown zoom `100%`.
  * **Sistem State-Guarded Controller (`currentFontSize`)**: `AutoTyper` menyimpan state ukuran aktif di memori. Jika elemen berikutnya membutuhkan ukuran font yang sama (misal teks alinea isi 12 pt setelah sub-judul 12 pt), sistem langsung melakukan *no-op* (zero-action) tanpa memicu klik tombol atau event berulang, mencegah akumulasi font size yang melesat ke 19 pt / 20 pt.
  * **Auto-Kalibrasi Awal ke 12 pt (`calibrateTo12`)**: Pada awal setiap pengetikan draf naskah, sistem membaca ukuran font aktif dokumen dan langsung menyelaraskannya ke standar baku 12 pt menggunakan input langsung `#fontSizeInputElement` dan tombol stepper `#fontSizeDecrement`/`#fontSizeIncrement`.
  * **Isolasi Delta Ukuran Judul**: Judul Utama (16 pt) dan Judul Bab (14 pt) diubah secara presisi hanya untuk satu baris judul bersangkutan, lalu baris kosong berikutnya secara instan dikembalikan ke standar teks isi 12 pt, unbold, dan Justified.
  * **Pemisahan Judul & Teks (Wajib Baris Kosong Pemisah, Dilarang Menyatu)**:
    * Antara Judul Utama Dokumen dan Judul Bab (BAB 1) WAJIB dipisahkan oleh 1 baris kosong pemisah (double Enter). Judul utama dan judul bab TIDAK BOLEH MENYATU!
    * Antara Judul Bab (BAB 1) dan Sub-bab (1.1) WAJIB dipisahkan oleh 1 baris kosong pemisah (double Enter). Judul bab dan sub-bab TIDAK BOLEH MENYATU!
    * Antara Sub-bab (1.1) dan alinea teks isi dokumen WAJIB dipisahkan oleh 1 baris kosong pemisah (double Enter). Sub-bab dan alinea isi TIDAK BOLEH MENYATU!
    * Antara alinea teks sebelumnya dan judul baru berikutnya WAJIB dipisahkan oleh 1 baris kosong pemisah.
  * **Mekanisme Anti-Double-Toggle Bold**: `setBold` memeriksa status nyata toolbar terlebih dahulu dan mengeksekusi tepat satu aksi agar bold tidak membatalkan dirinya sendiri (on lalu off).

---

## 4. Protokol Daftar Isi (Bebas Tab & Rapi)
* **Dilarang Ngetab di Daftar Isi**: Baris daftar isi harus rata kiri (dengan penjorokan 2-4 spasi biasa hanya untuk sub-bab), tidak boleh menggunakan tab alinea.
* **Header Daftar Isi**: Ukuran **14 pt, BOLD**.
* **Baris Entri Daftar Isi**: Ukuran **12 pt, NORMAL**, menggunakan dot leaders (`..........`) yang sejajar rapi ke nomor halaman Romawi (`i, ii, iii`) untuk bagian awal dan Arab (`1, 2, 3`) untuk bagian isi.

---

## 5. Smart Cursor Navigator (Gerak-gerak Kursor & Target Perbaikan)
* **Navigasi Cerdas**: GTyipe mampu menggerakkan kursor layaknya manusia menyusun skripsi:
  * `moveToTop()`: Mengarahkan kursor ke bagian paling atas dokumen (`Ctrl + Home`).
  * `moveToBottom()`: Mengarahkan kursor ke bagian paling bawah dokumen (`Ctrl + End`).
  * `moveToSection(query)`: Mencari lokasi bab, sub-bab, atau cuplikan kalimat tertentu di outline atau kanvas editor Google Docs, melakukan scroll mulus, dan menempatkan caret editor tepat di lokasi perbaikan sebelum draf diketik.

---

## 6. Protokol Format Hierarki Judul (Headings) Google Docs
* **Pintasan Keyboard Google Docs**:
  * **Judul 1 (Heading 1)**: `Ctrl+Alt+1` (Digunakan untuk Judul Dokumen Utama, BAB 1/BAB I, DAFTAR ISI, DAFTAR PUSTAKA).
  * **Judul 2 (Heading 2)**: `Ctrl+Alt+2` (Digunakan untuk Sub-bab, contoh: 1.1 Latar Belakang).
  * **Judul 3 (Heading 3)**: `Ctrl+Alt+3` (Digunakan untuk Sub-subbab, contoh: 1.1.1 Identifikasi Isu).
  * **Judul 4 (Heading 4)**: `Ctrl+Alt+4` (Digunakan untuk poin abjad: a. Faktor Lingkungan).
  * **Teks Normal (Normal Text)**: `Ctrl+Alt+0` (Otomatis dikembalikan setelah baris judul selesai).
* **Dukungan Tag**: Mendukung penanda eksplisit `[JUDUL_DOKUMEN]`, `[JUDUL_1]`, `[JUDUL_2]`, `[JUDUL_3]`, maupun deteksi pola otomatis BAB Romawi/Arab (`BAB 1`, `BAB I`) dan penomoran desimal akademik.

---

## 7. Penonaktifan Permanen Pop-up Ejaan Google Docs
* **Target Elemen**: `.docsSpellWizCheckupSurface`, `[class*="docsSpellWiz"]`, `[class*="SpellWiz"]`, dan dialog "Ejaan dan tata bahasa" (tombol Abaikan / Terima).
* **Metode Pemblokiran**:
  1. **CSS Hard-Suppression**: Menyembunyikan total melalui `display: none !important; opacity: 0 !important; pointer-events: none !important; position: fixed !important; top: -99999px !important;` (diinjeksi pada `document_start`).
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
