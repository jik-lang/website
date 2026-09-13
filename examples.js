(() => {
  const browser = document.querySelector(".examples-browser");
  if (!browser) return;
  const articles = [...browser.querySelectorAll(".source-example")];
  const links = [...browser.querySelectorAll(".examples-nav a")];
  const picker = document.querySelector("#source-select");
  const feedback = document.querySelector("#source-feedback");
  let resetTimer;

  function render() {
    clearTimeout(resetTimer);
    browser.querySelectorAll(".source-copy").forEach((button) => { button.textContent = "Copy"; });
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { id = "hello"; }
    const selected = articles.find((article) => article.id === id) || articles[0];
    for (const article of articles) article.hidden = article !== selected;
    for (const link of links) {
      if (link.hash.slice(1) === selected.id) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    }
    picker.value = selected.id;
    document.title = `${selected.id}.jik - Jik Examples`;
    feedback.textContent = "";
  }

  function selectExample(id) {
    if (location.hash !== `#${id}`) history.pushState(null, "", `#${id}`);
    const top = browser.getBoundingClientRect().top + window.scrollY - 80;
    const scrolledPastStart = window.scrollY > top;
    render();
    if (scrolledPastStart) window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
  }

  for (const link of links) link.addEventListener("click", (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    selectExample(link.hash.slice(1));
  });
  picker.addEventListener("change", () => selectExample(picker.value));
  window.addEventListener("popstate", render);
  window.addEventListener("hashchange", render);
  for (const article of articles) {
    const button = article.querySelector(".source-copy");
    const filePicker = article.querySelector(".source-file-select");
    const sourceFiles = [...article.querySelectorAll(".source-file")];
    const selectedSource = () => sourceFiles.find((sourceFile) => !sourceFile.hidden);

    if (filePicker) {
      filePicker.hidden = false;
      filePicker.addEventListener("change", () => {
        for (const sourceFile of sourceFiles) {
          sourceFile.hidden = sourceFile.dataset.sourceFile !== filePicker.value;
        }
        button.setAttribute("aria-label", `Copy ${filePicker.value}`);
        feedback.textContent = "";
      });
    }

    button.hidden = false;
    button.setAttribute("aria-label", `Copy ${selectedSource().dataset.sourceFile}`);
    button.addEventListener("click", async () => {
      const sourceFile = selectedSource();
      const copied = await copyToClipboard(sourceFile.querySelector("code.language-jik").textContent);
      const filename = sourceFile.dataset.sourceFile;
      button.textContent = copied ? "Copied!" : "Try again";
      feedback.textContent = copied ? `${filename} copied.` : "Copy failed. Select the code to copy it manually.";
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        browser.querySelectorAll(".source-copy").forEach((copyButton) => { copyButton.textContent = "Copy"; });
      }, 2000);
    });
  }
  browser.classList.add("is-ready");
  browser.querySelector(".examples-mobile").hidden = false;
  document.querySelector('.site-nav a[href="examples.html"]').setAttribute("aria-current", "page");
  render();
})();
