(function (global, factory) {
  const root = global.AtlasTranslate || (global.AtlasTranslate = {});
  const api = factory(root);
  root.translationEngine = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const REQUEST_SOURCE = "atlas-x-translate-request";
  const RESPONSE_SOURCE = "atlas-x-translate-response";
  const GESTURE_EVENT_NAME = "atlas-x-translate-gesture-request";

  function createBridgeClient() {
    let requestCounter = 0;
    const pending = new Map();

    window.addEventListener("message", function onMessage(event) {
      if (event.source !== window || !event.data || event.data.source !== RESPONSE_SOURCE) {
        return;
      }
      const entry = pending.get(event.data.requestId);
      if (!entry) {
        return;
      }
      if (event.data.kind === "progress") {
        if (typeof entry.onProgress === "function") {
          entry.onProgress(event.data);
        }
        return;
      }
      pending.delete(event.data.requestId);
      if (event.data.ok) {
        entry.resolve(event.data.result);
      } else {
        const message =
          event.data.error && event.data.error.message
            ? event.data.error.message
            : "Bridge request failed";
        entry.reject(new Error(message));
      }
    });

    return function request(action, payload, options) {
      const requestId = "req-" + Date.now() + "-" + (++requestCounter);
      return new Promise(function executor(resolve, reject) {
        const timeoutId = setTimeout(function onTimeout() {
          pending.delete(requestId);
          reject(
            new Error(
              "Atlas page bridge did not respond. If you just reloaded the extension, refresh the current X page and try again."
            )
          );
        }, (options && options.timeoutMs) || 20000);

        pending.set(requestId, {
          resolve: function wrappedResolve(value) {
            clearTimeout(timeoutId);
            resolve(value);
          },
          reject: function wrappedReject(error) {
            clearTimeout(timeoutId);
            reject(error);
          },
          onProgress: options && options.onProgress
        });

        window.postMessage(
          {
            source: REQUEST_SOURCE,
            requestId,
            action,
            payload: payload || {}
          },
          "*"
        );
      });
    };
  }

  class BuiltInTranslationEngine {
    constructor() {
      this.request = createBridgeClient();
      this.hasGesturePrime = false;
    }

    primeForUserGesture(sourceLanguage, targetLanguage) {
      this.hasGesturePrime = true;
      document.dispatchEvent(
        new CustomEvent(GESTURE_EVENT_NAME, {
          detail: {
            sourceLanguage,
            targetLanguage
          }
        })
      );
    }

    async getAvailability(sourceLanguage, targetLanguage) {
      return this.request("availability", {
        sourceLanguage,
        targetLanguage
      });
    }

    async detect(text, onProgress) {
      const result = await this.request(
        "detect",
        {
          text
        },
        {
          onProgress
        }
      );
      const candidates = Array.isArray(result.candidates) ? result.candidates : [];
      const best = candidates[0] || null;
      return {
        best,
        candidates
      };
    }

    async translate(text, sourceLanguage, targetLanguage, onProgress) {
      const result = await this.request(
        "translate",
        {
          text,
          sourceLanguage,
          targetLanguage
        },
        {
          onProgress
        }
      );
      return {
        text: result.translatedText,
        resolvedPair: result.resolvedPair
      };
    }
  }

  return {
    BuiltInTranslationEngine,
    GESTURE_EVENT_NAME
  };
});
