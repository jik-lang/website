const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8").trimEnd();
}

function replaceBlock(page, name, pattern, replacement) {
  if (!pattern.test(page)) {
    throw new Error(`Could not find ${name} block`);
  }

  return page.replace(pattern, replacement);
}

const header = read("src/partials/header.html");
const footer = read("src/partials/footer.html");

function localizeHeaderPaths(shell, pagePath) {
  const fromDirectory = path.dirname(pagePath);

  return shell.replace(/\s(href|src)="([^"]+)"/g, (match, attribute, url) => {
    if (/^(https?:|mailto:|tel:)/i.test(url) || url.startsWith("#") || url.startsWith("/")) {
      return match;
    }

    const hashIndex = url.indexOf("#");
    const urlPath = hashIndex === -1 ? url : url.slice(0, hashIndex);
    const hash = hashIndex === -1 ? "" : url.slice(hashIndex);
    const relativeUrlPath = path.posix.relative(fromDirectory.replaceAll(path.sep, "/"), urlPath) || ".";
    return ` ${attribute}="${relativeUrlPath}${hash}"`;
  });
}

function htmlFilesIn(directory) {
  const entries = fs.readdirSync(path.join(root, directory), { withFileTypes: true });
  return entries.flatMap((entry) => {
    const relativePath = path.join(directory, entry.name);
    return entry.isDirectory()
      ? htmlFilesIn(relativePath)
      : entry.isFile() && entry.name.endsWith(".html")
        ? [relativePath]
        : [];
  });
}

const pages = [
  ...fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => entry.name),
  ...htmlFilesIn("news"),
];

for (const pagePath of pages) {
  const absolutePath = path.join(root, pagePath);
  let page = fs.readFileSync(absolutePath, "utf8");

  page = replaceBlock(
    page,
    `${pagePath} header`,
    /    <header class="site-header">[\s\S]*?    <\/header>/,
    localizeHeaderPaths(header, pagePath)
  );

  page = replaceBlock(
    page,
    `${pagePath} footer`,
    /    <footer class="site-footer">[\s\S]*?    <\/footer>/,
    footer
  );

  fs.writeFileSync(absolutePath, page);
  console.log(`Built ${pagePath}`);
}

for (const pagePath of htmlFilesIn("docs")) {
  const absolutePath = path.join(root, pagePath);
  let page = fs.readFileSync(absolutePath, "utf8");

  page = replaceBlock(
    page,
    `${pagePath} header`,
    /    <header class="site-header">[\s\S]*?    <\/header>/,
    localizeHeaderPaths(header, pagePath)
  );

  page = replaceBlock(
    page,
    `${pagePath} footer`,
    /    <footer class="site-footer">[\s\S]*?    <\/footer>/,
    footer
  );

  fs.writeFileSync(absolutePath, page);
  console.log(`Built ${pagePath}`);
}
