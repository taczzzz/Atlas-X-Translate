(function (global, factory) {
  const root = global.AtlasTranslate || (global.AtlasTranslate = {});
  const api = factory(root);
  root.postResolver = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  const utils = root.utils;

  function isProbablyVisible(element) {
    if (!element || element.hidden || element.getAttribute("aria-hidden") === "true") {
      return false;
    }
    if (typeof window === "undefined" || !window.getComputedStyle) {
      return true;
    }
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function resolveStatusLinkSelector(tweetId) {
    return [
      `a[href*="/status/${tweetId}"]`,
      `a[href*="/i/web/status/${tweetId}"]`
    ].join(",");
  }

  function resolveMainPost(doc, locationLike) {
    const status = utils.parseStatusPathname(locationLike.pathname);
    if (!status || !doc) {
      return null;
    }
    const selector = resolveStatusLinkSelector(status.tweetId);
    const articles = Array.from(doc.querySelectorAll("main article"));
    for (const article of articles) {
      if (!isProbablyVisible(article)) {
        continue;
      }
      if (!article.querySelector(selector)) {
        continue;
      }
      const textRoot = resolveTextRoot(article);
      if (textRoot) {
        return {
          article,
          textRoot,
          tweetId: status.tweetId,
          handle: status.handle
        };
      }
    }
    return null;
  }

  function resolveTextRoot(article) {
    if (!article) {
      return null;
    }
    const direct = article.querySelector('[data-testid="tweetText"]');
    if (direct) {
      return direct;
    }
    const candidates = Array.from(article.querySelectorAll("[lang]"))
      .filter(isProbablyVisible)
      .map(function toScore(element) {
        return {
          element,
          score: utils.normalizeWhitespace(element.textContent).length
        };
      })
      .sort(function sortByLength(left, right) {
        return right.score - left.score;
      });
    return candidates.length ? candidates[0].element : null;
  }

  function extractTextBlocks(textRoot) {
    if (!textRoot) {
      return [];
    }
    const rawText =
      typeof textRoot.innerText === "string" && textRoot.innerText
        ? textRoot.innerText
        : utils.textContentWithBreaks(textRoot);
    return utils
      .unique(
        rawText
          .split(/\n+/)
          .map(utils.normalizeWhitespace)
          .filter(Boolean)
      )
      .filter(function removeNoise(line) {
        return line.length > 1;
      });
  }

  function getSourceText(textRoot) {
    return extractTextBlocks(textRoot).join("\n");
  }

  return {
    extractTextBlocks,
    getSourceText,
    isProbablyVisible,
    resolveMainPost,
    resolveTextRoot
  };
});

