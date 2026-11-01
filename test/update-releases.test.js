const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { linuxInstallCommands, normalizeRelease, replaceGeneratedBlock, vscodeInstallCommand } = require("../scripts/update-releases");

test("release updates refresh Linux commands and preserve installation instructions", () => {
  const releases = require("./fixtures/github-releases.json");
  const release = normalizeRelease(releases[0]);
  assert.ok(release.assets.linux);
  const page = fs.readFileSync(path.join(__dirname, "../install.html"), "utf8");
  const start = "<!-- RELEASE_LINUX_START -->";
  const end = "<!-- RELEASE_LINUX_END -->";
  const updated = replaceGeneratedBlock(page, start, end, linuxInstallCommands(release.assets.linux));

  assert.ok(updated.includes(release.assets.linux.browser_download_url));
  assert.equal(updated.split(start)[0], page.split(start)[0]);
  assert.equal(updated.split(end)[1], page.split(end)[1]);
  assert.match(updated, /curl --fail -L/);
  assert.match(updated, /--strip-components=1/);
});

test("a release without a Linux archive shows a source-build link", () => {
  const html = linuxInstallCommands(undefined);
  assert.match(html, /No Linux x64 archive/);
  assert.match(html, /href="https:\/\/github.com\/jik-lang\/jik#building-jik-from-source"/);
  assert.doesNotMatch(html, /curl|undefined/);
});

test("release updates use the exact VSIX filename and preserve surrounding instructions", () => {
  const release = normalizeRelease(require("./fixtures/github-releases.json")[0]);
  assert.ok(release.assets.vscode);
  const page = fs.readFileSync(path.join(__dirname, "../install.html"), "utf8");
  const start = "<!-- RELEASE_VSCODE_START -->";
  const end = "<!-- RELEASE_VSCODE_END -->";
  const updated = replaceGeneratedBlock(page, start, end, vscodeInstallCommand(release.assets.vscode));

  assert.ok(updated.includes(`code --install-extension &quot;./${release.assets.vscode.name}&quot;`));
  assert.doesNotMatch(updated, /jik-language-tools-\*\.vsix/);
  assert.equal(updated.split(start)[0], page.split(start)[0]);
  assert.equal(updated.split(end)[1], page.split(end)[1]);
});

test("a release without a VSIX does not generate an installation command", () => {
  const html = vscodeInstallCommand(undefined);
  assert.match(html, /No VS Code extension is available/);
  assert.doesNotMatch(html, /--install-extension|undefined/);
});
