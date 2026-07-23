const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const repo = "jik-lang/jik-packages";
const branch = "main";
const readmeUrl = `https://raw.githubusercontent.com/${repo}/${branch}/README.md`;
const packageBaseUrl = `https://github.com/${repo}/tree/${branch}/`;

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function requestText(url) {
  return new Promise((resolve, reject) => {
    const headers = {
      Accept: "text/plain",
      "User-Agent": "jik-web-package-generator"
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

function parsePackages(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const sectionStart = lines.findIndex((line) => /^##\s+Packages\s*$/i.test(line));

  if (sectionStart === -1) {
    throw new Error('Could not find a "## Packages" section in the package README');
  }

  const sectionEnd = lines.findIndex(
    (line, index) => index > sectionStart && /^##\s+\S/.test(line)
  );
  const sectionLines = lines.slice(
    sectionStart + 1,
    sectionEnd === -1 ? lines.length : sectionEnd
  );
  const packages = [];
  const names = new Set();
  const itemPattern =
    /^\s*[-*]\s+\[(`?)([^`\]]+)\1\]\(([^)\s]+)\)\s+(?:-|\u2013|\u2014)\s+(.+?)\s*$/;

  for (const line of sectionLines) {
    const match = line.match(itemPattern);

    if (!match) {
      if (/^\s*[-*]\s+/.test(line)) {
        throw new Error(`Malformed package entry in README: ${line.trim()}`);
      }
      continue;
    }

    const name = match[2].trim();
    const packagePath = match[3].replace(/^\.\//, "");
    const description = match[4].trim();

    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(name)) {
      throw new Error(`Invalid package name in README: ${name}`);
    }

    if (!/^packages\/[a-z0-9][a-z0-9._-]*$/i.test(packagePath)) {
      throw new Error(`Invalid package path in README for ${name}: ${match[3]}`);
    }

    if (packagePath.slice("packages/".length) !== name) {
      throw new Error(`Package name and path do not match in README: ${name}, ${packagePath}`);
    }

    if (names.has(name)) {
      throw new Error(`Duplicate package in README: ${name}`);
    }

    names.add(name);
    packages.push({ name, packagePath, description });
  }

  if (packages.length === 0) {
    throw new Error('No package entries found in the README "## Packages" section');
  }

  return packages;
}

function packageListItem(packageInfo) {
  const urlPath = packageInfo.packagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return [
    "          <li>",
    `            <a href="${packageBaseUrl}${urlPath}">${escapeHtml(packageInfo.name)}</a>`,
    `            <span>${escapeHtml(packageInfo.description)}</span>`,
    "          </li>"
  ].join("\n");
}

function replaceGeneratedBlock(page, startMarker, endMarker, content) {
  const escapedStart = startMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedEnd = endMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(^[ \\t]*${escapedStart})[\\s\\S]*?(^[ \\t]*${escapedEnd})`,
    "m"
  );

  if (!pattern.test(page)) {
    throw new Error(`Could not find generated block: ${startMarker}`);
  }

  return page.replace(pattern, `$1\n${content}\n$2`);
}

async function main() {
  const source = argValue("--source");
  const markdown = source
    ? fs.readFileSync(path.isAbsolute(source) ? source : path.join(root, source), "utf8")
    : await requestText(readmeUrl);
  const packages = parsePackages(markdown);
  const packagesPath = path.join(root, "packages.html");
  let packagesPage = fs.readFileSync(packagesPath, "utf8");

  packagesPage = replaceGeneratedBlock(
    packagesPage,
    "<!-- PACKAGE_LIST_START -->",
    "<!-- PACKAGE_LIST_END -->",
    packages.map(packageListItem).join("\n")
  );

  fs.writeFileSync(packagesPath, packagesPage);
  console.log(`Updated packages.html with ${packages.length} packages`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { parsePackages };
