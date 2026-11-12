/**
 * Docs Paper Copilot - Google Apps Script Companion
 * Direct document manipulation engine using native DocumentApp.
 */

function onOpen() {
  DocumentApp.getUi()
    .createMenu("Paper Copilot")
    .addItem("Buka Asisten AI", "showSidebar")
    .addToUi();
}

function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile("Sidebar")
    .setTitle("Docs Paper Copilot")
    .setWidth(320);
  DocumentApp.getUi().showSidebar(html);
}

function getActiveSelectionText() {
  var doc = DocumentApp.getActiveDocument();
  var selection = doc.getSelection();
  if (!selection) return "";

  var textParts = [];
  var elements = selection.getRangeElements();
  for (var i = 0; i < elements.length; i++) {
    var element = elements[i];
    if (element.getElement().editAsText) {
      var textEl = element.getElement().editAsText();
      if (element.isPartial()) {
        textParts.push(textEl.getText().substring(element.getStartOffset(), element.getEndOffsetInclusive() + 1));
      } else {
        textParts.push(textEl.getText());
      }
    }
  }
  return textParts.join("\n");
}

function replaceActiveSelection(newText) {
  var doc = DocumentApp.getActiveDocument();
  var selection = doc.getSelection();
  if (!selection) {
    throw new Error("Tidak ada seleksi aktif di dokumen.");
  }

  var elements = selection.getRangeElements();
  for (var i = 0; i < elements.length; i++) {
    var element = elements[i];
    if (element.getElement().editAsText) {
      var textEl = element.getElement().editAsText();
      if (i === 0) {
        if (element.isPartial()) {
          textEl.deleteText(element.getStartOffset(), element.getEndOffsetInclusive());
          textEl.insertText(element.getStartOffset(), newText);
        } else {
          textEl.setText(newText);
        }
      } else {
        if (element.isPartial()) {
          textEl.deleteText(element.getStartOffset(), element.getEndOffsetInclusive());
        } else {
          element.getElement().removeFromParent();
        }
      }
    }
  }
  return true;
}

function callGemini(promptText, apiKey, modelName) {
  var key = apiKey || PropertiesService.getUserProperties().getProperty("GEMINI_API_KEY");
  if (!key) throw new Error("API Key belum disetel.");
  var model = modelName || "gemini-2.5-flash";

  var url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + key;
  var payload = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: { temperature: 0.2 }
  };

  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var res = UrlFetchApp.fetch(url, options);
  var json = JSON.parse(res.getContentText());
  if (json.error) throw new Error(json.error.message);

  return json.candidates[0].content.parts[0].text;
}
