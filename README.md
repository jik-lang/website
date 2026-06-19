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

This updates the generated documentation pages and release cards. To test the
flow with fixtures:

```powershell
npm.cmd run update:test
```

Commit `install.html` and the generated `docs/` HTML files after regenerating
them.

## Files

- `index.html` - homepage
- `install.html` - install instructions and generated release list
- `packages.html` - official package setup and usage instructions
- `docs/` - generated documentation pages
- `styles.css` - site styling
- `script.js` - syntax highlighting and examples dropdown
- `assets/` - logo images
- `src/partials/` - shared header and footer
- `scripts/` - build and release generation scripts
- `test/fixtures/github-releases.json` - fake release data for local testing
