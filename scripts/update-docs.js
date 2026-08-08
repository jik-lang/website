const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const repo = "jik-lang/jik";
const branch = "main";
const treeUrl = `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`;
const rawBaseUrl = `https://raw.githubusercontent.com/${repo}/${branch}/`;
const githubBlobBaseUrl = `https://github.com/${repo}/blob/${branch}/`;

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function requestText(url, accept = "text/plain") {
  return new Promise((resolve, reject) => {
    const headers = {
      Accept: accept,
      "User-Agent": "jik-web-docs-generator"
    };

    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    https
      .get(url, { headers }, (response) => {
        let body = "";

        response.on("data", (chunk) => {
          body += chunk;
        });

        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`GitHub returned HTTP ${response.statusCode}: ${body}`));
            return;
          }

          resolve(body);
        });
      })
      .on("error", reject);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function slugify(value) {
  const slug = value
    .toLowerCase()
    .replace(/`([^`]+)`/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "section";
}

function uniqueSlug(base, seen) {
  const count = seen.get(base) || 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

function outputPathForSource(sourcePath) {
  const relative = sourcePath.replace(/^docs\//, "").replace(/\.md$/i, ".html");
  return path.posix.join("docs", relative);
}

function sourcePathForLink(currentSourcePath, href) {
  const [withoutHash] = href.split("#");
  const decodedPath = decodeURIComponent(withoutHash);
  const currentDir = path.posix.dirname(currentSourcePath);
  return path.posix.normalize(path.posix.join(currentDir, decodedPath));
}

function relativeOutputLink(currentOutputPath, targetOutputPath, hash = "") {
  const fromDir = path.posix.dirname(currentOutputPath);
  let relative = path.posix.relative(fromDir, targetOutputPath);

  if (!relative.startsWith(".")) {
    relative = `./${relative}`;
  }

  return `${relative}${hash}`;
}

function rewriteHref(currentSourcePath, currentOutputPath, href, knownDocs) {
  if (
    /^(https?:|mailto:|tel:)/i.test(href) ||
    href.startsWith("#") ||
    href.startsWith("/")
  ) {
    return href;
  }

  const hashIndex = href.indexOf("#");
  const hrefPath = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : href.slice(hashIndex);

  if (!/\.md$/i.test(hrefPath)) {
    return href;
  }

  const targetSourcePath = sourcePathForLink(currentSourcePath, hrefPath);
  if (!knownDocs.has(targetSourcePath)) {
    throw new Error(`Broken docs link from ${currentSourcePath} to ${href}`);
  }

  return relativeOutputLink(currentOutputPath, outputPathForSource(targetSourcePath), hash);
}

function inlineMarkdown(text, currentSourcePath, currentOutputPath, knownDocs) {
  const tokens = [];
  const token = (html) => {
    const key = `\u0000${tokens.length}\u0000`;
    tokens.push(html);
    return key;
  };

  let value = text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, src) => {
      const safeAlt = escapeHtml(alt);
      const safeSrc = escapeHtml(src);
      return token(`<img src="${safeSrc}" alt="${safeAlt}">`);
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
      const rewritten = rewriteHref(currentSourcePath, currentOutputPath, href, knownDocs);
      return token(`<a href="${escapeHtml(rewritten)}">${inlineMarkdown(label, currentSourcePath, currentOutputPath, knownDocs)}</a>`);
    })
    .replace(/`([^`]+)`/g, (_match, code) => token(`<code>${escapeHtml(code)}</code>`));

  value = escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");

  tokens.forEach((html, index) => {
    value = value.replaceAll(escapeHtml(`\u0000${index}\u0000`), html);
  });

  return value;
}

function renderParagraph(lines, currentSourcePath, currentOutputPath, knownDocs) {
  const text = lines.join(" ").trim();
  return text ? `<p>${inlineMarkdown(text, currentSourcePath, currentOutputPath, knownDocs)}</p>` : "";
}

function renderList(items, currentSourcePath, currentOutputPath, knownDocs) {
  function renderAt(index, indent, ordered) {
    const tag = ordered ? "ol" : "ul";
    const lines = [`<${tag}>`];

    while (index < items.length) {
      const item = items[index];

      if (item.indent < indent || item.ordered !== ordered) {
        break;
      }

      if (item.indent > indent) {
        break;
      }

      index += 1;
      let content = inlineMarkdown(item.text, currentSourcePath, currentOutputPath, knownDocs);

      while (index < items.length && items[index].indent > indent) {
        const nested = renderAt(index, items[index].indent, items[index].ordered);
        content += `\n${nested.html}`;
        index = nested.index;
      }

      lines.push(`  <li>${content}</li>`);
    }

    lines.push(`</${tag}>`);
    return { html: lines.join("\n"), index };
  }

  if (items.length === 0) {
    return "";
  }

  const blocks = [];
  let index = 0;

  while (index < items.length) {
    const block = renderAt(index, items[index].indent, items[index].ordered);
    blocks.push(block.html);
    index = block.index;
  }

  return blocks.join("\n");
}

function renderMarkdown(markdown, currentSourcePath, currentOutputPath, knownDocs) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  const headingSlugs = new Map();
  let paragraph = [];
  let list = [];
  let inFence = false;
  let fenceLang = "";
  let fenceLines = [];

  function flushParagraph() {
    if (paragraph.length > 0) {
      html.push(renderParagraph(paragraph, currentSourcePath, currentOutputPath, knownDocs));
      paragraph = [];
    }
  }

  function flushList() {
    if (list.length > 0) {
      html.push(renderList(list, currentSourcePath, currentOutputPath, knownDocs));
      list = [];
    }
  }

  for (const line of lines) {
    const fenceMatch = line.match(/^```(.*)$/);
    if (fenceMatch) {
      if (inFence) {
        const className = fenceLang ? ` class="language-${escapeHtml(fenceLang)}"` : "";
        html.push(`<pre><code${className}>${escapeHtml(fenceLines.join("\n"))}</code></pre>`);
        inFence = false;
        fenceLang = "";
        fenceLines = [];
      } else {
        flushParagraph();
        flushList();
        inFence = true;
        fenceLang = fenceMatch[1].trim();
      }
      continue;
    }

    if (inFence) {
      fenceLines.push(line);
      continue;
    }

    if (/^\s*$/.test(line)) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      const rawText = headingMatch[2].replace(/\s+#+$/, "");
      const slug = uniqueSlug(slugify(rawText), headingSlugs);
      html.push(
        `<h${level} id="${escapeHtml(slug)}">${inlineMarkdown(rawText, currentSourcePath, currentOutputPath, knownDocs)}</h${level}>`
      );
      continue;
    }

    const unorderedMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
    const orderedMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    if (unorderedMatch || orderedMatch) {
      flushParagraph();
      const match = unorderedMatch || orderedMatch;
      list.push({
        indent: match[1].replaceAll("\t", "    ").length,
        ordered: Boolean(orderedMatch),
        text: match[2]
      });
      continue;
    }

    const blockquoteMatch = line.match(/^>\s?(.+)$/);
    if (blockquoteMatch) {
      flushParagraph();
      flushList();
      html.push(`<blockquote><p>${inlineMarkdown(blockquoteMatch[1], currentSourcePath, currentOutputPath, knownDocs)}</p></blockquote>`);
      continue;
    }

    const listContinuationMatch = line.match(/^\s{2,}(.+)$/);
    if (listContinuationMatch && list.length > 0) {
      list[list.length - 1].text += ` ${listContinuationMatch[1].trim()}`;
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  if (inFence) {
    throw new Error(`Unclosed code fence in ${currentSourcePath}`);
  }

  flushParagraph();
  flushList();
  return html.join("\n");
}

function titleFromMarkdown(markdown, sourcePath) {
  const match = markdown.match(/^#\s+(.+)$/m);
  if (match) {
    return match[1].replace(/`/g, "").trim();
  }

  return path.basename(sourcePath, ".md").replace(/^\d+-/, "").replace(/-/g, " ");
}

function docsNav(pages, currentOutputPath, indent = "          ") {
  const primarySourcePaths = [
    "docs/index.md",
    "docs/cli.md",
    "docs/grammar.md",
    "docs/known-issues.md",
    "docs/overview/18-standard-library.md",
    "docs/overview.md"
  ];
  const primarySourcePathSet = new Set(primarySourcePaths);

  const visiblePages = pages.filter((page) => {
    if (page.sourcePath.startsWith("docs/jiklib/")) {
      return false;
    }

    return page.sourcePath !== "docs/overview/18-standard-library.md";
  });

  const pageBySourcePath = new Map(pages.map((page) => [page.sourcePath, page]));
  const primaryLinks = primarySourcePaths
    .map((sourcePath) => pageBySourcePath.get(sourcePath))
    .filter(Boolean)
    .map((page) => {
      const title =
        page.sourcePath === "docs/overview/18-standard-library.md"
          ? "Jik Standard Library"
          : page.title;
      return { ...page, title };
    });

  const overviewLinks = visiblePages.filter((page) => !primarySourcePathSet.has(page.sourcePath));

  const links = [...primaryLinks, ...overviewLinks].map((page) => {
    const href = relativeOutputLink(currentOutputPath, page.outputPath);
    const current = page.outputPath === currentOutputPath ? ' aria-current="page"' : "";
    return `${indent}<a href="${escapeHtml(href)}"${current}>${escapeHtml(page.title)}</a>`;
  });

  return links.join("\n");
}

function localizeShellLinks(html, currentOutputPath) {
  return html.replace(/\s(href|src)="([^"]+)"/g, (match, attribute, url) => {
    if (/^(https?:|mailto:|tel:)/i.test(url) || url.startsWith("#") || url.startsWith("/")) {
      return match;
    }

    const hashIndex = url.indexOf("#");
    const urlPath = hashIndex === -1 ? url : url.slice(0, hashIndex);
    const hash = hashIndex === -1 ? "" : url.slice(hashIndex);
    return ` ${attribute}="${escapeHtml(relativeOutputLink(currentOutputPath, urlPath, hash))}"`;
  });
}

function renderPage(page, pages, header, footer) {
  const localizedHeader = localizeShellLinks(header, page.outputPath);
  const localizedFooter = localizeShellLinks(footer, page.outputPath);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(page.title)} - Jik Documentation</title>
  <link rel="stylesheet" href="${escapeHtml(relativeOutputLink(page.outputPath, "styles.css"))}">
</head>
<body>
  <div class="page">
${localizedHeader}

    <main>
      <div class="container docs-layout">
        <aside class="docs-sidebar" aria-label="Documentation">
          <h2>Documentation</h2>
${docsNav(pages, page.outputPath)}
        </aside>
        <details class="docs-mobile-nav">
          <summary>Browse documentation</summary>
          <nav aria-label="Documentation">
${docsNav(pages, page.outputPath, "            ")}
          </nav>
        </details>
        <article class="docs-content">
${page.html}
        </article>
      </div>
    </main>

${localizedFooter}
  </div>
  <script src="${escapeHtml(relativeOutputLink(page.outputPath, "script.js"))}"></script>
</body>
</html>
`;
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8").trimEnd();
}

function cleanGeneratedDocs(directory) {
  if (!fs.existsSync(directory)) {
    return;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      cleanGeneratedDocs(entryPath);
      if (fs.readdirSync(entryPath).length === 0) {
        fs.rmdirSync(entryPath);
      }
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      fs.unlinkSync(entryPath);
    }
  }
}

async function docsFromGitHub() {
  const tree = JSON.parse(await requestText(treeUrl, "application/vnd.github+json"));
  const docs = tree.tree
    .filter((entry) => entry.type === "blob" && /^docs\/.+\.md$/i.test(entry.path))
    .map((entry) => entry.path)
    .sort((left, right) => left.localeCompare(right, "en"));

  const markdownByPath = new Map();
  for (const sourcePath of docs) {
    markdownByPath.set(sourcePath, await requestText(`${rawBaseUrl}${sourcePath}`));
  }

  return markdownByPath;
}

function docsFromDirectory(sourceDirectory) {
  const markdownByPath = new Map();
  const absoluteSource = path.isAbsolute(sourceDirectory)
    ? sourceDirectory
    : path.join(root, sourceDirectory);

  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absoluteEntry = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absoluteEntry);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        const relative = path.relative(absoluteSource, absoluteEntry).replaceAll(path.sep, "/");
        markdownByPath.set(`docs/${relative}`, fs.readFileSync(absoluteEntry, "utf8"));
      }
    }
  }

  walk(absoluteSource);
  return markdownByPath;
}

function sortDocs(left, right) {
  if (left.sourcePath === "docs/index.md") {
    return -1;
  }
  if (right.sourcePath === "docs/index.md") {
    return 1;
  }

  return left.sourcePath.localeCompare(right.sourcePath, "en");
}

async function main() {
  const source = argValue("--source");
  const markdownByPath = source ? docsFromDirectory(source) : await docsFromGitHub();
  const knownDocs = new Set(markdownByPath.keys());
  const header = read("src/partials/header.html");
  const footer = read("src/partials/footer.html");

  const pages = [...markdownByPath.entries()]
    .map(([sourcePath, markdown]) => {
      const outputPath = outputPathForSource(sourcePath);
      return {
        sourcePath,
        outputPath,
        title: titleFromMarkdown(markdown, sourcePath),
        html: renderMarkdown(markdown, sourcePath, outputPath, knownDocs)
      };
    })
    .sort(sortDocs);

  cleanGeneratedDocs(path.join(root, "docs"));

  for (const page of pages) {
    const absoluteOutputPath = path.join(root, page.outputPath);
    fs.mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
    fs.writeFileSync(absoluteOutputPath, renderPage(page, pages, header, footer));
  }

  console.log(`Updated ${pages.length} documentation pages`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { renderMarkdown };
