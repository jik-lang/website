const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const siteDirectories = ["docs", "news"];

function htmlFilesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return htmlFilesIn(entryPath);
    }
    return entry.isFile() && entry.name.endsWith(".html") ? [entryPath] : [];
  });
}

function localTarget(fromFile, href) {
  const [pathAndQuery, hash = ""] = href.split("#", 2);
  const hrefPath = pathAndQuery.split("?", 1)[0];
  if (!hrefPath) {
    return { file: fromFile, hash };
  }

  const decodedPath = decodeURIComponent(hrefPath);
  const resolved = decodedPath.startsWith("/")
    ? path.join(root, decodedPath.slice(1))
    : path.resolve(path.dirname(fromFile), decodedPath);
  return {
    file: decodedPath.endsWith("/") ? path.join(resolved, "index.html") : resolved,
    hash
  };
}

test("all internal HTML links, assets, and anchors resolve", () => {
  const rootPages = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => path.join(root, entry.name));
  const pages = [
    ...rootPages,
    ...siteDirectories.flatMap((directory) => htmlFilesIn(path.join(root, directory)))
  ];
  const failures = [];

  for (const page of pages) {
    const html = fs.readFileSync(page, "utf8");
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const reference = match[1].replaceAll("&amp;", "&");
      if (/^(?:https?:|mailto:|tel:|javascript:|data:)/i.test(reference)) {
        continue;
      }

      const target = localTarget(page, reference);
      const relativePage = path.relative(root, page);
      const relativeTarget = path.relative(root, target.file);
      if (!fs.existsSync(target.file) || !fs.statSync(target.file).isFile()) {
        failures.push(`${relativePage}: ${reference} (missing ${relativeTarget})`);
        continue;
      }

      if (target.hash && path.extname(target.file).toLowerCase() === ".html") {
        const targetHtml = fs.readFileSync(target.file, "utf8");
        const id = decodeURIComponent(target.hash).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (!new RegExp(`id=["']${id}["']`).test(targetHtml)) {
          failures.push(`${relativePage}: ${reference} (missing anchor)`);
        }
      }
    }
  }

  assert.deepEqual(failures, []);
});
