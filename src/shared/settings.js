(function (global, factory) {
  const root = global.AtlasTranslate || (global.AtlasTranslate = {});
  const api = factory(root);
  root.settings = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const SETTINGS_KEY = "settings";
  const CONTEXT_INVALIDATED_RE = /Extension context invalidated/i;
  const DEFAULT_SETTINGS = Object.freeze({
    targetLanguage: "zh-Hans",
    inlineMode: "manual",
    selectionEnabled: true
  });

  function getStorageArea() {
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local
    ) {
      return chrome.storage.local;
    }
    return null;
  }

  function isExtensionContextInvalidatedError(error) {
    return CONTEXT_INVALIDATED_RE.test(
      (error && error.message) || String(error || "")
    );
  }

  function mergeSettings(input) {
    return {
      targetLanguage:
        input && typeof input.targetLanguage === "string"
          ? input.targetLanguage
          : DEFAULT_SETTINGS.targetLanguage,
      inlineMode:
        input && input.inlineMode === "auto" ? "auto" : DEFAULT_SETTINGS.inlineMode,
      selectionEnabled:
        input && typeof input.selectionEnabled === "boolean"
          ? input.selectionEnabled
          : DEFAULT_SETTINGS.selectionEnabled
    };
  }

  async function getSettings() {
    const storage = getStorageArea();
    if (!storage) {
      return mergeSettings();
    }
    try {
      const values = await storage.get([SETTINGS_KEY]);
      return mergeSettings(values[SETTINGS_KEY]);
    } catch (error) {
      if (isExtensionContextInvalidatedError(error)) {
        return mergeSettings();
      }
      throw error;
    }
  }

  async function saveSettings(patch) {
    const storage = getStorageArea();
    if (!storage) {
      return mergeSettings(patch);
    }
    try {
      const next = mergeSettings({
        ...(await getSettings()),
        ...(patch || {})
      });
      await storage.set({
        [SETTINGS_KEY]: next
      });
      return next;
    } catch (error) {
      if (isExtensionContextInvalidatedError(error)) {
        return mergeSettings(patch);
      }
      throw error;
    }
  }

  function listen(listener) {
    if (
      typeof chrome === "undefined" ||
      !chrome.storage ||
      !chrome.storage.onChanged
    ) {
      return function noop() {};
    }
    const wrapped = function wrapped(changes, areaName) {
      if (areaName !== "local" || !changes[SETTINGS_KEY]) {
        return;
      }
      listener(mergeSettings(changes[SETTINGS_KEY].newValue || {}));
    };
    try {
      chrome.storage.onChanged.addListener(wrapped);
    } catch (error) {
      return function noop() {};
    }
    return function unsubscribe() {
      try {
        chrome.storage.onChanged.removeListener(wrapped);
      } catch (error) {
        if (!isExtensionContextInvalidatedError(error)) {
          throw error;
        }
      }
    };
  }

  return {
    DEFAULT_SETTINGS,
    SETTINGS_KEY,
    getSettings,
    isExtensionContextInvalidatedError,
    listen,
    mergeSettings,
    saveSettings
  };
});
