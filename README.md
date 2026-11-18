# Free Dev Tools

Six browser-based developer utilities. No sign-up, no server, no tracking. Everything runs locally in your browser.

## Tools

| Tool | Description | Try It |
|------|-------------|--------|
| **CSS/JS Minifier** | Minify CSS and JavaScript using csso + Terser | [Live Demo](https://btwigley.github.io/free-dev-tools/css-js-minifier/) |
| **JSON Formatter** | Format, validate, and diff-compare JSON | [Live Demo](https://btwigley.github.io/free-dev-tools/json-formatter/) |
| **Image Optimizer** | Compress and resize images using Canvas | [Live Demo](https://btwigley.github.io/free-dev-tools/image-optimizer/) |
| **Regex Tester** | Test regex with real-time matching and groups | [Live Demo](https://btwigley.github.io/free-dev-tools/regex-tester/) |
| **JWT Decoder** | Decode and inspect JSON Web Tokens | [Live Demo](https://btwigley.github.io/free-dev-tools/jwt-decoder/) |
| **Markdown Previewer** | Live Markdown preview with GFM support | [Live Demo](https://btwigley.github.io/free-dev-tools/markdown-previewer/) |

## Features

- **100% Client-Side** — Nothing you paste or drop is uploaded; all processing happens in your browser. The pages load their libraries and fonts from public CDNs. In the Markdown Previewer, remote images in your document stay unloaded until you click **Load remote images**, because loading one contacts the server that hosts it.
- **No Sign-Up** — No accounts, no cookies, no tracking.
- **Open Source** — MIT licensed. Fork it, self-host it, modify it.
- **Mobile Friendly** — Responsive layout; on a phone the top navigation scrolls sideways.

## What stays in your browser

Two tools keep something in your browser's `localStorage`, on your device only:

- **JSON Formatter** remembers your indentation choice (`jf_indent`).
- **Markdown Previewer** saves your current draft (`mp_autosave`) so it is still there when you come back. Emptying the editor or pressing **Clear** deletes it.

Nothing else is stored, and nothing is sent anywhere.

## Hosted version

The same six tools also run on [wigleystudios.com/free-resources](https://wigleystudios.com/free-resources/), inside the Wigley Studios site. That copy adds the site's navigation, analytics and product recommendations, and its Image Optimizer re-encodes PNG with a quality slider (UPNG.js); this repository is the standalone version without any of that.

## Self-Hosting

Clone and serve with any static file server:

```bash
git clone https://github.com/btwigley/free-dev-tools.git
cd free-dev-tools

# Python
python -m http.server 8000

# Node
npx serve .

# Or just open index.html in your browser
```

No build step required. All dependencies are loaded from CDN.

## Tech Stack

- Vanilla JavaScript (no frameworks)
- [csso](https://github.com/css/csso) — CSS minification
- [Terser](https://github.com/terser/terser) — JavaScript minification
- [JSZip](https://stuk.github.io/jszip/) — ZIP file generation
- [marked](https://github.com/markedjs/marked) — Markdown parsing
- [DOMPurify](https://github.com/cure53/DOMPurify) — HTML sanitization
- [highlight.js](https://highlightjs.org/) — code highlighting in the Markdown Previewer (its GitHub Dark theme is also inlined into exported HTML files)

## Issues

Found a bug or a wrong result? [Open an issue](https://github.com/btwigley/free-dev-tools/issues) with the input that caused it.

## License

MIT — see [LICENSE](LICENSE).

---

Built by [Wigley Studios](https://wigleystudios.com)
