(function (global, factory) {
  const root = global.AtlasTranslate || (global.AtlasTranslate = {});
  const api = factory(root);
  root.cacheStore = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const CACHE_PREFIX = "translationCache:";
  const CONTEXT_INVALIDATED_RE = /Extension context invalidated/i;

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

  function makeStorageKey(cacheKey) {
    return CACHE_PREFIX + cacheKey;
  }

  async function get(cacheKey) {
    const storage = getStorageArea();
    if (!storage) {
      return null;
    }
    const key = makeStorageKey(cacheKey);
    try {
      const result = await storage.get([key]);
      return result[key] || null;
    } catch (error) {
      if (isExtensionContextInvalidatedError(error)) {
        return null;
      }
      throw error;
    }
  }

  async function set(cacheKey, value) {
    const storage = getStorageArea();
    if (!storage) {
      return;
    }
    const key = makeStorageKey(cacheKey);
    try {
      await storage.set({
        [key]: {
          ...value,
          savedAt: Date.now()
        }
      });
    } catch (error) {
      if (!isExtensionContextInvalidatedError(error)) {
        throw error;
      }
    }
  }

  return {
    CACHE_PREFIX,
    get,
    isExtensionContextInvalidatedError,
    makeStorageKey,
    set
  };
});
