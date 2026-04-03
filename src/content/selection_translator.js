(function (global, factory) {
  const root = global.AtlasTranslate || (global.AtlasTranslate = {});
  const api = factory(root);
  root.selectionTranslator = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  const settingsApi = root.settings;
  const utils = root.utils;

  function createBubbleHost() {
    const host = document.createElement("div");
    host.style.position = "fixed";
    host.style.zIndex = "2147483647";
    host.style.left = "0";
    host.style.top = "0";
    host.style.display = "none";
    const shadowRoot = host.attachShadow({ mode: "open" });
    document.documentElement.appendChild(host);
    return {
      host,
      shadowRoot
    };
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  class SelectionTranslationController {
    constructor(engine, settings) {
      this.engine = engine;
      this.settings = settings || settingsApi.DEFAULT_SETTINGS;
      this.context = null;
      this.pendingTimer = null;
      this.pinned = false;
      const bubble = createBubbleHost();
      this.host = bubble.host;
      this.shadowRoot = bubble.shadowRoot;
      this.state = {
        text: "",
        translatedText: "",
        message: ""
      };
      this.pendingSourceLanguage = null;

      this.handleDocumentInteraction = this.handleDocumentInteraction.bind(this);
      this.handleSelectionChange = this.handleSelectionChange.bind(this);

      document.addEventListener("mouseup", this.handleDocumentInteraction);
      document.addEventListener("keyup", this.handleDocumentInteraction);
      document.addEventListener("selectionchange", this.handleSelectionChange);
    }

    updateContext(context, settings) {
      this.context = context;
      this.settings = settings;
      if (!context || !settings.selectionEnabled) {
        this.hide();
      }
    }

    destroy() {
      document.removeEventListener("mouseup", this.handleDocumentInteraction);
      document.removeEventListener("keyup", this.handleDocumentInteraction);
      document.removeEventListener("selectionchange", this.handleSelectionChange);
      this.hide();
      this.host.remove();
    }

    handleSelectionChange() {
      if (!this.pinned) {
        this.scheduleSelectionWork();
      }
    }

    handleDocumentInteraction() {
      const immediateSelection = this.getCurrentSelectionPayload();
      if (immediateSelection) {
        this.engine.primeForUserGesture(
          this.pendingSourceLanguage ||
            utils.guessSourceLanguage(immediateSelection.text) ||
            "en",
          this.settings.targetLanguage
        );
      }
      this.scheduleSelectionWork();
    }

    scheduleSelectionWork() {
      if (this.pendingTimer) {
        clearTimeout(this.pendingTimer);
      }
      this.pendingTimer = setTimeout(() => {
        this.pendingTimer = null;
        this.translateCurrentSelection();
      }, 150);
    }

    getCurrentSelectionPayload() {
      if (!this.context || !this.settings.selectionEnabled) {
        return null;
      }
      const selection = document.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        return null;
      }
      const range = selection.getRangeAt(0);
      const text = utils.normalizeWhitespace(selection.toString());
      if (!text || !this.context.textRoot.contains(range.commonAncestorContainer)) {
        return null;
      }
      if (!utils.isProbablyTranslatableSelection(text)) {
        return null;
      }
      return {
        text,
        rect: range.getBoundingClientRect()
      };
    }

    async translateCurrentSelection() {
      const payload = this.getCurrentSelectionPayload();
      if (!payload) {
        if (!this.pinned) {
          this.hide();
        }
        return;
      }

      this.state.text = payload.text;
      this.state.translatedText = "";
      this.state.message = "翻译中…";
      this.showAt(payload.rect);
      this.render();

      try {
        const sourceLanguage = await utils.resolveSourceLanguage(payload.text, {
          detect: (text, onProgress) => this.engine.detect(text, onProgress),
          onProgress: (event) => {
            this.state.message =
              event.loaded != null
                ? `下载语言检测模型 ${Math.round(event.loaded * 100)}%`
                : "准备语言检测模型中…";
            this.render();
          }
        });
        this.pendingSourceLanguage = sourceLanguage;
        const translation = await this.engine.translate(
          payload.text,
          sourceLanguage,
          this.settings.targetLanguage,
          (event) => {
            this.state.message =
              event.loaded != null
                ? `下载语言包 ${Math.round(event.loaded * 100)}%`
                : "准备翻译模型中…";
            this.render();
          }
        );
        this.state.translatedText = utils.applyTerminologyOverrides(
          translation.text,
          this.settings.targetLanguage
        );
        this.state.message = "";
        this.pendingSourceLanguage = null;
        this.render();
      } catch (error) {
        this.state.message = utils.formatTranslationError(error, {
          context: "selection",
          sourceLanguage: this.pendingSourceLanguage
        });
        this.render();
      }
    }

    showAt(rect) {
      const top = Math.max(12, rect.bottom + 10);
      const left = Math.min(
        Math.max(12, rect.left),
        window.innerWidth - 360
      );
      this.host.style.top = `${top}px`;
      this.host.style.left = `${left}px`;
      this.host.style.display = "block";
    }

    hide() {
      this.pinned = false;
      this.host.style.display = "none";
    }

    async copyTranslatedText() {
      if (!this.state.translatedText) {
        return;
      }
      await navigator.clipboard.writeText(this.state.translatedText);
      this.state.message = "译文已复制。";
      this.render();
    }

    render() {
      this.shadowRoot.innerHTML = `
        <style>
          .bubble {
            width: 320px;
            border-radius: 16px;
            border: 1px solid rgba(99, 115, 129, 0.22);
            background: rgba(255, 255, 255, 0.98);
            box-shadow: 0 18px 45px rgba(15, 20, 25, 0.16);
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          .head {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 12px;
            background: linear-gradient(180deg, #0f1419, #1d2730);
            color: #fff;
          }
          .title {
            flex: 1;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.02em;
          }
          .head button {
            border: 0;
            background: rgba(255,255,255,0.14);
            color: #fff;
            border-radius: 999px;
            padding: 5px 10px;
            font-size: 11px;
            cursor: pointer;
          }
          .body {
            padding: 12px;
            color: #0f1419;
          }
          .src {
            font-size: 12px;
            line-height: 1.5;
            color: #536471;
            margin-bottom: 8px;
          }
          .dst {
            font-size: 14px;
            line-height: 1.65;
            color: #17212b;
          }
          .msg {
            margin-top: 8px;
            font-size: 12px;
            color: #536471;
          }
          .msg.error {
            color: #c0392b;
          }
        </style>
        <div class="bubble">
          <div class="head">
            <div class="title">滑词翻译</div>
            <button class="pin">${this.pinned ? "取消固定" : "固定"}</button>
            <button class="copy">复制</button>
            <button class="close">关闭</button>
          </div>
          <div class="body">
            <div class="src">${escapeHtml(this.state.text)}</div>
            <div class="dst">${escapeHtml(this.state.translatedText || "…")}</div>
            <div class="msg ${this.state.message ? (this.state.message.includes("失败") ? "error" : "") : ""}">
              ${escapeHtml(this.state.message || "")}
            </div>
          </div>
        </div>
      `;

      this.shadowRoot.querySelector(".pin").addEventListener("click", () => {
        this.pinned = !this.pinned;
        this.render();
      });
      this.shadowRoot.querySelector(".copy").addEventListener("click", () => {
        this.copyTranslatedText().catch((error) => {
          this.state.message = error.message || "复制失败。";
          this.render();
        });
      });
      this.shadowRoot.querySelector(".close").addEventListener("click", () => {
        this.hide();
      });
    }
  }

  return {
    SelectionTranslationController
  };
});
