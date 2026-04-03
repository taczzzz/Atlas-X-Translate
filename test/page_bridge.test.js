const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

const PAGE_BRIDGE_PATH = require.resolve("../src/content/page_bridge.js");
const REQUEST_SOURCE = "atlas-x-translate-request";
const RESPONSE_SOURCE = "atlas-x-translate-response";

function loadPageBridgeEnvironment() {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    url: "https://x.com/example/status/123"
  });
  const responses = [];

  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.self = global;

  const originalPostMessage = dom.window.postMessage.bind(dom.window);
  dom.window.postMessage = (data, targetOrigin) => {
    if (data && data.source === RESPONSE_SOURCE) {
      responses.push(data);
      return;
    }
    return originalPostMessage(data, targetOrigin);
  };

  delete require.cache[PAGE_BRIDGE_PATH];
  require(PAGE_BRIDGE_PATH);

  return {
    dom,
    responses
  };
}

function cleanupPageBridgeEnvironment() {
  delete require.cache[PAGE_BRIDGE_PATH];
  delete global.window;
  delete global.document;
  delete global.navigator;
  delete global.self;
  delete global.LanguageDetector;
  delete global.Translator;
}

async function flushMicrotasks() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test("page bridge retries detector creation after initial failure", async () => {
  let createCalls = 0;
  global.LanguageDetector = {
    availability: async () => "available",
    create: async () => {
      createCalls += 1;
      if (createCalls === 1) {
        throw new Error("detector boot failed");
      }
      return {
        detect: async () => [
          {
            detectedLanguage: "en"
          }
        ]
      };
    }
  };
  global.Translator = {
    availability: async () => "available",
    create: async () => ({
      translate: async (text) => text
    })
  };

  const { dom, responses } = loadPageBridgeEnvironment();

  dom.window.dispatchEvent(
    new dom.window.MessageEvent("message", {
      source: dom.window,
      data: {
        source: REQUEST_SOURCE,
        requestId: "detect-1",
        action: "detect",
        payload: {
          text: "hello"
        }
      }
    })
  );
  await flushMicrotasks();

  dom.window.dispatchEvent(
    new dom.window.MessageEvent("message", {
      source: dom.window,
      data: {
        source: REQUEST_SOURCE,
        requestId: "detect-2",
        action: "detect",
        payload: {
          text: "hello"
        }
      }
    })
  );
  await flushMicrotasks();

  assert.equal(createCalls, 2);
  assert.equal(responses[0].requestId, "detect-1");
  assert.equal(responses[0].ok, false);
  assert.equal(responses[1].requestId, "detect-2");
  assert.equal(responses[1].ok, true);
  assert.equal(responses[1].result.candidates[0].detectedLanguage, "en");

  cleanupPageBridgeEnvironment();
});

test("page bridge retries translator creation after initial failure", async () => {
  let createCalls = 0;
  global.LanguageDetector = {
    availability: async () => "available",
    create: async () => ({
      detect: async () => [
        {
          detectedLanguage: "en"
        }
      ]
    })
  };
  global.Translator = {
    availability: async () => "available",
    create: async () => {
      createCalls += 1;
      if (createCalls === 1) {
        throw new Error("translator boot failed");
      }
      return {
        translate: async (text) => `zh:${text}`
      };
    }
  };

  const { dom, responses } = loadPageBridgeEnvironment();

  dom.window.dispatchEvent(
    new dom.window.MessageEvent("message", {
      source: dom.window,
      data: {
        source: REQUEST_SOURCE,
        requestId: "translate-1",
        action: "translate",
        payload: {
          text: "hello",
          sourceLanguage: "en",
          targetLanguage: "zh-Hans"
        }
      }
    })
  );
  await flushMicrotasks();

  dom.window.dispatchEvent(
    new dom.window.MessageEvent("message", {
      source: dom.window,
      data: {
        source: REQUEST_SOURCE,
        requestId: "translate-2",
        action: "translate",
        payload: {
          text: "hello",
          sourceLanguage: "en",
          targetLanguage: "zh-Hans"
        }
      }
    })
  );
  await flushMicrotasks();

  assert.equal(createCalls, 2);
  assert.equal(responses[0].requestId, "translate-1");
  assert.equal(responses[0].ok, false);
  assert.equal(responses[1].requestId, "translate-2");
  assert.equal(responses[1].ok, true);
  assert.equal(responses[1].result.translatedText, "zh:hello");

  cleanupPageBridgeEnvironment();
});
