(function (global, factory) {
  const root = global.AtlasTranslate || (global.AtlasTranslate = {});
  const api = factory(root);
  root.inlineTranslator = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  const cacheStore = root.cacheStore;
  const postResolver = root.postResolver;
  const settingsApi = root.settings;
  const utils = root.utils;
  const INLINE_CACHE_VERSION = "v2";

  function createDefaultState() {
    return {
      translationBlocks: [],
      hidden: true,
      status: "idle",
      message: "保留原文，点击翻译正文。"
    };
  }

  function renderPanel(shadowRoot, state, controller) {
    const translatedBlocks = getRenderedTranslationBlocks(state);
    const showTranslation = translatedBlocks.length > 0 && !state.hidden;
    const statusClass = state.status === "error" ? "status error" : "status";

    shadowRoot.innerHTML = `
      <style>
        :host {
          all: initial;
        }
        .wrap {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          border: 1px solid rgba(99, 115, 129, 0.28);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.98);
          color: #0f1419;
          margin-top: 10px;
          overflow: hidden;
          box-shadow: 0 8px 28px rgba(15, 20, 25, 0.08);
        }
        .toolbar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-bottom: 1px solid rgba(99, 115, 129, 0.16);
          background: linear-gradient(180deg, rgba(247,249,249,0.96), rgba(255,255,255,0.96));
        }
        .button {
          border: 0;
          border-radius: 999px;
          padding: 6px 12px;
          background: #111;
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .button.secondary {
          background: #eef3f4;
          color: #0f1419;
        }
        .button.secondary.active {
          background: #d9f0e4;
          color: #0f5132;
        }
        .button:disabled {
          cursor: wait;
          opacity: 0.65;
        }
        .status {
          flex: 1;
          font-size: 12px;
          color: #536471;
        }
        .status.error {
          color: #c0392b;
        }
        .content {
          padding: 12px;
          display: ${showTranslation ? "block" : "none"};
          background: #f7fbff;
        }
        .block {
          margin: 0 0 10px;
          line-height: 1.6;
          font-size: 14px;
          color: #23303b;
        }
        .block:last-child {
          margin-bottom: 0;
        }
      </style>
      <div class="wrap">
        <div class="toolbar">
          <button class="button action">${translatedBlocks.length ? (state.hidden ? "显示译文" : "隐藏译文") : "翻译正文"}</button>
          <button class="button secondary mode ${controller.settings.inlineMode === "auto" ? "active" : ""}">${controller.settings.inlineMode === "auto" ? "关闭自动模式" : "开启自动模式"}</button>
          <div class="${statusClass}">${state.message || ""}</div>
        </div>
        <div class="content">
          ${translatedBlocks.map(function block(text) {
            return `<p class="block">${escapeHtml(text)}</p>`;
          }).join("")}
        </div>
      </div>
    `;

    shadowRoot.querySelector(".action").addEventListener("click", function onClick() {
      controller.handleActionClick();
    });
    shadowRoot.querySelector(".mode").addEventListener("click", function onModeClick() {
      controller.toggleAutoMode();
    });
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function buildInlineCacheKey(tweetId, sourceText, targetLanguage) {
    return [INLINE_CACHE_VERSION, utils.buildCacheKey(tweetId, sourceText, targetLanguage)].join(":");
  }

  function getRenderedTranslationBlocks(state) {
    if (Array.isArray(state.translationBlocks) && state.translationBlocks.length) {
      return state.translationBlocks;
    }
    return [];
  }

  function hydrateCachedTranslation(cached, targetLanguage) {
    if (!cached) {
      return null;
    }
    const translationBlocks = Array.isArray(cached.translationBlocks)
      ? cached.translationBlocks
          .map((value) => normalizeTranslatedBlock(value, targetLanguage))
          .filter(Boolean)
      : [];
    if (!translationBlocks.length && typeof cached.translation === "string") {
      translationBlocks.push(
        ...cached.translation
          .split(/\n+/)
          .map((line) =>
            utils.applyTerminologyOverrides(
              utils.normalizeWhitespace(line),
              targetLanguage
            )
          )
          .filter(Boolean)
      );
    }

    if (!translationBlocks.length) {
      return null;
    }

    return {
      translationBlocks
    };
  }

  function normalizeTranslatedBlock(value, targetLanguage) {
    if (typeof value === "string") {
      return utils.applyTerminologyOverrides(
        utils.normalizeWhitespace(value),
        targetLanguage
      );
    }
    if (value && typeof value.text === "string") {
      return utils.applyTerminologyOverrides(
        utils.normalizeWhitespace(value.text),
        targetLanguage
      );
    }
    return "";
  }

  async function translateTextBlocks(blocks, translateBlock, onBlockStart, targetLanguage) {
    const translatedBlocks = [];

    for (let index = 0; index < blocks.length; index += 1) {
      if (typeof onBlockStart === "function") {
        onBlockStart(index, blocks.length, blocks[index]);
      }
      translatedBlocks.push(
        normalizeTranslatedBlock(
          await translateBlock(blocks[index], index, blocks.length),
          targetLanguage
        )
      );
    }

    return translatedBlocks;
  }

  class InlineTranslationController {
    constructor(engine, settings) {
      this.engine = engine;
      this.settings = settings || settingsApi.DEFAULT_SETTINGS;
      this.context = null;
      this.host = document.createElement("div");
      this.host.setAttribute("data-atlas-translate-inline", "true");
      this.shadowRoot = this.host.attachShadow({ mode: "open" });
      this.state = createDefaultState();
      this.pendingGestureSourceLanguage = null;
    }

    updateContext(context) {
      const hasContextChanged =
        !this.context ||
        !context ||
        this.context.tweetId !== context.tweetId ||
        this.context.textRoot !== context.textRoot;

      this.context = context;
      if (!context) {
        this.host.remove();
        return;
      }

      if (hasContextChanged) {
        this.state = createDefaultState();
        this.pendingGestureSourceLanguage = null;
      }

      if (
        this.host.parentNode !== context.textRoot.parentNode ||
        this.host.previousElementSibling !== context.textRoot
      ) {
        context.textRoot.insertAdjacentElement("afterend", this.host);
      }

      this.render();
      if (hasContextChanged && this.settings.inlineMode === "auto") {
        this.maybeAutoTranslate();
      }
    }

    destroy() {
      this.context = null;
      this.pendingGestureSourceLanguage = null;
      this.host.remove();
    }

    updateSettings(nextSettings) {
      this.settings = nextSettings;
      this.render();
    }

    render() {
      renderPanel(this.shadowRoot, this.state, this);
    }

    async toggleAutoMode() {
      const nextInlineMode = this.settings.inlineMode === "auto" ? "manual" : "auto";
      this.settings = await settingsApi.saveSettings({
        inlineMode: nextInlineMode
      });
      this.state.message =
        nextInlineMode === "auto"
          ? "已开启自动模式。首次请手动点一次“翻译正文”，后续帖子会自动翻译。"
          : "已关闭自动模式。";
      this.render();
      if (nextInlineMode === "auto") {
        this.maybeAutoTranslate();
      }
    }

    async handleActionClick() {
      if (getRenderedTranslationBlocks(this.state).length) {
        this.state.hidden = !this.state.hidden;
        this.state.message = this.state.hidden ? "已隐藏译文。" : "正在显示译文。";
        this.render();
        return;
      }
      const sourceText = this.context
        ? postResolver.getSourceText(this.context.textRoot)
        : "";
      const primeSourceLanguage =
        this.pendingGestureSourceLanguage ||
        utils.guessSourceLanguage(sourceText) ||
        "en";
      this.engine.primeForUserGesture(primeSourceLanguage, this.settings.targetLanguage);
      await this.translate(false, {
        preferDirectLanguageGuess: true
      });
    }

    maybeAutoTranslate() {
      if (!this.engine.hasGesturePrime) {
        this.state.status = "idle";
        this.state.message = "自动模式已开启。首次请手动点一次“翻译正文”，后续帖子会自动翻译。";
        this.render();
        return;
      }
      this.translate(true, {
        preferDirectLanguageGuess: true
      });
    }

    async translate(isAuto, options) {
      if (!this.context) {
        return;
      }
      const config = options || {};
      const sourceBlocks = postResolver.extractTextBlocks(this.context.textRoot);
      const sourceText = sourceBlocks.join("\n");
      if (!sourceBlocks.length || !sourceText) {
        this.state.status = "error";
        this.state.message = "没有找到可翻译的主帖正文。";
        this.render();
        return;
      }

      const cacheKey = buildInlineCacheKey(
        this.context.tweetId,
        sourceText,
        this.settings.targetLanguage
      );
      const cached = hydrateCachedTranslation(
        await cacheStore.get(cacheKey),
        this.settings.targetLanguage
      );
      if (cached) {
        this.state.translationBlocks = cached.translationBlocks;
        this.state.hidden = false;
        this.state.status = "ready";
        this.state.message = "已使用缓存译文。";
        this.render();
        return;
      }

      this.state.status = "loading";
      this.state.message = "正在检查内建翻译能力…";
      this.render();

      try {
        const sourceLanguage = await utils.resolveSourceLanguage(sourceText, {
          preferGuess: config.preferDirectLanguageGuess,
          detect: (text, onProgress) => this.engine.detect(text, onProgress),
          onProgress: (event) => {
            this.state.message =
              event.loaded != null
                ? `正在下载语言识别模型 ${Math.round(event.loaded * 100)}%`
                : "正在准备语言识别模型…";
            this.render();
          }
        });
        this.pendingGestureSourceLanguage = sourceLanguage;

        this.state.message = "正在翻译正文…";
        this.render();

        const translatedBlocks = await translateTextBlocks(
          sourceBlocks,
          (blockText, index, total) => this.engine.translate(
            blockText,
            sourceLanguage,
            this.settings.targetLanguage,
            (event) => {
              this.state.message =
                event.loaded != null
                  ? `正在下载翻译语言包 ${Math.round(event.loaded * 100)}%`
                  : total > 1
                    ? `正在翻译第 ${index + 1}/${total} 段…`
                    : "正在准备翻译语言包…";
              this.render();
            }
          ),
          (index, total) => {
            this.state.message =
              total > 1
                ? `正在翻译第 ${index + 1}/${total} 段…`
                : "正在翻译正文…";
            this.render();
          },
          this.settings.targetLanguage
        );
        this.state.translationBlocks = translatedBlocks;
        this.state.hidden = false;
        this.state.status = "ready";
        this.state.message = isAuto ? "已自动生成译文。" : "译文已生成。";
        this.pendingGestureSourceLanguage = null;
        this.render();

        await cacheStore.set(cacheKey, {
          translationBlocks: translatedBlocks,
          sourceLanguage,
          targetLanguage: this.settings.targetLanguage
        });
      } catch (error) {
        this.state.status = "error";
        this.state.message = utils.formatTranslationError(error, {
          context: "inline",
          sourceLanguage: this.pendingGestureSourceLanguage
        });
        this.render();
      }
    }
  }

  return {
    InlineTranslationController,
    buildInlineCacheKey,
    getRenderedTranslationBlocks,
    hydrateCachedTranslation,
    translateTextBlocks
  };
});
