const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

test("primeForUserGesture dispatches a gesture event on document", async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`);
  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  global.AtlasTranslate = {};

  const {
    BuiltInTranslationEngine,
    GESTURE_EVENT_NAME
  } = require("../src/content/translation_engine.js");

  const engine = new BuiltInTranslationEngine();

  const detail = await new Promise((resolve) => {
    document.addEventListener(
      GESTURE_EVENT_NAME,
      (event) => {
        resolve(event.detail);
      },
      {
        once: true
      }
    );
    engine.primeForUserGesture("en", "zh-Hans");
  });

  assert.deepEqual(detail, {
    sourceLanguage: "en",
    targetLanguage: "zh-Hans"
  });

  delete global.window;
  delete global.document;
  delete global.CustomEvent;
  delete global.AtlasTranslate;
});
