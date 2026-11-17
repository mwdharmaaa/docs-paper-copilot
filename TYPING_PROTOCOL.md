# Protokol Pengetikan GTyipe (Google Docs Paper Copilot)

> [!CAUTION]
> **ATURAN MUTLAK / LOCKED PROTOCOL: JANGAN UBAH PROTOKOL INI PADA UPDATE APAPUN!**
> Berdasarkan instruksi tegas pemilik proyek:
> *"untuk selanjutnya jangan ubah protokolnya kalo update apapun, tapi ganti aja deh protokolnya jadi langsung selesai satu draf, biar sekali selesai langsung selesai semua"*

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

## 2. Riwayat Evolusi Protokol Pengetikan
1. **Fase 1: Animasi Ketik Huruf per Huruf (Deprecated / Ditinggalkan)**:
   * Menggunakan jeda 6ms–20ms per huruf.
   * Masalah: Sangat lambat untuk dokumen akademik/skripsi panjang (3.000+ kata) dan pernah mengalami bug hanya menekan enter-enter kosong jika event keypress terganggu.
2. **Fase 2: Pengetikan per Paragraf (Commit `51838ff` - Deprecated)**:
   * Mengetik blok per alinea dengan jeda antar-paragraf ~240ms–350ms.
3. **Fase 3: Langsung Selesai Satu Draf (Commit Terkini - RESMI & DIKUNCI)**:
   * Seluruh draf selesai seketika dalam satu kali eksekusi, efisien, mulus, dan bebas lag.

---

## 3. Komponen yang Terikat pada Protokol Ini
* [`src/content/auto_typer.js`](file:///home/user/space/project/tools/ext/docs-paper-copilot/src/content/auto_typer.js):
  * `typeDraft(rawText, options)` sebagai mesin utama penulisan instan.
  * `instantInsert`, `typeParagraphs`, dan `typeStream` default ke 0ms delay.
* [`src/content/in_page_agent.js`](file:///home/user/space/project/tools/ext/docs-paper-copilot/src/content/in_page_agent.js):
  * `startTypingToDocs()` langsung mengeksekusi `AutoTyper.typeDraft()`.
* [`src/content/docs_bridge.js`](file:///home/user/space/project/tools/ext/docs-paper-copilot/src/content/docs_bridge.js):
  * Handler `AUTO_TYPE_REVISION` langsung mengeksekusi `AutoTyper.typeDraft()`.
* [`src/sidepanel/gemini_card.js`](file:///home/user/space/project/tools/ext/docs-paper-copilot/src/sidepanel/gemini_card.js):
  * Tombol *"Ketik Otomatis ke Docs"* mengeksekusi dengan `speed = 0`.
* [`src/sidepanel/sidepanel.html`](file:///home/user/space/project/tools/ext/docs-paper-copilot/src/sidepanel/sidepanel.html) & [`src/sidepanel/sidepanel.js`](file:///home/user/space/project/tools/ext/docs-paper-copilot/src/sidepanel/sidepanel.js):
  * Opsi kecepatan ngetik default ke *"Langsung Selesai Satu Draf (Default)"* (`value="0"`).
