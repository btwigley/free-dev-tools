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

- **100% Client-Side** — Nothing is uploaded. All processing happens in your browser.
- **No Sign-Up** — No accounts, no cookies, no tracking.
- **Open Source** — MIT licensed. Fork it, self-host it, modify it.
- **Mobile Friendly** — Responsive design works on all devices.

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

## License

MIT — see [LICENSE](LICENSE).

---

Built by [Wigley Studios](https://wigleystudios.com)
