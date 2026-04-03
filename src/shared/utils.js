(function (global, factory) {
  const root = global.AtlasTranslate || (global.AtlasTranslate = {});
  const api = factory(root);
  root.utils = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const STATUS_PATH_RE = /^\/([^/]+)\/status\/(\d+)(?:\/|$)/;
  const LANGUAGE_LABELS = Object.freeze({
    ar: "阿拉伯语",
    de: "德语",
    el: "希腊语",
    en: "英语",
    es: "西班牙语",
    fr: "法语",
    he: "希伯来语",
    hi: "印地语",
    id: "印尼语",
    it: "意大利语",
    ja: "日语",
    ko: "韩语",
    pt: "葡萄牙语",
    ru: "俄语",
    th: "泰语",
    tr: "土耳其语"
  });
  const TRANSLATION_ERROR_KINDS = Object.freeze({
    REQUIRES_GESTURE: "requires-gesture",
    RELOAD_PAGE: "reload-page",
    DETECTOR_UNAVAILABLE: "detector-unavailable",
    TRANSLATOR_UNAVAILABLE: "translator-unavailable",
    LANGUAGE_PAIR_UNAVAILABLE: "language-pair-unavailable",
    UNKNOWN: "unknown"
  });
  const TERMINOLOGY_OVERRIDES = Object.freeze({
    zh: [
      {
        pattern: /\bClaude\s+Opus\b/gi,
        replacement: "Claude Opus"
      },
      {
        pattern: /克劳德\s*[·.\-]?\s*(欧泊斯|奥普斯|opus)/gi,
        replacement: "Claude Opus"
      },
      {
        pattern: /\bClaude\b/gi,
        replacement: "Claude"
      },
      {
        pattern: /克劳德/gi,
        replacement: "Claude"
      },
      {
        pattern: /\bbookmarks?\b/gi,
        replacement: "收藏"
      },
      {
        pattern: /书签/g,
        replacement: "收藏"
      }
    ]
  });

  function parseStatusPathname(pathname) {
    if (typeof pathname !== "string") {
      return null;
    }
    const match = pathname.match(STATUS_PATH_RE);
    if (!match) {
      return null;
    }
    return {
      handle: match[1],
      tweetId: match[2]
    };
  }

  function normalizeWhitespace(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function splitWords(text) {
    return normalizeWhitespace(text).split(" ").filter(Boolean);
  }

  function hasMinimumWordCount(text, minimum) {
    return splitWords(text).length >= minimum;
  }

  function isProbablyEnglishSelection(text) {
    const normalized = normalizeWhitespace(text);
    if (!hasMinimumWordCount(normalized, 2)) {
      return false;
    }
    if (/[@#]\S+/.test(normalized) && splitWords(normalized).length < 3) {
      return false;
    }
    if (/[\u3040-\u30ff\u3400-\u9fff\u0600-\u06ff]/.test(normalized)) {
      return false;
    }
    const nonSpace = normalized.replace(/\s+/g, "");
    const latinLetters = (normalized.match(/[A-Za-z]/g) || []).length;
    if (!nonSpace || latinLetters < 4) {
      return false;
    }
    return latinLetters / nonSpace.length >= 0.45;
  }

  function isProbablyEnglishText(text) {
    const normalized = normalizeWhitespace(text);
    if (!hasMinimumWordCount(normalized, 4)) {
      return false;
    }
    if (/[\u3040-\u30ff\u3400-\u9fff\u0600-\u06ff]/.test(normalized)) {
      return false;
    }
    const letters = (normalized.match(/[A-Za-z]/g) || []).length;
    const nonSpace = normalized.replace(/\s+/g, "");
    if (!nonSpace || letters < 16) {
      return false;
    }
    return letters / nonSpace.length >= 0.55;
  }

  function guessSourceLanguage(text) {
    const normalized = normalizeWhitespace(text);
    if (!normalized) {
      return null;
    }
    if (/[\u3040-\u30ff]/.test(normalized)) {
      return "ja";
    }
    if (/[\uac00-\ud7af]/i.test(normalized)) {
      return "ko";
    }
    if (/[\u0e00-\u0e7f]/.test(normalized)) {
      return "th";
    }
    if (/[\u0590-\u05ff]/.test(normalized)) {
      return "he";
    }
    if (/[\u0400-\u04ff]/.test(normalized)) {
      return "ru";
    }
    if (/[\u0370-\u03ff]/.test(normalized)) {
      return "el";
    }
    if (/[\u0600-\u06ff]/.test(normalized)) {
      return "ar";
    }
    if (/[\u0900-\u097f]/.test(normalized)) {
      return "hi";
    }
    const latinLanguage = guessLatinLanguage(normalized);
    if (latinLanguage) {
      return latinLanguage;
    }
    if (/[\u4e00-\u9fff]/.test(normalized)) {
      return null;
    }
    if (isProbablyEnglishText(normalized) || isProbablyEnglishSelection(normalized)) {
      return "en";
    }
    return null;
  }

  function guessLatinLanguage(text) {
    if (!/[A-Za-zÀ-ÿ]/.test(text)) {
      return null;
    }
    const rules = [
      {
        code: "es",
        patterns: [/[ñ¿¡]/gi, /\b(el|la|los|las|una|uno|que|del|para|con|sin|por|está|más|como|pero)\b/gi]
      },
      {
        code: "fr",
        patterns: [/[àâçéèêëîïôùûüÿœæ]/gi, /\b(le|la|les|une|des|que|pour|avec|dans|pas|plus|sur|est|du)\b/gi]
      },
      {
        code: "de",
        patterns: [/[äöüß]/gi, /\b(der|die|das|und|ist|nicht|eine|einer|mit|für|auf|von|dem|den|zu)\b/gi]
      },
      {
        code: "pt",
        patterns: [/[ãõç]/gi, /\b(que|não|para|com|uma|mais|como|por|dos|das|está|entre)\b/gi]
      },
      {
        code: "it",
        patterns: [/[àèéìíîòóù]/gi, /\b(il|lo|gli|che|della|delle|con|non|più|come|per|sono|una)\b/gi]
      },
      {
        code: "tr",
        patterns: [/[ğışİöüç]/gi, /\b(ve|bir|bu|için|ile|çok|ama|daha|gibi|olan|olarak)\b/gi]
      },
      {
        code: "id",
        patterns: [/\b(dan|yang|untuk|dengan|tidak|ini|itu|karena|lebih|pada|dalam|adalah)\b/gi]
      }
    ];

    let bestCode = null;
    let bestScore = 0;
    let tie = false;

    for (const rule of rules) {
      const score = rule.patterns.reduce((total, pattern) => {
        const matches = text.match(pattern);
        return total + (matches ? matches.length : 0);
      }, 0);
      if (score > bestScore) {
        bestCode = rule.code;
        bestScore = score;
        tie = false;
      } else if (score > 0 && score === bestScore) {
        tie = true;
      }
    }

    if (bestScore < 2 || tie) {
      return null;
    }
    return bestCode;
  }

  function getLanguageLabel(code) {
    return LANGUAGE_LABELS[code] || code;
  }

  async function resolveSourceLanguage(text, options) {
    const config = options || {};
    const normalized = normalizeWhitespace(text);
    const guessedLanguage = guessSourceLanguage(normalized);

    if (config.preferGuess !== false && guessedLanguage) {
      return guessedLanguage;
    }
    if (typeof config.detect !== "function") {
      return guessedLanguage || config.fallbackLanguage || "en";
    }

    const detection = await config.detect(normalized, config.onProgress);
    const detectedLanguage =
      detection &&
      detection.best &&
      detection.best.detectedLanguage;

    return detectedLanguage || guessedLanguage || config.fallbackLanguage || "en";
  }

  function classifyTranslationError(error) {
    const message = (error && error.message) || String(error || "");
    if (message.includes("Requires a user gesture")) {
      return TRANSLATION_ERROR_KINDS.REQUIRES_GESTURE;
    }
    if (
      message.includes("If you just reloaded the extension") ||
      message.includes("Atlas page bridge did not respond")
    ) {
      return TRANSLATION_ERROR_KINDS.RELOAD_PAGE;
    }
    if (message.includes("LanguageDetector API is not available")) {
      return TRANSLATION_ERROR_KINDS.DETECTOR_UNAVAILABLE;
    }
    if (message.includes("Translator API is not available")) {
      return TRANSLATION_ERROR_KINDS.TRANSLATOR_UNAVAILABLE;
    }
    if (message.includes("unavailable on this device")) {
      return TRANSLATION_ERROR_KINDS.LANGUAGE_PAIR_UNAVAILABLE;
    }
    return TRANSLATION_ERROR_KINDS.UNKNOWN;
  }

  function formatTranslationError(error, options) {
    const config = options || {};
    const context = config.context === "selection" ? "selection" : "inline";
    const sourceLanguage = config.sourceLanguage;
    const message =
      (error && error.message) ||
      (context === "selection" ? "滑词翻译失败。" : "翻译失败。");

    switch (classifyTranslationError(error)) {
      case TRANSLATION_ERROR_KINDS.REQUIRES_GESTURE:
        if (sourceLanguage && sourceLanguage !== "en") {
          return context === "selection"
            ? `已识别到 ${getLanguageLabel(sourceLanguage)}，请重新选中一次文本以下载该语种到中文的本地模型。`
            : `已识别到 ${getLanguageLabel(sourceLanguage)}，请再点一次“翻译正文”下载该语种到中文的本地模型。`;
        }
        return context === "selection"
          ? "首次滑词需要先手动点一次“翻译正文”或重新选中一次文本。"
          : "需要先通过一次真实点击触发本地模型下载。请再点一次“翻译正文”。";
      case TRANSLATION_ERROR_KINDS.RELOAD_PAGE:
        return "扩展刚刚重载后，这个页面还是旧注入上下文。请刷新当前帖子页面后再试。";
      case TRANSLATION_ERROR_KINDS.DETECTOR_UNAVAILABLE:
        return "当前 Atlas 构建未暴露 LanguageDetector API。";
      case TRANSLATION_ERROR_KINDS.TRANSLATOR_UNAVAILABLE:
        return "当前 Atlas 构建未暴露 Translator API。";
      case TRANSLATION_ERROR_KINDS.LANGUAGE_PAIR_UNAVAILABLE:
        return "当前设备或语言方向不受支持。";
      default:
        return message;
    }
  }

  function applyTerminologyOverrides(text, targetLanguage) {
    const normalized = String(text || "");
    const candidates = getLanguageCandidates(targetLanguage);
    const overrides = unique(
      candidates.flatMap((candidate) => TERMINOLOGY_OVERRIDES[candidate] || [])
    );

    return overrides.reduce((value, rule) => {
      return value.replace(rule.pattern, rule.replacement);
    }, normalized);
  }

  function isProbablyTranslatableSelection(text) {
    const normalized = normalizeWhitespace(text);
    if (!normalized) {
      return false;
    }
    if (guessSourceLanguage(normalized)) {
      return true;
    }
    if (/[\u4e00-\u9fff]/.test(normalized)) {
      return false;
    }
    const latinLetters = (normalized.match(/[A-Za-zÀ-ÿ]/g) || []).length;
    return hasMinimumWordCount(normalized, 2) && latinLetters >= 4;
  }

  function hashText(text) {
    const normalized = normalizeWhitespace(text);
    let hash = 2166136261;
    for (let index = 0; index < normalized.length; index += 1) {
      hash ^= normalized.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function buildCacheKey(tweetId, text, targetLanguage) {
    return [tweetId, targetLanguage, hashText(text)].join(":");
  }

  function unique(items) {
    return Array.from(new Set(items.filter(Boolean)));
  }

  function getLanguageCandidates(tag) {
    if (!tag) {
      return [];
    }
    const normalized = String(tag).trim();
    const primary = normalized.split("-")[0];
    if (normalized === "zh-Hans" || normalized === "zh-Hant") {
      return unique([normalized, "zh"]);
    }
    return unique([normalized, primary]);
  }

  function textContentWithBreaks(root) {
    if (!root) {
      return "";
    }

    function walk(node) {
      if (!node) {
        return "";
      }
      if (node.nodeType === 3) {
        return node.nodeValue || "";
      }
      if (node.nodeType !== 1) {
        return "";
      }
      const tagName = node.tagName ? node.tagName.toLowerCase() : "";
      if (tagName === "br") {
        return "\n";
      }
      const parts = [];
      const isBlock = /^(div|p|section|article|li|blockquote)$/i.test(tagName);
      if (isBlock) {
        parts.push("\n");
      }
      for (const child of node.childNodes) {
        parts.push(walk(child));
      }
      if (isBlock) {
        parts.push("\n");
      }
      return parts.join("");
    }

    return walk(root);
  }

  return {
    STATUS_PATH_RE,
    LANGUAGE_LABELS,
    TRANSLATION_ERROR_KINDS,
    TERMINOLOGY_OVERRIDES,
    applyTerminologyOverrides,
    buildCacheKey,
    classifyTranslationError,
    formatTranslationError,
    getLanguageLabel,
    guessSourceLanguage,
    guessLatinLanguage,
    getLanguageCandidates,
    hashText,
    hasMinimumWordCount,
    isProbablyEnglishText,
    isProbablyEnglishSelection,
    isProbablyTranslatableSelection,
    normalizeWhitespace,
    parseStatusPathname,
    resolveSourceLanguage,
    splitWords,
    textContentWithBreaks,
    unique
  };
});
