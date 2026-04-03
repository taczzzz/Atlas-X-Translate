(function () {
  const REQUEST_SOURCE = "atlas-x-translate-request";
  const RESPONSE_SOURCE = "atlas-x-translate-response";
  const GESTURE_EVENT_NAME = "atlas-x-translate-gesture-request";
  const sessions = {
    detector: null,
    translators: new Map()
  };

  function serializeError(error) {
    if (!error) {
      return {
        message: "Unknown error"
      };
    }
    return {
      message: error.message || String(error),
      name: error.name || "Error"
    };
  }

  function postResponse(payload) {
    window.postMessage(
      {
        source: RESPONSE_SOURCE,
        ...payload
      },
      "*"
    );
  }

  function buildMonitor(requestId, stage) {
    return function monitor(monitorTarget) {
      monitorTarget.addEventListener("downloadprogress", function onProgress(event) {
        postResponse({
          kind: "progress",
          requestId,
          stage,
          loaded: event.loaded
        });
      });
    };
  }

  function getLanguageCandidates(tag) {
    if (!tag) {
      return [];
    }
    const normalized = String(tag).trim();
    const primary = normalized.split("-")[0];
    if (normalized === "zh-Hans" || normalized === "zh-Hant") {
      return Array.from(new Set([normalized, "zh"]));
    }
    return Array.from(new Set([normalized, primary]));
  }

  async function resolveTranslatorAvailability(sourceLanguage, targetLanguage) {
    if (!("Translator" in self)) {
      return {
        state: "unsupported"
      };
    }
    for (const sourceCandidate of getLanguageCandidates(sourceLanguage)) {
      for (const targetCandidate of getLanguageCandidates(targetLanguage)) {
        const state = await Translator.availability({
          sourceLanguage: sourceCandidate,
          targetLanguage: targetCandidate
        });
        if (state !== "unavailable") {
          return {
            state,
            sourceLanguage: sourceCandidate,
            targetLanguage: targetCandidate
          };
        }
      }
    }
    return {
      state: "unavailable"
    };
  }

  async function getDetector(requestId) {
    if (!("LanguageDetector" in self)) {
      throw new Error("LanguageDetector API is not available in this Atlas runtime.");
    }
    if (!sessions.detector) {
      sessions.detector = createDetectorSession(requestId);
    }
    return sessions.detector;
  }

  function primeDetector(requestId) {
    if (!("LanguageDetector" in self) || sessions.detector) {
      return;
    }
    sessions.detector = createDetectorSession(requestId || "gesture-prime");
  }

  function primeTranslator(requestId, sourceLanguage, targetLanguage) {
    if (!("Translator" in self)) {
      return;
    }
    const sourceCandidate = getLanguageCandidates(sourceLanguage)[0];
    const targetCandidate = getLanguageCandidates(targetLanguage)[0];
    if (!sourceCandidate || !targetCandidate) {
      return;
    }
    const cacheKey = [sourceCandidate, targetCandidate].join("->");
    ensureTranslatorSession(
      cacheKey,
      requestId || "gesture-prime",
      sourceCandidate,
      targetCandidate
    );
  }

  async function getTranslator(requestId, sourceLanguage, targetLanguage) {
    if (!("Translator" in self)) {
      throw new Error("Translator API is not available in this Atlas runtime.");
    }
    const availability = await resolveTranslatorAvailability(
      sourceLanguage,
      targetLanguage
    );
    if (availability.state === "unsupported" || availability.state === "unavailable") {
      throw new Error("The requested language pair is unavailable on this device.");
    }
    const cacheKey = [availability.sourceLanguage, availability.targetLanguage].join("->");
    ensureTranslatorSession(
      cacheKey,
      requestId,
      availability.sourceLanguage,
      availability.targetLanguage
    );
    return {
      availability,
      translator: await sessions.translators.get(cacheKey)
    };
  }

  function createDetectorSession(requestId) {
    return LanguageDetector.create({
      monitor: buildMonitor(requestId, "detector")
    }).catch(function resetOnError(error) {
      sessions.detector = null;
      throw error;
    });
  }

  function ensureTranslatorSession(cacheKey, requestId, sourceLanguage, targetLanguage) {
    if (sessions.translators.has(cacheKey)) {
      return sessions.translators.get(cacheKey);
    }
    const session = Translator.create({
      sourceLanguage,
      targetLanguage,
      monitor: buildMonitor(requestId, "translator")
    }).catch(function resetOnError(error) {
      sessions.translators.delete(cacheKey);
      throw error;
    });
    sessions.translators.set(cacheKey, session);
    return session;
  }

  async function handleAvailability(requestId, payload) {
    const support = {
      hasTranslator: "Translator" in self,
      hasLanguageDetector: "LanguageDetector" in self
    };
    if (!support.hasTranslator || !support.hasLanguageDetector) {
      return {
        support,
        detector: "unsupported",
        translator: "unsupported"
      };
    }
    const [detector, translator] = await Promise.all([
      LanguageDetector.availability(),
      resolveTranslatorAvailability(payload.sourceLanguage || "en", payload.targetLanguage || "zh-Hans")
    ]);
    return {
      support,
      detector,
      translator: translator.state,
      resolvedPair:
        translator.sourceLanguage && translator.targetLanguage
          ? {
              sourceLanguage: translator.sourceLanguage,
              targetLanguage: translator.targetLanguage
            }
          : null
    };
  }

  async function handleDetect(requestId, payload) {
    const detector = await getDetector(requestId);
    const candidates = await detector.detect(payload.text);
    return {
      candidates
    };
  }

  async function handleTranslate(requestId, payload) {
    const session = await getTranslator(
      requestId,
      payload.sourceLanguage,
      payload.targetLanguage
    );
    const translatedText = await session.translator.translate(payload.text);
    return {
      translatedText,
      resolvedPair: {
        sourceLanguage: session.availability.sourceLanguage,
        targetLanguage: session.availability.targetLanguage
      }
    };
  }

  async function routeMessage(data) {
    if (data.action === "availability") {
      return handleAvailability(data.requestId, data.payload || {});
    }
    if (data.action === "detect") {
      return handleDetect(data.requestId, data.payload || {});
    }
    if (data.action === "translate") {
      return handleTranslate(data.requestId, data.payload || {});
    }
    throw new Error("Unknown bridge action: " + data.action);
  }

  window.addEventListener("message", function onMessage(event) {
    if (event.source !== window || !event.data || event.data.source !== REQUEST_SOURCE) {
      return;
    }

    routeMessage(event.data)
      .then(function onSuccess(result) {
        postResponse({
          kind: "result",
          requestId: event.data.requestId,
          ok: true,
          result
        });
      })
      .catch(function onError(error) {
        postResponse({
          kind: "result",
          requestId: event.data.requestId,
          ok: false,
          error: serializeError(error)
        });
      });
  });

  document.addEventListener(GESTURE_EVENT_NAME, function onGesturePrime(event) {
    const detail = (event && event.detail) || {};
    if (!navigator.userActivation || !navigator.userActivation.isActive) {
      return;
    }
    primeDetector("gesture-prime");
    primeTranslator(
      "gesture-prime",
      detail.sourceLanguage || "en",
      detail.targetLanguage || "zh-Hans"
    );
  });
})();
