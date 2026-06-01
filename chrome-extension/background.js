// MV3 service worker — relays selected text from content script to popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "SELECTED_TEXT") {
    // Store selected text so popup can read it when it opens
    chrome.storage.session.set({ selectedText: message.text });
    sendResponse({ ok: true });
  }
});

// Context menu: right-click → "Translate with MeTranslate"
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "metranslate-selection",
    title: "Translate \"%s\" with MeTranslate",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "metranslate-selection" && info.selectionText) {
    chrome.storage.session.set({ selectedText: info.selectionText.trim() });
    // Open popup
    chrome.action.openPopup?.();
  }
});
