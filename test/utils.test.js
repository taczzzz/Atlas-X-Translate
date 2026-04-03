const test = require("node:test");
const assert = require("node:assert/strict");
const utils = require("../src/shared/utils.js");

test("parseStatusPathname extracts handle and tweetId", () => {
  assert.deepEqual(utils.parseStatusPathname("/zei_squirrel/status/2028004439957635345"), {
    handle: "zei_squirrel",
    tweetId: "2028004439957635345"
  });
});

test("parseStatusPathname returns null for non-status paths", () => {
  assert.equal(utils.parseStatusPathname("/home"), null);
});

test("isProbablyEnglishSelection rejects short or noisy selections", () => {
  assert.equal(utils.isProbablyEnglishSelection("Nasrallah"), false);
  assert.equal(utils.isProbablyEnglishSelection("@zei_squirrel hello"), false);
  assert.equal(utils.isProbablyEnglishSelection("03:08 PM"), false);
});

test("isProbablyEnglishSelection accepts multi-word English text", () => {
  assert.equal(
    utils.isProbablyEnglishSelection("We will not abandon Palestine"),
    true
  );
});

test("isProbablyEnglishText accepts long English paragraphs", () => {
  assert.equal(
    utils.isProbablyEnglishText(
      "Julius Sello Malema, leader of the Economic Freedom Fighters, has stirred global debate after strongly criticizing Donald Trump."
    ),
    true
  );
});

test("isProbablyEnglishText rejects mixed CJK text", () => {
  assert.equal(
    utils.isProbablyEnglishText("这是中文 mixed with English words"),
    false
  );
});

test("guessSourceLanguage identifies Arabic and Japanese text", () => {
  assert.equal(utils.guessSourceLanguage("نحن مع إيران"), "ar");
  assert.equal(utils.guessSourceLanguage("これは日本語の文章です"), "ja");
});

test("guessSourceLanguage identifies common Latin-script languages", () => {
  assert.equal(
    utils.guessSourceLanguage("El presidente habló con una voz más firme sobre la política exterior."),
    "es"
  );
  assert.equal(
    utils.guessSourceLanguage("Le président a parlé avec une voix plus ferme sur la politique étrangère."),
    "fr"
  );
  assert.equal(
    utils.guessSourceLanguage("Der Präsident sprach mit einer deutlich härteren Stimme über die Außenpolitik."),
    "de"
  );
});

test("resolveSourceLanguage prefers guessed language before detection", async () => {
  let detectCalled = false;

  const resolved = await utils.resolveSourceLanguage(
    "El presidente habló con una voz más firme sobre la política exterior.",
    {
      detect: async () => {
        detectCalled = true;
        return {
          best: {
            detectedLanguage: "en"
          }
        };
      }
    }
  );

  assert.equal(resolved, "es");
  assert.equal(detectCalled, false);
});

test("resolveSourceLanguage can force detector fallback", async () => {
  const resolved = await utils.resolveSourceLanguage("Alpha beta gamma delta", {
    preferGuess: false,
    detect: async () => ({
      best: {
        detectedLanguage: "fr"
      }
    })
  });

  assert.equal(resolved, "fr");
});

test("isProbablyTranslatableSelection allows non-English scripts and skips Chinese", () => {
  assert.equal(utils.isProbablyTranslatableSelection("Мы с Ираном"), true);
  assert.equal(utils.isProbablyTranslatableSelection("我们支持伊朗"), false);
});

test("formatTranslationError maps shared gesture and reload errors", () => {
  assert.equal(
    utils.formatTranslationError(
      new Error('Requires a user gesture when availability is "downloading" or "downloadable".'),
      {
        context: "inline",
        sourceLanguage: "es"
      }
    ),
    "已识别到 西班牙语，请再点一次“翻译正文”下载该语种到中文的本地模型。"
  );

  assert.equal(
    utils.formatTranslationError(
      new Error(
        "Atlas page bridge did not respond. If you just reloaded the extension, refresh the current X page and try again."
      ),
      {
        context: "selection"
      }
    ),
    "扩展刚刚重载后，这个页面还是旧注入上下文。请刷新当前帖子页面后再试。"
  );
});

test("applyTerminologyOverrides preserves custom glossary in Chinese output", () => {
  assert.equal(
    utils.applyTerminologyOverrides("克劳德 欧泊斯 打开了书签。", "zh-Hans"),
    "Claude Opus 打开了收藏。"
  );
  assert.equal(
    utils.applyTerminologyOverrides("Claude uses bookmarks heavily.", "zh-Hans"),
    "Claude uses 收藏 heavily."
  );
});

test("buildCacheKey stays stable for normalized text", () => {
  const first = utils.buildCacheKey("123", "Hello   world", "zh-Hans");
  const second = utils.buildCacheKey("123", "Hello world", "zh-Hans");
  assert.equal(first, second);
});
