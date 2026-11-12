# Ask Gemini for Google Docs (with Auto-Type)

AI assistant modeled after the official Google Workspace **Ask Gemini** & **Help me write** in Google Docs, enhanced with **real-time autonomous typing** into the document. Built with Chrome Manifest V3.

## Key Features

- **Ask Gemini Conversational Side Panel**: Ask questions about your active document, draft new sections, summarize findings, or polish prose.
- **Autonomous Auto-Typing to Docs**: Rather than just dumping text, Gemini types directly into your Google Docs editor canvas in real-time (*typewriter streaming*).
- **In-Page "Help Me Write" Pill (`Alt+G`)**: A floating Gemini sparkle pill on Google Docs that pops up an inline prompt bar to generate drafts at your cursor.
- **Doc Context Awareness**: Automatically reads the document title and current user selection to tailor answers.
- **Instant Refine Actions**: Refine any generated response with single-click actions: *Persingkat*, *Perluas*, *Lebih Formal*, *Jadikan Poin*, and *Koreksi PUEBI*.
- **Direct Insertion & Clipboard Sync**: Choose between *Ketik Otomatis* (live streaming), *Insert Langsung* (instant overwrite), or *Salin*.

## Project Structure

```text
docs-paper-copilot/
├── manifest.json              # Chrome Manifest V3 configuration
├── background.js              # Background service worker (ES module)
├── icons/                     # Extension icons (16px, 48px, 128px)
├── src/
│   ├── content/
│   │   ├── auto_typer.js      # Streaming typewriter simulation for Google Docs
│   │   ├── docs_observer.js   # Document metadata & selection reader
│   │   ├── docs_bridge.js     # Text injection and toast notification bridge
│   │   ├── in_page_agent.js   # In-page "Help me write" floating modal
│   │   └── in_page_agent.css  # Google Workspace Material dark styling
│   ├── core/
│   │   ├── ai_client.js       # Google Gemini & OpenAI API integration
│   │   ├── prompt_templates.js# Gemini system directives and refine prompts
│   │   └── storage_service.js # Persistent local storage for keys & settings
│   └── sidepanel/
│       ├── sidepanel.html     # Ask Gemini side panel interface
│       ├── sidepanel.css      # Material dark theme stylesheet
│       ├── sidepanel.js       # Conversation flow & event controller
│       ├── gemini_card.js     # Response card component with action toolbar
│       ├── action_handlers.js # Coordination between Docs, worker, and AI
│       └── diff_viewer.js     # Text comparison visualizer
├── apps-script/
│   ├── Code.js                # DocumentApp companion controller
│   ├── Sidebar.html           # Native Docs Add-on sidebar UI
│   └── appsscript.json        # Apps Script OAuth manifest
├── runapp.sh                  # Single-enter dev runner (bash)
├── runapp.ps1                 # Single-enter dev runner (PowerShell)
├── test.sh                    # Automated integrity check (bash)
└── test.ps1                   # Automated integrity check (PowerShell)
```

## Quick Start (Chrome Extension)

1. Navigate to the repository:
   ```powershell
   cd C:\Users\someo\space\project\tools\ext\docs-paper-copilot
   ```
2. Launch Chrome with the extension preloaded:
   - On Windows PowerShell:
     ```powershell
     .\runapp.ps1
     ```
   - On Linux/macOS:
     ```bash
     bash runapp.sh
     ```
3. Open any Google Docs document.
4. Open the side panel or press `Alt+G` in Google Docs, enter your Gemini API Key in **Pengaturan**, and start prompting.
