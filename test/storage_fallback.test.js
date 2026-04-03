const test = require("node:test");
const assert = require("node:assert/strict");

test("cache store returns null when extension context is invalidated", async () => {
  global.chrome = {
    storage: {
      local: {
        async get() {
          throw new Error("Extension context invalidated.");
        }
      }
    }
  };
  global.AtlasTranslate = {};

  const cacheStore = require("../src/shared/cache.js");
  const value = await cacheStore.get("any-key");

  assert.equal(value, null);

  delete global.chrome;
  delete global.AtlasTranslate;
});

test("settings fall back to defaults when extension context is invalidated", async () => {
  global.chrome = {
    storage: {
      local: {
        async get() {
          throw new Error("Extension context invalidated.");
        },
        async set() {}
      },
      onChanged: {
        addListener() {},
        removeListener() {}
      }
    }
  };
  global.AtlasTranslate = {};

  const settingsApi = require("../src/shared/settings.js");
  const settings = await settingsApi.getSettings();

  assert.deepEqual(settings, settingsApi.DEFAULT_SETTINGS);

  delete global.chrome;
  delete global.AtlasTranslate;
});
