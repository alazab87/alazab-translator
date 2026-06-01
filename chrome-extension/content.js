// Listen for text selection on any page
// When user selects text and stops, send it to background service worker
let selectionTimer = null;

document.addEventListener("mouseup", () => {
  clearTimeout(selectionTimer);
  selectionTimer = setTimeout(() => {
    const selected = window.getSelection()?.toString().trim();
    if (selected && selected.length > 1 && selected.length < 2000) {
      chrome.runtime.sendMessage({ type: "SELECTED_TEXT", text: selected });
    }
  }, 300);
});

// Also handle keyboard selection (Shift+arrow, Ctrl+A etc.)
document.addEventListener("keyup", (e) => {
  if (e.shiftKey || e.key === "a" && (e.ctrlKey || e.metaKey)) {
    const selected = window.getSelection()?.toString().trim();
    if (selected && selected.length > 1 && selected.length < 2000) {
      chrome.runtime.sendMessage({ type: "SELECTED_TEXT", text: selected });
    }
  }
});
