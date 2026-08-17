# Jik Website

Static website for the Jik programming language.

## Local Preview

Open `index.html` in a browser.

## Build Shared Layout

Shared navigation and footer live in `src/partials/`.

After changing them, run:

```powershell
node scripts/build-site.js
```

On Windows PowerShell, this also works:

```powershell
npm.cmd run build
```

## Update After a Jik Release

After publishing a new Jik release, regenerate the website content:

```powershell
npm.cmd run update
```

This updates the generated documentation pages, latest release card, and the package
list on `packages.html`. The package list is read from the `## Packages`
section of the
[`jik-packages` README](https://github.com/jik-lang/jik-packages#packages).
To test the flow with fixtures:

```powershell
npm.cmd run update:test
```

Commit `install.html`, `packages.html`, and the generated `docs/` HTML files
after regenerating them.

## Files

- `index.html` - homepage
- `install.html` - install instructions and generated latest release card
- `packages.html` - official package setup and usage instructions
- `docs/` - generated documentation pages
- `styles.css` - site styling
- `script.js` - syntax highlighting and examples dropdown
- `assets/` - logo images
- `src/partials/` - shared header and footer
- `scripts/` - build and release generation scripts
- `test/fixtures/` - fake documentation, release, and package data for local testing
