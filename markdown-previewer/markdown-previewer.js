(function () {
    'use strict';

    const input = document.getElementById('mp-input');
    const preview = document.getElementById('mp-preview');
    const toast = document.getElementById('mp-toast');

    var _hljs = typeof hljs !== 'undefined' ? hljs : null;

    marked.setOptions({
        breaks: true,
        gfm: true
    });

    if (_hljs) {
        marked.use({
            renderer: {
                code: function (text, lang) {
                    var validLang = lang && _hljs.getLanguage(lang);
                    var highlighted = validLang
                        ? _hljs.highlight(text, { language: lang, ignoreIllegals: true }).value
                        : _hljs.highlightAuto(text).value;
                    return '<pre><code class="hljs' + (validLang ? ' language-' + lang : '') + '">' + highlighted + '</code></pre>';
                }
            }
        });
    }

    var AUTOSAVE_KEY = 'mp_autosave';

    // Typing re-renders after a short pause instead of on every keystroke (marked + DOMPurify + highlight.js on a
    // long document lag); anything that reads or prints the result renders first (flushRender).
    var RENDER_DEBOUNCE_MS = 120;
    var renderTimer = null;
    function scheduleRender() {
        clearTimeout(renderTimer);
        renderTimer = setTimeout(render, RENDER_DEBOUNCE_MS);
    }
    function flushRender() { if (renderTimer) render(); }

    // highlight.js 11.11.1 styles/github-dark.min.css (BSD-3-Clause, highlight.js), inlined so an exported file
    // shows highlighted code offline and never contacts a CDN when opened.
    var HLJS_THEME_CSS = 'pre code.hljs{display:block;overflow-x:auto;padding:1em}code.hljs{padding:3px 5px}/*!\n' +
        '  Theme: GitHub Dark\n  Description: Dark theme as seen on github.com\n  Author: github.com\n  Maintainer: @Hirse\n' +
        '  Updated: 2021-05-15\n\n  Outdated base version: https://github.com/primer/github-syntax-dark\n' +
        '  Current colors taken from GitHub\'s CSS\n*/.hljs{color:#c9d1d9;background:#0d1117}.hljs-doctag,.hljs-keyword,' +
        '.hljs-meta .hljs-keyword,.hljs-template-tag,.hljs-template-variable,.hljs-type,.hljs-variable.language_{color:#ff7b72}' +
        '.hljs-title,.hljs-title.class_,.hljs-title.class_.inherited__,.hljs-title.function_{color:#d2a8ff}.hljs-attr,' +
        '.hljs-attribute,.hljs-literal,.hljs-meta,.hljs-number,.hljs-operator,.hljs-selector-attr,.hljs-selector-class,' +
        '.hljs-selector-id,.hljs-variable{color:#79c0ff}.hljs-meta .hljs-string,.hljs-regexp,.hljs-string{color:#a5d6ff}' +
        '.hljs-built_in,.hljs-symbol{color:#ffa657}.hljs-code,.hljs-comment,.hljs-formula{color:#8b949e}.hljs-name,' +
        '.hljs-quote,.hljs-selector-pseudo,.hljs-selector-tag{color:#7ee787}.hljs-subst{color:#c9d1d9}' +
        '.hljs-section{color:#1f6feb;font-weight:700}.hljs-bullet{color:#f2cc60}.hljs-emphasis{color:#c9d1d9;font-style:italic}' +
        '.hljs-strong{color:#c9d1d9;font-weight:700}.hljs-addition{color:#aff5b4;background-color:#033a16}' +
        '.hljs-deletion{color:#ffdcd7;background-color:#67060c}';

    // Remote resources (images, media, CSS url()) in pasted Markdown would be
    // fetched as soon as they render, sending their URL (query string
    // included) to whoever hosts them. They stay inert until the reader clicks
    // "Load remote images"; the same rule applies to copied and exported HTML.
    var allowRemote = false;
    var blockedCount = 0;
    function isRemote(url) {
        var u = String(url || '').trim().toLowerCase();
        return !!u && u.indexOf('data:') !== 0 && u.indexOf('blob:') !== 0 && u.charAt(0) !== '#';
    }
    DOMPurify.addHook('afterSanitizeAttributes', function (node) {
        if (allowRemote || !node.getAttribute) return;
        ['src', 'poster', 'background'].forEach(function (attr) {
            var v = node.getAttribute(attr);
            if (v !== null && isRemote(v)) {
                node.setAttribute('data-blocked-' + attr, v);
                node.removeAttribute(attr);
                blockedCount++;
            }
        });
        if (node.hasAttribute('srcset')) { node.removeAttribute('srcset'); blockedCount++; }
        var tag = node.nodeName.toLowerCase();
        if (tag === 'image' || tag === 'use' || tag === 'feimage') {
            ['href', 'xlink:href'].forEach(function (attr) {
                if (node.hasAttribute(attr) && isRemote(node.getAttribute(attr))) {
                    node.removeAttribute(attr);
                    blockedCount++;
                }
            });
        }
        CSS_VALUE_ATTRS.forEach(function (attr) {
            var v = node.getAttribute(attr);
            if (v !== null && /[(\\]/.test(v) && !/^\s*url\(\s*['"]?#[^)]*\)\s*$/i.test(v)) {
                node.removeAttribute(attr);
                blockedCount++;
            }
        });
    });
    // Inline CSS can request a URL in many spellings (CSS escapes, image-set()
    // with a bare string, @import), so the document's CSS is dropped whole
    // while remote loading is off, rather than filtered by text.
    var CSS_VALUE_ATTRS = ['fill', 'stroke', 'filter', 'mask', 'clip-path', 'marker-start',
        'marker-mid', 'marker-end', 'cursor'];
    DOMPurify.addHook('uponSanitizeAttribute', function (node, data) {
        if (!allowRemote && data.attrName === 'style') {
            data.keepAttr = false;
            if (/[(\\@]/.test(data.attrValue || '')) blockedCount++;
        }
    });
    DOMPurify.addHook('uponSanitizeElement', function (node, data) {
        // Removed by FORBID_TAGS in sanitize(); counted here.
        if (!allowRemote && data.tagName === 'style') blockedCount++;
    });

    var remoteNotice = document.createElement('div');
    remoteNotice.setAttribute('role', 'status');
    remoteNotice.hidden = true;
    remoteNotice.style.cssText = 'display:flex;gap:.75rem;align-items:center;justify-content:space-between;' +
        'padding:.5rem .75rem;margin-bottom:.5rem;border:1px solid rgba(255,255,255,.15);border-radius:8px;font-size:.85rem;';
    var remoteNoticeText = document.createElement('span');
    var remoteNoticeBtn = document.createElement('button');
    remoteNoticeBtn.type = 'button';
    remoteNoticeBtn.textContent = 'Load remote images';
    remoteNoticeBtn.style.cssText = 'cursor:pointer;white-space:nowrap;background:transparent;color:inherit;' +
        'border:1px solid currentColor;border-radius:6px;padding:.25rem .6rem;font:inherit;';
    remoteNoticeBtn.addEventListener('click', function () { allowRemote = true; render(); });
    remoteNotice.appendChild(remoteNoticeText);
    remoteNotice.appendChild(remoteNoticeBtn);
    preview.parentNode.insertBefore(remoteNotice, preview);

    // A string for copy and export; for the live preview, DOM nodes (asDom), inserted as they are. Parsing the
    // sanitizer's string a second time through innerHTML is the mutation-XSS condition (DOMPurify 3.0.8 had a known
    // bypass of it; now 3.4.18).
    function sanitize(html, asDom) {
        blockedCount = 0;
        var config = allowRemote ? {} : { FORBID_TAGS: ['style'] };
        if (asDom) config.RETURN_DOM_FRAGMENT = true;
        return DOMPurify.sanitize(html, config);
    }

    function render() {
        clearTimeout(renderTimer);
        renderTimer = null;
        var raw = input.value;
        if (!raw.trim()) {
            preview.innerHTML = '<p style="color: var(--text-dim); opacity: 0.5;">Preview will appear here...</p>';
            remoteNotice.hidden = true;
            remoteNotice.style.display = 'none';
            // An emptied editor deletes the saved draft too, or the old document returns on the next visit.
            try { localStorage.removeItem(AUTOSAVE_KEY); } catch (_) {}
            return;
        }
        var html = marked.parse(raw);
        preview.replaceChildren(sanitize(html, true));
        remoteNotice.hidden = blockedCount === 0;
        remoteNotice.style.display = blockedCount === 0 ? 'none' : 'flex';
        remoteNoticeText.textContent = blockedCount + ' remote resource' + (blockedCount === 1 ? '' : 's') +
            ' not loaded. Loading contacts the server that hosts ' + (blockedCount === 1 ? 'it' : 'them') + '.';
        try { localStorage.setItem(AUTOSAVE_KEY, raw); } catch (_) {}
    }

    function showToast(msg) {
        toast.textContent = msg;
        toast.classList.add('visible');
        setTimeout(function () { toast.classList.remove('visible'); }, 2000);
    }

    window.mpInsert = function (before, after) {
        input.focus();
        var start = input.selectionStart;
        var end = input.selectionEnd;
        var selected = input.value.substring(start, end);
        var replacement = before + (selected || 'text') + after;
        input.setRangeText(replacement, start, end, 'select');
        render();
    };

    window.mpInsertLine = function (prefix) {
        input.focus();
        var start = input.selectionStart;
        var val = input.value;
        var lineStart = val.lastIndexOf('\n', start - 1) + 1;
        var lineEnd = val.indexOf('\n', start);
        if (lineEnd === -1) lineEnd = val.length;
        var line = val.substring(lineStart, lineEnd);

        var headingMatch = line.match(/^(#{1,6})\s/);
        if (prefix.charAt(0) === '#') {
            if (headingMatch) {
                var level = headingMatch[1].length;
                var stripped = line.replace(/^#{1,6}\s/, '');
                if (level < 6) {
                    var newPrefix = '#'.repeat(level + 1) + ' ';
                    input.setRangeText(newPrefix + stripped, lineStart, lineEnd, 'end');
                } else {
                    input.setRangeText(stripped, lineStart, lineEnd, 'end');
                }
            } else {
                input.setRangeText(prefix + line, lineStart, lineEnd, 'end');
            }
        } else {
            input.setRangeText(prefix, lineStart, lineStart, 'end');
        }
        render();
    };

    window.mpCopyHtml = function () {
        flushRender();
        var raw = input.value;
        if (!raw.trim()) return;
        var html = sanitize(marked.parse(raw));
        navigator.clipboard.writeText(html).then(function () {
            showToast('HTML copied to clipboard');
        }).catch(function () {
            showToast('Failed to copy');
        });
    };

    window.mpDownload = function () {
        flushRender();
        var raw = input.value;
        if (!raw.trim()) return;
        var blob = new Blob([raw], { type: 'text/markdown' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = 'document.md';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    window.mpExportHtml = function () {
        flushRender();
        var raw = input.value;
        if (!raw.trim()) return;
        var body = sanitize(marked.parse(raw));
        var hljsCss = _hljs ? '<style>' + HLJS_THEME_CSS + '</style>' : '';
        var doc = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>Exported Markdown</title>\n' +
            '<style>body{font-family:system-ui,-apple-system,sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;line-height:1.7;color:#e0e0e0;background:#1a1a2e}pre{background:#16213e;padding:1rem;border-radius:8px;overflow-x:auto}code{font-family:"JetBrains Mono",monospace;font-size:0.9em}table{border-collapse:collapse;width:100%}th,td{border:1px solid #334;padding:0.5rem 0.75rem;text-align:left}img{max-width:100%}a{color:#20c6b7}blockquote{border-left:3px solid #20c6b7;margin-left:0;padding-left:1rem;color:#a0a0b0}</style>\n' +
            hljsCss + '\n</head>\n<body>\n' + body + '\n</body>\n</html>';
        var blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = 'document.html';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Empties the editor and deletes the saved draft.
    window.mpClear = function () {
        input.value = '';
        render();
        input.focus();
    };

    // Tab and Shift+Tab keep their normal job of moving focus (no keyboard trap).
    input.addEventListener('input', scheduleRender);
    window.addEventListener('beforeprint', flushRender);
    window.addEventListener('pagehide', flushRender);

    // Restore autosaved content or use default
    var saved = null;
    try { saved = localStorage.getItem(AUTOSAVE_KEY); } catch (_) {}
    if (saved) {
        input.value = saved;
    } else {
        input.value = '# Welcome to Markdown Previewer\n\nStart typing on the left and see a **live preview** on the right.\n\n## Features\n\n- **Bold**, *italic*, and ~~strikethrough~~ text\n- [Links](https://wigleystudios.com) and images\n- Code blocks with `inline code`\n- Tables, blockquotes, and lists\n\n## Code Example\n\n```javascript\nfunction greet(name) {\n    return `Hello, ${name}!`;\n}\n```\n\n> This is a blockquote. It supports\n> multiple lines.\n\n## Table\n\n| Feature | Status |\n|---------|--------|\n| Bold    | Yes    |\n| Tables  | Yes    |\n| Lists   | Yes    |\n\n---\n\nBuilt by [Wigley Studios](https://wigleystudios.com). 100% browser-based.\n';
    }

    render();
})();
