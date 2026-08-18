const assert = require("node:assert/strict");
const test = require("node:test");

const { plainText, renderMarkdown, searchSections } = require("../scripts/update-docs");

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
