# Docs Paper Copilot

AI-powered academic proofreading, PUEBI correction, and paraphrasing assistant for Google Docs. Built with Chrome Manifest V3 and accompanied by a native Google Apps Script companion.

## Features

- **PUEBI & Tata Bahasa**: Corrects typos, punctuation, capitalization, and standard Indonesian academic grammar.
- **Parafrase Akademik**: Elevates academic register using passive objective voice and cohesive transitional markers.
- **Reduksi Plagiarisme**: Restructures syntax and clauses deeply while preserving original research data.
- **Format Sitasi & Referensi**: Aligns in-text citations and bibliographies to APA 7th Edition or IEEE styles.
- **Visual Diff Viewer**: Interactive side-by-side colorized token comparison before applying revisions.
- **Direct Docs Bridge**: Replaces selected text directly in Google Docs or syncs via clipboard.
- **Dual Architecture**: Works as a Chrome Side Panel extension or as a native Google Apps Script Add-on.

## Project Structure

```text
docs-paper-copilot/
├── manifest.json              # Chrome Manifest V3 configuration
├── background.js              # Background service worker
├── icons/                     # Extension icons (16px, 48px, 128px)
├── src/
│   ├── content/
│   │   ├── docs_observer.js   # Document metadata & selection reader
│   │   └── docs_bridge.js     # Text replacement and notification toast
│   ├── core/
│   │   ├── ai_client.js       # Gemini and OpenAI API client
│   │   ├── prompt_templates.js# Academic prompts (PUEBI, Paraphrase, etc.)
│   │   └── storage_service.js # Persistent local configuration
│   └── sidepanel/
│       ├── sidepanel.html     # Side panel interface
│       ├── sidepanel.css      # Linear-grade neutral dark styling
│       ├── sidepanel.js       # UI event controller
│       ├── action_handlers.js # Coordination between Docs and AI
│       └── diff_viewer.js     # Visual text diff comparison
├── apps-script/
│   ├── Code.js                # DocumentApp native server-side controller
│   ├── Sidebar.html           # Native Docs Add-on sidebar UI
│   └── appsscript.json        # Apps Script OAuth manifest
├── runapp.sh                  # Single-enter dev runner (bash)
├── runapp.ps1                 # Single-enter dev runner (PowerShell)
├── test.sh                    # Automated integrity check (bash)
└── test.ps1                   # Automated integrity check (PowerShell)
```

## Quick Start (Chrome Extension)

1. Clone or navigate to the repository:
   ```bash
   cd space/project/tools/ext/docs-paper-copilot
   ```
2. Launch Chrome with the extension preloaded:
   - On Linux/macOS:
     ```bash
     bash runapp.sh
     ```
   - On Windows PowerShell:
     ```powershell
     .\runapp.ps1
     ```
3. Open any Google Docs document.
4. Open the extension Side Panel, enter your Gemini API Key in the **Pengaturan** tab, and start proofreading.

## Google Apps Script Companion (Native Setup)

If you prefer running directly from Google Docs without installing a Chrome extension:
1. Open Google Docs -> **Extensions** -> **Apps Script**.
2. Copy the contents of `apps-script/Code.js` and `apps-script/Sidebar.html` into your script project.
3. Reload Google Docs: a new menu named **Paper Copilot** will appear.

## Verification

Run the test suite to verify integrity:
```powershell
.\test.ps1
```
