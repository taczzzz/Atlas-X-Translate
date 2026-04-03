const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

test("BuiltInTranslationEngine request path works without browser global identifier", async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    url: "https://x.com/example/status/123"
  });

  global.window = dom.window;
  global.document = dom.window.document;
  global.AtlasTranslate = {};

  const { BuiltInTranslationEngine } = require("../src/content/translation_engine.js");
  const engine = new BuiltInTranslationEngine();

  const originalPostMessage = dom.window.postMessage.bind(dom.window);
  dom.window.postMessage = (data, targetOrigin) => {
    if (data && data.source === "atlas-x-translate-request") {
      queueMicrotask(() => {
        dom.window.dispatchEvent(
          new dom.window.MessageEvent("message", {
            source: dom.window,
            data: {
              source: "atlas-x-translate-response",
              kind: "result",
              requestId: data.requestId,
              ok: true,
              result: {
                support: {
                  hasTranslator: true,
                  hasLanguageDetector: true
                },
                detector: "available",
                translator: "available"
              }
            }
          })
        );
      });
      return;
    }
    return originalPostMessage(data, targetOrigin);
  };

  const result = await engine.getAvailability("en", "zh-Hans");
  assert.equal(result.translator, "available");

  delete global.window;
  delete global.document;
  delete global.AtlasTranslate;
});
