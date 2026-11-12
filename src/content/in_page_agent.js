/**
 * Docs Paper Copilot - In-Page Autonomous Agent
 * Floating interface injecting direct interactive agent capabilities on Google Docs.
 */

(function initInPageAgent() {
  if (window.__docsPaperAgentInitialized) return;
  window.__docsPaperAgentInitialized = true;

  const root = document.createElement("div");
  root.id = "docs-paper-agent-root";
  root.innerHTML = `
    <div id="dpc-pill" class="dpc-floating-pill">
      <svg class="dpc-pill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
      <span class="dpc-pill-title">AI Docs Agent</span>
      <span class="dpc-pill-shortcut">Alt+K</span>
    </div>

    <div id="dpc-modal" class="dpc-agent-modal" style="display: none;">
      <div class="dpc-modal-header">
        <div class="dpc-header-title">
          <svg class="dpc-pill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          <span>Autonomous Page Agent</span>
        </div>
        <button id="dpc-close-btn" class="dpc-btn-close">&times;</button>
      </div>

      <textarea id="dpc-prompt" class="dpc-prompt-input" placeholder="Prompt AI: tulis bab baru, koreksi typo, kembangkan argumen, atau susun outline..."></textarea>

      <div class="dpc-chips-row">
        <button type="button" class="dpc-chip" data-cmd="Tulis kelanjutan paragraf ini secara ilmiah">Lanjutkan Teks</button>
        <button type="button" class="dpc-chip" data-cmd="Perbaiki ejaan, typo, dan tata bahasa PUEBI">Koreksi PUEBI</button>
        <button type="button" class="dpc-chip" data-cmd="Buat outline karya tulis terstruktur">Bikin Outline</button>
        <button type="button" class="dpc-chip" data-cmd="Parafrase kalimat menjadi pasif akademik">Parafrase Formal</button>
      </div>

      <div class="dpc-action-bar">
        <div id="dpc-status" class="dpc-status-tag">Siap ngetik ke dokumen.</div>
        <button id="dpc-stop-btn" class="dpc-btn-stop" style="display: none;">Hentikan</button>
        <button id="dpc-run-btn" class="dpc-btn-primary">
          <span>Ngetik Otomatis</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  const pill = document.getElementById("dpc-pill");
  const modal = document.getElementById("dpc-modal");
  const closeBtn = document.getElementById("dpc-close-btn");
  const promptInput = document.getElementById("dpc-prompt");
  const runBtn = document.getElementById("dpc-run-btn");
  const stopBtn = document.getElementById("dpc-stop-btn");
  const statusEl = document.getElementById("dpc-status");
  const chips = document.querySelectorAll(".dpc-chip");

  function toggleModal(show) {
    const isVisible = show !== undefined ? show : modal.style.display === "none";
    modal.style.display = isVisible ? "flex" : "none";
    if (isVisible) {
      setTimeout(() => promptInput.focus(), 50);
    }
  }

  pill.addEventListener("click", () => toggleModal());
  closeBtn.addEventListener("click", () => toggleModal(false));

  window.addEventListener("keydown", (e) => {
    if ((e.altKey && (e.key === "k" || e.key === "K")) || (e.ctrlKey && e.shiftKey && (e.key === "k" || e.key === "K"))) {
      e.preventDefault();
      toggleModal();
    }
  });

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      promptInput.value = chip.dataset.cmd;
      promptInput.focus();
    });
  });

  promptInput.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      runBtn.click();
    }
  });

  stopBtn.addEventListener("click", () => {
    AutoTyper.stop();
    statusEl.textContent = "Pengetikan dihentikan.";
    stopBtn.style.display = "none";
    runBtn.disabled = false;
  });

  runBtn.addEventListener("click", async () => {
    const promptText = promptInput.value.trim();
    if (!promptText) {
      statusEl.textContent = "Ketik instruksi prompt terlebih dahulu.";
      return;
    }

    runBtn.disabled = true;
    stopBtn.style.display = "inline-block";
    statusEl.innerHTML = '<span class="dpc-typing-indicator"></span> AI sedang berpikir...';

    // Get current selection or fallback
    const sel = window.getSelection()?.toString().trim() || "";

    chrome.runtime.sendMessage({
      type: "EXECUTE_AGENT_PROMPT",
      prompt: promptText,
      selectedContext: sel
    }, (response) => {
      if (chrome.runtime.lastError || !response || !response.success) {
        statusEl.textContent = `Error: ${response?.error || chrome.runtime.lastError?.message || "Gagal memproses"}`;
        runBtn.disabled = false;
        stopBtn.style.display = "none";
        return;
      }

      statusEl.innerHTML = '<span class="dpc-typing-indicator"></span> Ngetik otomatis ke page...';

      // Dispatches typewriter streaming directly into Google Docs editor
      AutoTyper.typeStream(response.text, {
        speedMs: 16,
        onProgress: (p) => {
          statusEl.textContent = `Ngetik ke page: ${p.percent}%`;
        },
        onComplete: () => {
          statusEl.textContent = "Selesai ngetik ke halaman.";
          runBtn.disabled = false;
          stopBtn.style.display = "none";
        },
        onCancel: () => {
          statusEl.textContent = "Pengetikan dibatalkan.";
          runBtn.disabled = false;
          stopBtn.style.display = "none";
        }
      });
    });
  });
})();
