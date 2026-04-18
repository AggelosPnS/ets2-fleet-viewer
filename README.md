# ETS2 Fleet Viewer

Browser-based dashboard for your **Euro Truck Simulator 2** company saves. Drop your `game.sii` on the page and instantly see your garages on a map, your fleet, your drivers, and your trailers — all without leaving your browser.

🌐 **Live site:** _(coming soon — Cloudflare Pages deployment)_

## ✨ Features

- 🗺️ Interactive map of Europe with pins for every owned garage
- 📊 Dashboard with stats (trucks, drivers, trailers, total km, HQ, etc.)
- 🔍 Searchable, sortable tables for garages / trucks / drivers / trailers
- 📥 Export everything to a multi-sheet Excel file
- 🔒 100% client-side — your save **never leaves your browser**
- 🔓 Built-in decryption for encrypted saves (no external tools needed)
- 🌚 Dark ETS2-flavored theme

## 🚀 Running locally

This project has **zero build step**. It's a set of static HTML/CSS/JS files.

```bash
# Clone
git clone https://github.com/AggelosPnS/ets2-fleet-viewer.git
cd ets2-fleet-viewer

# Serve with any static server. Python is a quick option:
python3 -m http.server 8080
# Or Node:
npx serve .

# Open http://localhost:8080 in your browser
```

> ℹ️ You can't just double-click `index.html` because browsers block ES module imports from `file://` URLs. Use a local server.

## 🌍 Deploying

### Cloudflare Pages (recommended)

1. Push to GitHub.
2. Go to [Cloudflare Pages](https://pages.cloudflare.com) → Create a project → Connect to Git.
3. Select this repo. Build settings:
   - **Framework preset:** None
   - **Build command:** _(leave empty)_
   - **Build output directory:** `/`
4. Deploy. You get a `*.pages.dev` URL for free.

### GitHub Pages

1. Go to repo **Settings → Pages**.
2. Source: `Deploy from a branch`, branch `main`, folder `/ (root)`.
3. Save. A few minutes later it's live at `https://aggelospns.github.io/ets2-fleet-viewer/`.

## 📁 Project structure

```
ets2-fleet-viewer/
├── index.html         # Main page
├── src/
│   ├── app.js         # UI wiring, map, tables
│   ├── parser.js      # SII text -> structured model
│   ├── decrypt.js     # Encrypted/binary -> plain text (loads @trucky/sii-decrypt-ts)
│   ├── cities.js      # ETS2 city name -> lat/lng table
│   ├── export.js      # Excel export (SheetJS)
│   └── styles.css     # Dark theme
└── README.md
```

All third-party libraries (Leaflet, SheetJS, SII decryptor) load from CDNs (esm.sh, unpkg, jsdelivr), so there are no dependencies to install.

## 🔒 Privacy

Your save file is read, decrypted, and parsed entirely in your browser using JavaScript. Nothing is uploaded to any server. No analytics track your save content. You can verify this by inspecting the network tab of your browser's dev tools while using the site — the only requests are to CDNs for the libraries.

## 🙏 Credits

This project stands on the shoulders of the SII format reverse-engineering work by:

- **[TheLazyTomcat](https://github.com/TheLazyTomcat/SII_Decrypt)** — the original SII_Decrypt library (Pascal/Delphi)
- **[jammerxd](https://gitlab.com/jammerxd/sii-decryptsharp)** — SII Decrypt Sharp (C# port)
- **[trucky](https://www.npmjs.com/package/@trucky/sii-decrypt-ts)** — `sii-decrypt-ts`, the TypeScript library this site uses for decryption
- **[yuriko_3](https://sii-decode.github.io/)** — online SII decoder that inspired the browser-based approach

Euro Truck Simulator 2 is a trademark of SCS Software. This project is not affiliated with or endorsed by SCS Software.

## 📜 License

[MIT](./LICENSE)
