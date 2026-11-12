/**
 * Docs Paper Copilot - Background Service Worker
 * Manages side panel behavior and cross-context messaging.
 */

chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
      console.warn("Side panel behavior setup fallback:", err);
    });
  }
});

if (chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener(async (tab) => {
    if (tab && tab.id && chrome.sidePanel && chrome.sidePanel.open) {
      await chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }

  if (message.type === "PING") {
    sendResponse({ status: "PONG", version: "1.0.0" });
    return false;
  }

  if (message.type === "GET_ACTIVE_TAB") {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      sendResponse({ tab: tab || null });
    }).catch((err) => {
      sendResponse({ tab: null, error: err.message });
    });
    return true;
  }

  return false;
});
