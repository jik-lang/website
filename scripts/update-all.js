const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function run(label, script, args = []) {
  console.log(`\nUpdating ${label}...`);

  const result = spawnSync(process.execPath, [path.join("scripts", script), ...args], {
    cwd: root,
    stdio: "inherit"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

const docsSource = argValue("--docs-source");
const releasesSource = argValue("--releases-source");
const packagesSource = argValue("--packages-source");

run("documentation", "update-docs.js", docsSource ? ["--source", docsSource] : []);
run("releases", "update-releases.js", releasesSource ? ["--source", releasesSource] : []);
run("packages", "update-packages.js", packagesSource ? ["--source", packagesSource] : []);

console.log("\nUpdated documentation, releases, and packages");
