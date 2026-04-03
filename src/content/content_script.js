(function (global) {
  const root = global.AtlasTranslate || (global.AtlasTranslate = {});
  const InlineTranslationController = root.inlineTranslator.InlineTranslationController;
  const SelectionTranslationController = root.selectionTranslator.SelectionTranslationController;
  const BuiltInTranslationEngine = root.translationEngine.BuiltInTranslationEngine;
  const postResolver = root.postResolver;
  const settingsApi = root.settings;
  const utils = root.utils;

  if (!root.inlineTranslator || !root.selectionTranslator || !root.translationEngine) {
    return;
  }

  const engine = new BuiltInTranslationEngine();
  let settings = settingsApi.DEFAULT_SETTINGS;
  let currentContext = null;
  let inlineController = null;
  let selectionController = null;
  let lastLocationKey = "";
  let lastScanSignature = "";
  let scanTimer = null;

  function isStatusPage() {
    return Boolean(utils.parseStatusPathname(window.location.pathname));
  }

  function createControllers() {
    if (!inlineController) {
      inlineController = new InlineTranslationController(engine, settings);
    }
    if (!selectionController) {
      selectionController = new SelectionTranslationController(engine, settings);
    }
  }

  function destroyControllers() {
    if (inlineController) {
      inlineController.destroy();
      inlineController = null;
    }
    if (selectionController) {
      selectionController.destroy();
      selectionController = null;
    }
    currentContext = null;
  }

  function attachControllers(context) {
    createControllers();
    if (inlineController) {
      inlineController.updateContext(context);
    }
    if (selectionController) {
      selectionController.updateContext(context, settings);
    }
    currentContext = context;
  }

  function refreshControllers() {
    if (!isStatusPage()) {
      destroyControllers();
      return;
    }

    const context = postResolver.resolveMainPost(document, window.location);
    if (!context) {
      if (selectionController) {
        selectionController.updateContext(null, settings);
      }
      return;
    }

    const signature = [
      context.tweetId,
      context.article ? context.article.getAttribute("data-testid") || "article" : "none"
    ].join(":");
    if (signature === lastScanSignature && currentContext && currentContext.textRoot === context.textRoot) {
      if (inlineController) {
        inlineController.updateSettings(settings);
      }
      if (selectionController) {
        selectionController.updateContext(context, settings);
      }
      return;
    }

    lastScanSignature = signature;
    attachControllers(context);
  }

  function scheduleRefresh() {
    if (scanTimer) {
      clearTimeout(scanTimer);
    }
    scanTimer = setTimeout(() => {
      scanTimer = null;
      refreshControllers();
    }, 120);
  }

  function bootObservers() {
    const observer = new MutationObserver(() => {
      const locationKey = window.location.pathname + window.location.search;
      if (locationKey !== lastLocationKey) {
        lastLocationKey = locationKey;
        lastScanSignature = "";
      }
      scheduleRefresh();
    });

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    window.addEventListener("popstate", scheduleRefresh);
    setInterval(() => {
      const locationKey = window.location.pathname + window.location.search;
      if (locationKey !== lastLocationKey) {
        lastLocationKey = locationKey;
        lastScanSignature = "";
        scheduleRefresh();
      }
    }, 1000);
  }

  async function init() {
    try {
      settings = await settingsApi.getSettings();
    } catch (error) {
      settings = settingsApi.DEFAULT_SETTINGS;
      console.warn("[Atlas X Translate] failed to read settings, using defaults", error);
    }
    lastLocationKey = window.location.pathname + window.location.search;
    scheduleRefresh();
    bootObservers();
    try {
      settingsApi.listen((nextSettings) => {
        settings = nextSettings;
        if (inlineController) {
          inlineController.updateSettings(nextSettings);
        }
        if (selectionController) {
          selectionController.updateContext(currentContext, nextSettings);
        }
        scheduleRefresh();
      });
    } catch (error) {
      console.warn("[Atlas X Translate] failed to subscribe to settings changes", error);
    }
  }

  init().catch((error) => {
    console.error("[Atlas X Translate] init failed", error);
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
