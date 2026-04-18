# 🚛 ETS2 Fleet Viewer

**See your Euro Truck Simulator 2 company at a glance.**

Drop your `game.sii` save file on the page and instantly get:

- 🗺️ An interactive map of Europe with every garage you own
- 📊 Stats on trucks, drivers, trailers, total distance driven, HQ
- 🔍 Searchable, sortable tables of your entire fleet
- 📥 One-click export to Excel for deeper analysis

> 🔒 **Your save never leaves your browser.** Everything — reading, parsing, rendering — happens locally on your device. No uploads, no servers, no tracking.

---

## 🎮 How to use

1. **Find your save file.** It's in:
   ```
   C:\Program Files (x86)\Steam\userdata\<YourSteamID>\227300\remote\profiles\<ProfileID>\save\
   ```
   Pick a save slot folder (e.g. `autosave`, `1`, `2`…) and grab `game.sii` from inside.

2. **Drop it on the page.** That's it.

3. **Encrypted save?** If your `game.sii` starts with `ScsC` (encrypted) or `BSII` (binary), decode it first at [sii-decode.github.io](https://sii-decode.github.io/) — it's a trusted browser-based decoder that runs entirely client-side. The site will prompt you automatically.

### 💡 Skip the decoding step forever

Set ETS2 to write saves as plain text from the start:

1. Close the game.
2. Open `config.cfg` in your profile folder with Notepad.
3. Find `uset g_save_format "0"` and change it to `"2"`.
4. Save, reload game, save in-game.

Future saves will be plain text and load instantly here — no decoding step needed.

---

## 🙏 Credits

SII format reverse-engineering work by:

- **[TheLazyTomcat](https://github.com/TheLazyTomcat/SII_Decrypt)** — the original SII_Decrypt library
- **[yuriko_3](https://sii-decode.github.io/)** — the browser-based SII decoder

*Euro Truck Simulator 2* is a trademark of SCS Software. This project is not affiliated with or endorsed by SCS Software.

## 📜 License

[MIT](./LICENSE)
