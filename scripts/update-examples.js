const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const groups = {
  "Language examples": {
    hello: "Hello, world", values: "Values", functions: "Functions",
    control_flow: "Control flow", cl_args: "Command-line arguments",
    strings: "Strings", vectors: "Vectors", structs: "Structs",
    options: "Options", dictionaries: "Dictionaries", enum_match: "Enums",
    variants: "Variants", tables: "Tables", region_ergonomics: "Region allocation",
    regions_copy: "Copying between regions", error_handling: "Error handling",
    "modules/main": "Modules", testing_demo: "Testing", ffi_demo: "Calling C"
  },
  "Standard-library examples": {
    filesystem: "Filesystem", binary_data: "Binary data", strbuf_demo: "String buffers",
    text_processing: "Text processing", argparse_demo: "Argument parsing",
    process_capture: "Child processes"
  },
  "Algorithms and larger programs": {
    fib: "Fibonacci", primes: "Prime numbers", word_count: "Word count",
    newton: "Newton's method", dijkstra: "Shortest paths",
    game_of_life: "Game of Life", forth: "Forth interpreter"
  }
};
const notes = {
  "modules/main": "Keep main.jik and stats.jik together in the modules directory.",
  word_count: "To read a file, build this example and pass a file path to the executable.",
  cl_args: "Build this example and pass arguments to the executable to see them printed.",
  argparse_demo: "Run without arguments for help. To supply arguments, build it and run the executable.",
  process_capture: "Run from the compiler repository root; this example starts the local Jik executable.",
  game_of_life: "Runs an animation in your terminal. Press Ctrl+C to stop.",
  forth: "Starts an interactive Forth interpreter in your terminal."
};

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

async function request(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "jik-website" }, signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response;
}

async function loadSources(source) {
  if (source) {
    const directory = path.resolve(source);
    function walk(folder) {
      return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
        const file = path.join(folder, entry.name);
        return entry.isDirectory() ? walk(file) : entry.name.endsWith(".jik") ? [file] : [];
      });
    }
    return new Map(walk(directory).map((file) => [
      path.relative(directory, file).replaceAll(path.sep, "/"), fs.readFileSync(file, "utf8")
    ]));
  }
  const tree = await (await request("https://api.github.com/repos/jik-lang/jik/git/trees/main?recursive=1")).json();
  if (tree.truncated) throw new Error("GitHub returned an incomplete source tree");
  const files = tree.tree.filter((entry) => entry.type === "blob" && /^examples\/.*\.jik$/.test(entry.path));
  return new Map(await Promise.all(files.map(async (file) => [
    file.path.slice("examples/".length),
    await (await request(`https://raw.githubusercontent.com/jik-lang/jik/${tree.sha}/${file.path}`)).text()
  ])));
}

async function main() {
  const sourceIndex = process.argv.indexOf("--source");
  if (sourceIndex !== -1 && !process.argv[sourceIndex + 1]) throw new Error("--source needs an examples directory");
  const sources = await loadSources(sourceIndex === -1 ? null : process.argv[sourceIndex + 1]);
  if (!sources.has("hello.jik")) throw new Error("Examples source is missing hello.jik");
  const remaining = new Set(sources.keys());
  const catalog = Object.entries(groups).map(([name, entries]) => ({
    name,
    entries: Object.entries(entries).filter(([id]) => sources.has(`${id}.jik`)).map(([id, title]) => {
      remaining.delete(`${id}.jik`);
      return { id, title };
    })
  }));
  remaining.delete("modules/stats.jik");
  if (remaining.size) catalog.push({ name: "More examples", entries: [...remaining].sort().map((file) => ({ id: file.slice(0, -4), title: file })) });

  const list = catalog.filter((group) => group.entries.length).map((group) => `
            <div class="examples-group">
              <h2>${escapeHtml(group.name)}</h2>
              ${group.entries.map(({ id, title }) => `<a href="#${id}">${escapeHtml(title)}</a>`).join("\n              ")}
            </div>`).join("");
  const options = catalog.filter((group) => group.entries.length).map((group) => `<optgroup label="${escapeHtml(group.name)}">${group.entries.map(({ id, title }) => `<option value="${id}">${escapeHtml(title)}</option>`).join("")}</optgroup>`).join("\n");
  const articles = catalog.flatMap((group) => group.entries).map(({ id }) => {
    const filename = `${id}.jik`;
    const filenames = id === "modules/main"
      ? ["modules/main.jik", "modules/stats.jik"]
      : [filename];
    const fileHeading = filenames.length === 1
      ? `<h2>${filename}</h2>`
      : `<select class="source-file-select" aria-label="Source file" hidden>
                  ${filenames.map((file) => `<option value="${file}">${path.basename(file)}</option>`).join("\n                  ")}
                </select>
                <noscript><h2>${filename}</h2></noscript>`;
    const sourceFiles = filenames.map((file, index) => {
      const source = sources.get(file).replaceAll("\r\n", "\n").replace(/[ \t]+$/gm, "");
      return `<pre class="code-block source-file" data-source-file="${file}" tabindex="0" aria-label="${file} source"${index ? " hidden" : ""}><code class="language-jik">${escapeHtml(source)}</code></pre>`;
    }).join("\n              ");
    return `
          <article id="${id}" class="source-example" aria-label="${filename}">
            <div class="example-panel">
              <div class="source-toolbar">
                ${fileHeading}
                <div class="source-actions">
                  <button type="button" class="source-copy" hidden>Copy</button>
                </div>
              </div>
              ${sourceFiles}
            </div>
            <p class="source-run"><code>jik run examples/${filename}</code></p>${notes[id] ? `
            <p class="source-note">${notes[id]}</p>` : ""}
          </article>`;
  }).join("\n");
  const read = (file) => fs.readFileSync(path.join(root, file), "utf8").trimEnd();
  const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Examples - Jik</title>
    <meta name="description" content="Learn Jik through complete examples arranged from language basics to standard-library tasks and larger programs.">
    <link rel="stylesheet" href="styles.css">
  </head>
  <body class="examples-page">
${read("src/partials/header.html")}
    <main>
      <div class="container page-title">
        <h1>Examples</h1>
        <p>Start with the first language examples and work down for a natural tour of Jik, or jump directly to a topic. For detailed explanations, see the <a href="docs/overview.html">documentation</a>.</p>
        <p class="examples-github-link"><a href="https://github.com/jik-lang/jik/tree/main/examples">View all examples on GitHub</a></p>
      </div>
      <div class="container examples-browser">
        <nav class="examples-nav" aria-label="Examples">${list}
        </nav>
        <div class="examples-mobile" hidden>
          <label class="screen-reader-text" for="source-select">Choose an example</label>
          <select id="source-select">${options}</select>
        </div>
        <div class="examples-content">${articles}
          <span class="screen-reader-text" id="source-feedback" role="status"></span>
        </div>
      </div>
    </main>
${read("src/partials/footer.html")}
    <script src="script.js"></script>
    <script src="examples.js"></script>
  </body>
</html>
`;
  fs.writeFileSync(path.join(root, "examples.html"), page);
  console.log(`Updated examples.html with ${sources.size} source files`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
