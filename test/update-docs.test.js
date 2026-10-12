const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { overviewNavigation, plainText, renderMarkdown, searchSections } = require("../scripts/update-docs");

test("overview navigation follows chapter order and handles the start and end", () => {
  const page = (name, title) => ({ sourcePath: `docs/${name}.md`, outputPath: `docs/${name}.html`, title });
  const overview = page("overview", "Language Overview");
  const first = page("overview/01-introduction", "1. Introduction");
  const middle = page("overview/02-running", "2. Running & Building");
  const last = page("overview/19-library", "19. Standard Library");
  const reference = page("cli", "CLI");
  const pages = [last, reference, middle, overview, first];

  assert.match(overviewNavigation(overview, pages), /href="\.\/overview\/01-introduction.html" rel="next">Start reading:/);
  assert.doesNotMatch(overviewNavigation(first, pages), /Previous:/);
  assert.match(overviewNavigation(first, pages), /Next: 2. Running &amp; Building/);
  assert.match(overviewNavigation(middle, pages), /href="\.\/01-introduction.html" rel="prev"/);
  assert.match(overviewNavigation(middle, pages), /href="\.\/19-library.html" rel="next"/);
  assert.match(overviewNavigation(last, pages), /href="\.\.\/overview.html">Back to Language Overview/);
  assert.doesNotMatch(overviewNavigation(last, pages), /rel="next"/);
  assert.equal(overviewNavigation(reference, pages), "");
  assert.equal(overviewNavigation(overview, [overview]), "");
});

test("generates GitHub source links in development notes and roadmap", () => {
  const markdown = fs.readFileSync(path.join(__dirname, "fixtures/docs/development.md"), "utf8");
  const html = renderMarkdown(markdown, "docs/development.md", "docs/development.html", new Set());

  assert.equal((html.match(/href="https:\/\/github\.com\/jik-lang\/jik\/tree\/main\/src\/bootstrap\/"/g) || []).length, 2);
  assert.doesNotMatch(html, /href="\.\.\/src\//);
});

test("resolves repository links from nested docs and preserves anchors", () => {
  const html = renderMarkdown(
    "[source](../../src/bootstrap/main.jik#L1) [readme](../../README.md#quick-start)",
    "docs/overview/guide.md",
    "docs/overview/guide.html",
    new Set()
  );

  assert.match(html, /href="https:\/\/github\.com\/jik-lang\/jik\/blob\/main\/src\/bootstrap\/main\.jik#L1"/);
  assert.match(html, /href="https:\/\/github\.com\/jik-lang\/jik\/blob\/main\/README\.md#quick-start"/);
});

test("keeps documentation links local and still rejects missing docs", () => {
  const knownDocs = new Set(["docs/overview.md"]);
  const html = renderMarkdown(
    "[overview](../overview.md#regions) [section](#local) [website](https://jik-lang.org/)",
    "docs/overview/guide.md",
    "docs/overview/guide.html",
    knownDocs
  );

  assert.match(html, /href="\.\.\/overview\.html#regions"/);
  assert.match(html, /href="#local"/);
  assert.match(html, /href="https:\/\/jik-lang\.org\/"/);
  assert.throws(
    () => renderMarkdown("[missing](missing.md)", "docs/index.md", "docs/index.html", knownDocs),
    /Broken docs link/
  );
});

test("keeps indented continuation lines in their list item", () => {
  const html = renderMarkdown(
    `## Limitations

- Generated C relies on GNU-compatible extensions for vector
  repeat-initializers of the form \`[n of expr]\`.
- Compiler command paths may construct shell commands for host tool
  execution.`,
    "docs/known-issues.md",
    "docs/known-issues.html",
    new Set(["docs/known-issues.md"])
  );

  assert.match(html, /<li>Generated C relies on GNU-compatible extensions for vector repeat-initializers of the form <code>\[n of expr\]<\/code>\.<\/li>/);
  assert.match(html, /<li>Compiler command paths may construct shell commands for host tool execution\.<\/li>/);
  assert.doesNotMatch(html, /<p>repeat-initializers/);
  assert.doesNotMatch(html, /<p>execution\.<\/p>/);
});

test("creates searchable plain text from rendered documentation", () => {
  assert.equal(plainText('<h2>Using <code>try</code></h2><p>Handle &amp; propagate failures.</p>'), "Using try Handle & propagate failures.");
});

test("indexes documentation sections with their heading anchors", () => {
  assert.deepEqual(
    searchSections({
      title: "Guide",
      outputPath: "docs/guide.html",
      html: '<h1 id="guide">Guide</h1><p>Introduction.</p><h2 id="regions">Regions</h2><p>Regions own data.</p><h2 id="errors">Errors</h2><p>Failures are explicit.</p>'
    }),
    [
      { title: "Guide: Regions", heading: "Regions", url: "guide.html#regions", text: "Regions Regions own data." },
      { title: "Guide: Errors", heading: "Errors", url: "guide.html#errors", text: "Errors Failures are explicit." }
    ]
  );
});
