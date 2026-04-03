const test = require("node:test");
const assert = require("node:assert/strict");

test("hydrateCachedTranslation preserves paragraph blocks", () => {
  global.AtlasTranslate = {
    cacheStore: {},
    postResolver: {},
    settings: {
      DEFAULT_SETTINGS: {
        targetLanguage: "zh-Hans",
        inlineMode: "manual",
        selectionEnabled: true
      }
    }
  };
  require("../src/shared/utils.js");

  const inlineTranslator = require("../src/content/inline_translator.js");
  const result = inlineTranslator.hydrateCachedTranslation({
    translationBlocks: ["第一段", "第二段"],
    translation: "第一段\n\n第二段"
  });

  assert.deepEqual(result, {
    translationBlocks: ["第一段", "第二段"]
  });

  delete global.AtlasTranslate;
});

test("hydrateCachedTranslation recovers legacy object blocks", () => {
  global.AtlasTranslate = {
    cacheStore: {},
    postResolver: {},
    settings: {
      DEFAULT_SETTINGS: {
        targetLanguage: "zh-Hans",
        inlineMode: "manual",
        selectionEnabled: true
      }
    }
  };
  require("../src/shared/utils.js");

  const inlineTranslator = require("../src/content/inline_translator.js");
  const result = inlineTranslator.hydrateCachedTranslation({
    translation: "[object Object]\n\n[object Object]",
    translationBlocks: [
      { text: "第一段" },
      { text: "第二段" }
    ]
  });

  assert.deepEqual(result, {
    translationBlocks: ["第一段", "第二段"]
  });

  delete global.AtlasTranslate;
});

test("hydrateCachedTranslation applies terminology overrides", () => {
  global.AtlasTranslate = {
    cacheStore: {},
    postResolver: {},
    settings: {
      DEFAULT_SETTINGS: {
        targetLanguage: "zh-Hans",
        inlineMode: "manual",
        selectionEnabled: true
      }
    }
  };
  require("../src/shared/utils.js");

  const inlineTranslator = require("../src/content/inline_translator.js");
  const result = inlineTranslator.hydrateCachedTranslation(
    {
      translation: "克劳德 欧泊斯\n书签"
    },
    "zh-Hans"
  );

  assert.deepEqual(result, {
    translationBlocks: ["Claude Opus", "收藏"]
  });

  delete global.AtlasTranslate;
});

test("translateTextBlocks keeps block order", async () => {
  global.AtlasTranslate = {
    cacheStore: {},
    postResolver: {},
    settings: {
      DEFAULT_SETTINGS: {
        targetLanguage: "zh-Hans",
        inlineMode: "manual",
        selectionEnabled: true
      }
    }
  };
  require("../src/shared/utils.js");

  const inlineTranslator = require("../src/content/inline_translator.js");
  const translated = await inlineTranslator.translateTextBlocks(
    ["First block", "Second block"],
    async (text) => `[${text}]`
  );

  assert.deepEqual(translated, ["[First block]", "[Second block]"]);

  delete global.AtlasTranslate;
});

test("translateTextBlocks unwraps translation result objects", async () => {
  global.AtlasTranslate = {
    cacheStore: {},
    postResolver: {},
    settings: {
      DEFAULT_SETTINGS: {
        targetLanguage: "zh-Hans",
        inlineMode: "manual",
        selectionEnabled: true
      }
    }
  };
  require("../src/shared/utils.js");

  const inlineTranslator = require("../src/content/inline_translator.js");
  const translated = await inlineTranslator.translateTextBlocks(
    ["First block", "Second block"],
    async (text) => ({
      text: `[${text}]`,
      resolvedPair: {
        sourceLanguage: "en",
        targetLanguage: "zh-Hans"
      }
    })
  );

  assert.deepEqual(translated, ["[First block]", "[Second block]"]);

  delete global.AtlasTranslate;
});

test("translateTextBlocks applies terminology overrides for target language", async () => {
  global.AtlasTranslate = {
    cacheStore: {},
    postResolver: {},
    settings: {
      DEFAULT_SETTINGS: {
        targetLanguage: "zh-Hans",
        inlineMode: "manual",
        selectionEnabled: true
      }
    }
  };
  require("../src/shared/utils.js");

  const inlineTranslator = require("../src/content/inline_translator.js");
  const translated = await inlineTranslator.translateTextBlocks(
    ["First block"],
    async () => ({
      text: "克劳德 使用了书签",
      resolvedPair: {
        sourceLanguage: "en",
        targetLanguage: "zh-Hans"
      }
    }),
    null,
    "zh-Hans"
  );

  assert.deepEqual(translated, ["Claude 使用了收藏"]);

  delete global.AtlasTranslate;
});
