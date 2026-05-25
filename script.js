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
    
    host := settings["host"]
    port := settings["port"]
    if host is Some and port is Some:
        println("connecting to ", host?, ":", must string::to_int(port?))
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
end

func main():
    show_div(3, 2)
    show_div(2, 0)
end`,

  variants: `variant Packet:
    ID: int
    TEXT: String
    NUMS: Vec[int]
end

func inspect(pkt):
    match pkt:
        case Packet.ID{id}:
            println("id packet: ", id)
        case Packet.TEXT{text}:
            println("text packet: ", text)
        case Packet.NUMS{nums}:
            println("nums packet, len = ", len(nums), ", first = ", nums[0])
    end
end

func main():
    pkt := Packet.ID{41}
    println("raw id: ", pkt[Packet.ID])
    inspect(pkt)

    inspect(Packet.TEXT{"hello"})
    inspect(Packet.NUMS{[10, 20, 30]})
end`,

  regions: `struct Person:
    name: String
    age: int
end

func make_person(name, age, r: Region):
    p := Person{name = name, age = age}[r]
    return p
end

func main():
    p := make_person("Methusalem", 100, _)
    println(p)
end`,

  primes: `// Sieve of Eratosthenes
func sieve(n, r):
    is_prime := [n + 1 of true][r]
    is_prime[0] = false
    is_prime[1] = false
    p := 2
    while p * p <= n:
        if is_prime[p]:
            i := p * p
            while i <= n:
                is_prime[i] = false
                i = i + p
            end
        end
        p = p + 1
    end
    return is_prime
end

func main():
    n := 100
    res := sieve(n, _)
    println("Primes up to ", n, ":")
    for i = 2, n:
        if res[i]:
            print(i, ", ")
        end
    end
end`,

  counts: `// Count lines, words, and bytes in a text file.
use "jik/io"
use "jik/char"


struct Counts:
    lines: int
    words: int
    bytes: int
end

func count_text(s: String, r: Region) -> Counts:
    lines := 0
    words := 0
    bytes := len(s)
    in_word := false

    for i = 0, len(s):
        c := s[i]
        if c == '\\n':
            lines = lines + 1
        end
        if char::isspace(c):
            in_word = false
        elif not in_word:
            words = words + 1
            in_word = true
        end
    end

    return Counts{
        lines = lines,
        words = words,
        bytes = bytes
    }[r]
end

func main(args):
    if len(args) < 2:
        println("usage: word_count <file>")
    else:
        path := args[1]
        text := must io::read_file(path, _)
        counts := count_text(text, _)

        println("file:  ", path)
        println("lines: ", counts.lines)
        println("words: ", counts.words)
        println("bytes: ", counts.bytes)
    end
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
