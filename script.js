const homepageExamples = {
  cli: {
    selectLabel: "Standard library",
    eyebrow: "Practical standard library",
    title: "Useful building blocks come included",
    description: "Jik's standard library provides practical building blocks for everyday programs.",
    benefits: [
      "Strings, bytes, files, and paths",
      "Processes, argument parsing, and system utilities",
      "Math, randomness, and testing"
    ],
    docsHref: "docs/overview/18-standard-library.html",
    docsLabel: "Explore standard library",
    code: `use "jik/argparse"

func main(args: Vec[String]):
    parser := argparse::new("greet")
    parser.add_positional("name", "Person to greet.")
    parser.add_option("--formal", "-f", "Use a formal greeting.")

    try parsed := parser.parse(args[1:]):
        name := parsed.positionals["name"]?
        formal := parsed.options["--formal"] is Some
        if formal:
            println("Good day, ", name, ".")
        else:
            println("Hello, ", name, "!")
        end
    except:
        println(error_msg())
        println(parser.format_help())
    end
end`
  },

  errors: {
    selectLabel: "Error handling",
    eyebrow: "Explicit failure control",
    title: "Make failure paths explicit",
    description: "Throwing functions distinguish expected failure from successful results. Callers can propagate errors, require success, or recover locally.",
    benefits: [
      "Failure is part of a function's contract",
      "Propagate with try or require success with must",
      "Handle failures where you can decide what happens next"
    ],
    docsHref: "docs/overview/15-error-handling.html",
    docsLabel: "Explore error handling",
    code: `use "jik/io"
use "jik/string"

throws func parse_port(text):
    port := try string::to_int(text)
    if port < 1 or port > 65535:
        fail("port must be between 1 and 65535")
    end
    return port
end

throws func load_port(path):
    text := try io::read_file(path)
    port := try parse_port(string::trim(text))
    return port
end

func main():
    fallback := must parse_port("8080")

    try port := load_port("server.port"):
        println("listening on ", port)
    except:
        println(error_msg(), "; using port ", fallback)
    end
end`
  },

  variants: {
    selectLabel: "Variants and match",
    eyebrow: "Exhaustive state handling",
    title: "Model states without invalid combinations",
    description: "Variants keep each case together with exactly the payload it permits. Exhaustive matching handles every case and binds its payload to the correct concrete type, while tag checks and tag extraction support targeted handling.",
    benefits: [
      "Exhaustive handling enforced by the compiler",
      "Each case binds its concrete payload type",
      "Direct tag checks when full dispatch is unnecessary"
    ],
    docsHref: "docs/overview/11-variants.html",
    docsLabel: "Explore variants",
    code: `variant Message:
    TEXT: String
    DATA: Vec[int]
    CLOSED
end

func handle(message: Message):
    match message:
        case Message.TEXT{text}:
            println("text: ", text)
        case Message.DATA{values}:
            println(values.len(), " values")
        case Message.CLOSED:
            println("connection closed")
    end
end

func main():
    message := Message.DATA{[10, 20, 30]}
    handle(message)

    if message is Message.DATA:
        values := message[Message.DATA]
        println("first value: ", values[0])
    end
end`
  },

  regions: {
    selectLabel: "Caller-owned results",
    eyebrow: "Region-based memory",
    title: "Control lifetimes without managing every allocation",
    description: "Functions can place returned data directly in a caller-selected region. Temporary values are freed together when the function returns, and compiler checks prevent references from outliving their data.",
    benefits: [
      "Caller-controlled result lifetimes",
      "Bulk reclamation without garbage collection",
      "Compiler-checked references between regions"
    ],
    docsHref: "docs/overview/08-memory-management.html",
    docsLabel: "How regions work",
    code: `use "jik/string"

func hyphenate(text: String, r: Region) -> String:
    // r is selected by the caller
    words := string::split(text, " ", _)
    return string::join(words, "-", r)
end

func main():
    // _ is this function's local region: created on entry
    // and destroyed when main returns.
    label := hyphenate("region based memory", _)
    println(label)
end`
  },

  inference: {
    selectLabel: "Type inference",
    eyebrow: "Static types without repetition",
    title: "Static types without repetitive annotations",
    description: "Type annotations on ordinary function parameters and return values are optional. Jik can infer concrete types from literals, operations, and call sites while still checking every value at compile time.",
    benefits: [
      "Infer function types when context is sufficient",
      "Add annotations at library boundaries",
      "Specify element types for empty collections"
    ],
    docsHref: "docs/overview/04-basic-syntax-and-structure.html#4-1-functions",
    docsLabel: "More on defining functions",
    code: `func fahrenheit(celsius, r):
    result: Vec[double][r]
    for value in celsius:
        result.push(value * 1.8 + 32.0)
    end
    return result
end

func main():
    values := fahrenheit([0.0, 20.0, 37.0], _)
    println(values)
end`
  }
};

const homepageExampleOrder = ["regions", "inference", "cli", "variants", "errors"];

const tokenPatterns = [
  ["tok-annotation", /^@[A-Za-z_][A-Za-z0-9_]*(\{[A-Za-z_][A-Za-z0-9_]*\})?/],
  ["tok-type", /^(void|bool|char|int|double|String|Region|Site|Vec|Dict|Option|Result)\b/],
  ["tok-keyword", /^(func|struct|enum|variant|if|elif|else|while|for|in|end|return|of|this|break|continue|use|as|true|false|and|or|not|extern|init|hints|must|try|except|throws|foreign|is|match|case)\b/],
  ["tok-builtin", /^(print|println|concat|copy|assert|push|pop|len|clear|site|site_file|site_line|site_code|fail|error_msg|error_code)\b(?=\s*\()/],
  ["tok-number", /^\d+(?:\.\d+)?\b/],
  ["tok-constant", /^[A-Z][A-Z0-9_]*\b/]
];

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function span(className, value) {
  return `<span class="${className}">${escapeHtml(value)}</span>`;
}

function readString(source, start) {
  const quote = source[start];
  let index = start + 1;

  while (index < source.length) {
    if (source[index] === "\\") {
      index += 2;
      continue;
    }
    if (source[index] === quote) {
      index += 1;
      break;
    }
    index += 1;
  }

  return source.slice(start, index);
}

function highlightLine(line) {
  let html = "";
  let index = 0;

  while (index < line.length) {
    const rest = line.slice(index);

    if (rest.startsWith("//")) {
      html += span("tok-comment", rest);
      break;
    }

    if (rest[0] === '"' || rest[0] === "'") {
      html += span("tok-string", readString(line, index));
      index += readString(line, index).length;
      continue;
    }

    const moduleMatch = rest.match(/^([A-Za-z_][A-Za-z0-9_]*)(::)([A-Za-z_][A-Za-z0-9_]*)?/);
    if (moduleMatch) {
      html += span("tok-namespace", moduleMatch[1]);
      html += span("tok-accessor", moduleMatch[2]);
      if (moduleMatch[3]) {
        html += span("tok-function", moduleMatch[3]);
      }
      index += moduleMatch[0].length;
      continue;
    }

    const memberCallMatch = rest.match(/^(\.)([A-Za-z_][A-Za-z0-9_]*)(?=\s*\()/);
    if (memberCallMatch) {
      html += span("tok-accessor", memberCallMatch[1]);
      html += span("tok-function", memberCallMatch[2]);
      index += memberCallMatch[0].length;
      continue;
    }

    const functionDef = rest.match(/^func\s+([A-Za-z_][A-Za-z0-9_]*)/);
    if (functionDef) {
      html += span("tok-keyword", "func");
      html += escapeHtml(rest.slice(4, functionDef[0].length - functionDef[1].length));
      html += span("tok-function", functionDef[1]);
      index += functionDef[0].length;
      continue;
    }

    const typeDef = rest.match(/^(struct|enum|variant)\s+([A-Za-z_][A-Za-z0-9_]*)/);
    if (typeDef) {
      html += span("tok-keyword", typeDef[1]);
      html += escapeHtml(rest.slice(typeDef[1].length, typeDef[0].length - typeDef[2].length));
      html += span("tok-type", typeDef[2]);
      index += typeDef[0].length;
      continue;
    }

    let matched = false;
    for (const [className, pattern] of tokenPatterns) {
      const token = rest.match(pattern);
      if (token) {
        html += span(className, token[0]);
        index += token[0].length;
        matched = true;
        break;
      }
    }

    if (matched) {
      continue;
    }

    const identifier = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (identifier) {
      html += escapeHtml(identifier[0]);
      index += identifier[0].length;
      continue;
    }

    html += escapeHtml(rest[0]);
    index += 1;
  }

  return html;
}

function highlightJik(source) {
  return source.split("\n").map(highlightLine).join("\n");
}

const select = document.querySelector("#example-select");
const code = document.querySelector("#example-code");
const exampleEyebrow = document.querySelector("#example-eyebrow");
const exampleTitle = document.querySelector("#example-title");
const exampleDescription = document.querySelector("#example-description");
const exampleBenefits = document.querySelector("#example-benefits");
const exampleDocsLink = document.querySelector("#example-docs-link");
const copyExample = document.querySelector("#copy-example");
const copyFeedback = document.querySelector("#copy-feedback");
let copyResetTimer;

function populateExampleSelect() {
  select.replaceChildren(
    ...homepageExampleOrder.map((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = homepageExamples[name].selectLabel;
      return option;
    })
  );
}

function renderExample(name) {
  const example = homepageExamples[name];

  if (!example) {
    return;
  }

  code.innerHTML = highlightJik(example.code);
  exampleEyebrow.textContent = example.eyebrow;
  exampleTitle.textContent = example.title;
  exampleDescription.textContent = example.description;
  exampleBenefits.replaceChildren(
    ...example.benefits.map((benefit) => {
      const item = document.createElement("li");
      item.textContent = benefit;
      return item;
    })
  );
  exampleDocsLink.href = example.docsHref;
  exampleDocsLink.innerHTML = `${example.docsLabel} <span aria-hidden="true">&rarr;</span>`;
}

function resetCopyFeedback() {
  clearTimeout(copyResetTimer);
  copyExample.setAttribute("aria-label", "Copy current example");
  copyFeedback.textContent = "";
}

if (select && code && exampleEyebrow && exampleTitle && exampleDescription && exampleBenefits && exampleDocsLink) {
  populateExampleSelect();
  select.addEventListener("change", () => {
    if (copyExample && copyFeedback) {
      resetCopyFeedback();
    }
    renderExample(select.value);
  });
  renderExample(select.value);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.append(textArea);
    textArea.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      textArea.remove();
    }
  }
}

function showCopyResult(feedback, copied) {
  copyExample.setAttribute("aria-label", copied ? "Example copied" : "Could not copy example");
  copyFeedback.textContent = feedback;
  clearTimeout(copyResetTimer);
  copyResetTimer = setTimeout(() => {
    resetCopyFeedback();
  }, 2000);
}

if (select && copyExample && copyFeedback) {
  copyExample.addEventListener("click", async () => {
    const example = homepageExamples[select.value];
    if (!example) {
      return;
    }

    const copied = await copyToClipboard(example.code);
    showCopyResult(
      copied ? "Example copied to the clipboard." : "Could not copy the example to the clipboard.",
      copied
    );
  });
}

document.querySelectorAll("code.language-jik").forEach((block) => {
  if (block.id !== "example-code") {
    block.innerHTML = highlightJik(block.textContent);
  }
});

const introLogo = document.querySelector(".home-page .intro-logo");

if (introLogo) {
  const observer = new IntersectionObserver(([entry]) => {
    document.body.classList.toggle("header-logo-visible", !entry.isIntersecting);
  });

  observer.observe(introLogo);
}

const docsSearchInputs = document.querySelectorAll(".docs-search-input");
const docsSearchIndex = window.jikDocsSearchIndex || [];

function docsSearchExcerpt(text, terms) {
  const lowerText = text.toLowerCase();
  const matchIndex = Math.max(...terms.map((term) => lowerText.indexOf(term)));
  const start = Math.max(0, matchIndex - 58);
  const end = Math.min(text.length, matchIndex + 142);
  return `${start ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

function appendDocsSearchHighlight(element, text, terms, className = "") {
  const pattern = new RegExp(
    terms
      .slice()
      .sort((left, right) => right.length - left.length)
      .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|"),
    "gi"
  );
  let cursor = 0;
  let match;

  while ((match = pattern.exec(text))) {
    element.append(document.createTextNode(text.slice(cursor, match.index)));
    const highlight = document.createElement("mark");
    highlight.className = className;
    highlight.textContent = match[0];
    element.append(highlight);
    cursor = match.index + match[0].length;
  }

  element.append(document.createTextNode(text.slice(cursor)));
}

function docsSearchTermCount(text, term) {
  let count = 0;
  let index = text.indexOf(term);
  while (index !== -1) {
    count += 1;
    index = text.indexOf(term, index + term.length);
  }
  return count;
}

function docsSearchScore(page, terms) {
  const heading = (page.heading || "").toLowerCase();
  const text = page.text.toLowerCase();

  return terms.reduce((score, term) => {
    return score +
      (heading.includes(term) ? 100 : 0) +
      docsSearchTermCount(text, term);
  }, 0);
}

function renderDocsSearch(input, pages) {
  const results = input.parentElement.querySelector(".docs-search-results");
  const terms = input.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  results.replaceChildren();

  if (!terms.length) {
    return;
  }

  const matches = pages
    .filter((page) => {
      const haystack = `${page.title} ${page.heading || ""} ${page.text}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    })
    .sort((left, right) => docsSearchScore(right, terms) - docsSearchScore(left, terms) || left.title.localeCompare(right.title))
    .slice(0, 8);

  if (!matches.length) {
    const empty = document.createElement("span");
    empty.className = "docs-search-empty";
    empty.textContent = "No documentation found.";
    results.append(empty);
    return;
  }

  for (const page of matches) {
    const result = document.createElement("a");
    result.className = "docs-search-result";
    const resultUrl = new URL(page.url, new URL(input.dataset.docsIndex, document.baseURI));
    resultUrl.searchParams.set("search", input.value.trim());
    result.href = resultUrl.href;

    const title = document.createElement("span");
    title.className = "docs-search-result-title";
    appendDocsSearchHighlight(title, page.title, terms);
    const excerpt = document.createElement("span");
    excerpt.className = "docs-search-result-excerpt";
    appendDocsSearchHighlight(excerpt, docsSearchExcerpt(page.text, terms), terms);
    result.append(title, excerpt);
    results.append(result);
  }
}

for (const input of docsSearchInputs) {
  input.addEventListener("input", () => {
    renderDocsSearch(input, docsSearchIndex);
  });

  input.closest("form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    renderDocsSearch(input, docsSearchIndex);
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && document.activeElement === document.body && docsSearchInputs.length) {
    event.preventDefault();
    docsSearchInputs[0].focus();
  }
});

function highlightDocsSearchElement(element, terms) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.parentElement.closest("mark, script, style")
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT;
    }
  });
  const textNodes = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  for (const textNode of textNodes) {
    const replacement = document.createDocumentFragment();
    appendDocsSearchHighlight(replacement, textNode.textContent, terms, "docs-search-page-highlight");
    textNode.replaceWith(replacement);
  }
}

function clearDocsSearchHighlights() {
  document.querySelectorAll(".docs-search-page-highlight").forEach((highlight) => {
    highlight.replaceWith(document.createTextNode(highlight.textContent));
  });
}

const docsSearchQuery = new URLSearchParams(window.location.search).get("search");
const docsSearchTarget = window.location.hash ? document.getElementById(decodeURIComponent(window.location.hash.slice(1))) : null;

if (docsSearchQuery && docsSearchTarget && docsSearchTarget.matches("h1, h2, h3, h4")) {
  const terms = docsSearchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const headingLevel = Number(docsSearchTarget.tagName.slice(1));
  const elements = [docsSearchTarget];
  let element = docsSearchTarget.nextElementSibling;

  while (element) {
    if (element.matches("h1, h2, h3, h4") && Number(element.tagName.slice(1)) <= headingLevel) {
      break;
    }
    elements.push(element);
    element = element.nextElementSibling;
  }

  elements.forEach((sectionElement) => highlightDocsSearchElement(sectionElement, terms));
  ["pointerdown", "wheel", "keydown"].forEach((eventName) => {
    document.addEventListener(eventName, clearDocsSearchHighlights, { once: true, capture: true });
  });
}
