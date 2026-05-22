const examples = {
  hello: `func main():
    println("Hello, Jik!")
end`,

  config: `use "jik/string"

func main():
    text := "host = localhost\\nport = 8080\\nmode = dev\\n"
    settings: Dict[String]

    for line in string::split(text, "\\n"):
        if line == "":
            continue
        end
        parts := string::split(line, "=")
        if len(parts) == 2:
            key := string::trim(parts[0])
            value := string::trim(parts[1])
            settings[key] = value
        end
    end
end`,

  errors: `throws func safe_div(x, y):
    if y == 0.0:
        fail("division by zero")
    end
    return x / y
end

func show_div(x, y):
    try value := safe_div(x, y):
        println(x, " / ", y, " = ", value)
    except:
        println("cannot divide ", x, " by ", y, ": ", error_msg())
    end
end`,

  variants: `variant Packet:
    ID: int
    TEXT: String
    BYTES: Vec[char]
end

func inspect(pkt):
    match pkt:
        case Packet.ID{id}:
            println("id packet: ", id)
        case Packet.TEXT{text}:
            println("text packet: ", text)
        case Packet.BYTES{bytes}:
            println("length of bytes packet: ", len(bytes))
    end
end`,

  regions: `struct Person:
    name: String
    age: int
end

func make_person(name, age, r: Region) -> Person:
    return Person{name = name, age = age}[r]
end

func main():
    p := make_person("Alice", 30, _)
    println(p.name)
end`,

  newton: `use "jik/math"

struct NewtonResult:
    root: double
    converged: bool
    xs: Vec[double]
end

func solve(x0: double, tol: double, max_steps: int, r: Region) -> NewtonResult:
    xs := [0 of 0.0][r]
    x := x0
    push(xs, x)
    for step = 0, max_steps:
        fx := math::cos(x) - x
        if math::abs(fx) <= tol:
            return NewtonResult{root = x, converged = true, xs = xs}[r]
        end
        x = x - fx / (-math::sin(x) - 1.0)
        push(xs, x)
    end
    return NewtonResult{root = x, converged = false, xs = xs}[r]
end`
};

const tokenPatterns = [
  ["tok-annotation", /^@[A-Za-z_][A-Za-z0-9_]*(\{[A-Za-z_][A-Za-z0-9_]*\})?/],
  ["tok-type", /^(void|bool|char|int|double|String|Region|Site|Vec|Dict|Option|Result)\b/],
  ["tok-keyword", /^(func|struct|enum|variant|if|elif|else|while|for|in|end|return|of|this|break|continue|use|as|true|false|and|or|not|extern|init|hints|must|try|except|throws|foreign|is|match|case)\b/],
  ["tok-builtin", /^(print|println|concat|assert|push|pop|len|clear|site|site_file|site_line|site_code|fail|error_msg|error_code)\b(?=\s*\()/],
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

    if (!matched) {
      html += escapeHtml(rest[0]);
      index += 1;
    }
  }

  return html;
}

function highlightJik(source) {
  return source.split("\n").map(highlightLine).join("\n");
}

const select = document.querySelector("#example-select");
const code = document.querySelector("#example-code");

function renderExample(name) {
  code.innerHTML = highlightJik(examples[name]);
}

if (select && code) {
  select.addEventListener("change", () => renderExample(select.value));
  renderExample(select.value);
}

document.querySelectorAll("code.language-jik").forEach((block) => {
  if (block.id !== "example-code") {
    block.innerHTML = highlightJik(block.textContent);
  }
});
