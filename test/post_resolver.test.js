const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

global.AtlasTranslate = {};
require("../src/shared/utils.js");
const resolver = require("../src/content/post_resolver.js");

test("resolveMainPost finds main article by tweet status link", () => {
  const dom = new JSDOM(`
    <main>
      <article id="reply">
        <a href="/someone/status/1">reply</a>
        <div data-testid="tweetText">Reply text</div>
      </article>
      <article id="main">
        <a href="/zei_squirrel/status/2028004439957635345">time</a>
        <div data-testid="tweetText">We will not abandon Palestine.</div>
      </article>
    </main>
  `);

  global.window = dom.window;
  global.document = dom.window.document;

  const result = resolver.resolveMainPost(dom.window.document, {
    pathname: "/zei_squirrel/status/2028004439957635345"
  });

  assert.equal(result.article.id, "main");
  assert.equal(result.tweetId, "2028004439957635345");
});

test("extractTextBlocks keeps meaningful lines and removes duplicates", () => {
  const dom = new JSDOM(`
    <div data-testid="tweetText">
      <span>Hello world</span><br>
      <span>Hello world</span><br>
      <span>Second line</span>
    </div>
  `);

  global.window = dom.window;
  global.document = dom.window.document;

  const blocks = resolver.extractTextBlocks(dom.window.document.querySelector("div"));
  assert.deepEqual(blocks, ["Hello world", "Second line"]);
});
