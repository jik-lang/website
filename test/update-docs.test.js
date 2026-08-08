const assert = require("node:assert/strict");
const test = require("node:test");

const { renderMarkdown } = require("../scripts/update-docs");

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
