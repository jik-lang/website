const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const releasesUrl = "https://api.github.com/repos/jik-lang/jik/releases";

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function readJson(relativeOrAbsolutePath) {
  const filePath = path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.join(root, relativeOrAbsolutePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": "jik-web-release-generator"
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

          resolve(JSON.parse(body));
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

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(value));
}

function findAsset(assets, matcher) {
  return assets.find((asset) => matcher(asset.name || ""));
}

function normalizeRelease(release) {
  const assets = release.assets || [];

  return {
    tag: release.tag_name,
    publishedAt: release.published_at || release.created_at,
    notesUrl: release.html_url,
    assets: {
      windows: findAsset(
        assets,
        (name) => /\.zip$/i.test(name) && /(windows|win)/i.test(name) && /(x64|amd64)/i.test(name)
      ),
      linux: findAsset(
        assets,
        (name) => /\.tar\.gz$/i.test(name) && /linux/i.test(name) && /(x64|amd64)/i.test(name)
      ),
      vscode: findAsset(assets, (name) => /\.vsix$/i.test(name))
    }
  };
}

function downloadLink(asset, label, indent) {
  if (!asset) {
    return null;
  }

  return `${indent}<a href="${escapeHtml(asset.browser_download_url)}">${label}</a>`;
}

function latestReleaseCard(release, options = {}) {
  const indent = " ".repeat(options.indent || 10);
  const links = [
    downloadLink(release.assets.windows, "Windows x64 ZIP", `${indent}    `),
    downloadLink(release.assets.linux, "Linux x64 tar.gz", `${indent}    `),
    downloadLink(release.assets.vscode, "VS Code extension VSIX", `${indent}    `)
  ].filter(Boolean);

  const downloadGrid =
    links.length > 0
      ? [
          `${indent}  <div class="download-grid">`,
          ...links,
          `${indent}  </div>`
        ]
      : [`${indent}  <p>No matching release assets found.</p>`];

  return [
    `${indent}<article class="release-card latest-release">`,
    `${indent}  <div class="release-head">`,
    `${indent}    <div>`,
    `${indent}      <h3>${escapeHtml(release.tag)}</h3>`,
    `${indent}      <p>Published ${escapeHtml(formatDate(release.publishedAt))}</p>`,
    `${indent}    </div>`,
    `${indent}    <a class="release-link" href="${escapeHtml(release.notesUrl)}">Release notes</a>`,
    `${indent}  </div>`,
    ...downloadGrid,
    `${indent}</article>`
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
  const rawReleases = source ? readJson(source) : await fetchJson(releasesUrl);

  const releases = rawReleases
    .filter((release) => !release.draft)
    .map(normalizeRelease)
    .filter((release) => release.tag && release.publishedAt && release.notesUrl)
    .sort((left, right) => new Date(right.publishedAt) - new Date(left.publishedAt));

  if (releases.length === 0) {
    throw new Error("No publishable releases found");
  }

  const installPath = path.join(root, "install.html");
  let installPage = fs.readFileSync(installPath, "utf8");

  installPage = replaceGeneratedBlock(
    installPage,
    "<!-- RELEASE_LATEST_START -->",
    "<!-- RELEASE_LATEST_END -->",
    latestReleaseCard(releases[0], { indent: 8 })
  );

  fs.writeFileSync(installPath, installPage);
  console.log(`Updated install.html with latest release ${releases[0].tag}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
