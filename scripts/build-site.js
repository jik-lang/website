const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const pages = ["index.html", "install.html"];

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

for (const pagePath of pages) {
  const absolutePath = path.join(root, pagePath);
  let page = fs.readFileSync(absolutePath, "utf8");

  page = replaceBlock(
    page,
    `${pagePath} header`,
    /    <header class="site-header">[\s\S]*?    <\/header>/,
    header
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
