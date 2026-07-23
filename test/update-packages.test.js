const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { parsePackages } = require("../scripts/update-packages");

const fixturePath = path.join(__dirname, "fixtures", "jik-packages-readme.md");
const fixture = fs.readFileSync(fixturePath, "utf8");

test("parses the curated package catalog from the README", () => {
  assert.deepEqual(parsePackages(fixture), [
    {
      name: "argparse",
      packagePath: "packages/argparse",
      description: "command-line argument parser"
    },
    {
      name: "csv",
      packagePath: "packages/csv",
      description: "CSV parser"
    },
    {
      name: "raylib",
      packagePath: "packages/raylib",
      description: "Small 2D raylib wrapper"
    },
    {
      name: "toml",
      packagePath: "packages/toml",
      description: "TOML parser"
    }
  ]);
});

test("discovers a newly added package entry", () => {
  const updatedReadme = fixture.replace(
    "\n## Testing",
    "\n- [`sqlite`](packages/sqlite) - SQLite wrapper\n\n## Testing"
  );

  assert.deepEqual(parsePackages(updatedReadme).at(-1), {
    name: "sqlite",
    packagePath: "packages/sqlite",
    description: "SQLite wrapper"
  });
});

test("rejects malformed package bullets instead of silently dropping them", () => {
  const malformedReadme = fixture.replace(
    "- [`toml`](packages/toml) - TOML parser",
    "- toml - TOML parser"
  );

  assert.throws(
    () => parsePackages(malformedReadme),
    /Malformed package entry/
  );
});
