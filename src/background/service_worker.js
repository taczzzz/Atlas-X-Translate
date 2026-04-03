const SETTINGS_KEY = "settings";
const DEFAULT_SETTINGS = {
  targetLanguage: "zh-Hans",
  inlineMode: "manual",
  selectionEnabled: true
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get([SETTINGS_KEY]);
  if (!current[SETTINGS_KEY]) {
    await chrome.storage.local.set({
      [SETTINGS_KEY]: DEFAULT_SETTINGS
    });
  }
});

