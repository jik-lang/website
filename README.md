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

## Update Releases

Release cards on `install.html` are generated from GitHub releases:

```powershell
npm.cmd run releases
```

To test without publishing a real Jik release:

```powershell
npm.cmd run releases:test
```

Then restore real release data:

```powershell
npm.cmd run releases
```

Commit `install.html` after regenerating it.

## Files

- `index.html` - homepage
- `install.html` - install instructions and generated release list
- `styles.css` - site styling
- `script.js` - syntax highlighting and examples dropdown
- `assets/` - logo images
- `src/partials/` - shared header and footer
- `scripts/` - build and release generation scripts
- `test/fixtures/github-releases.json` - fake release data for local testing
