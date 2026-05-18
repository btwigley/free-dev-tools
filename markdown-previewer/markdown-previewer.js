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

    function render() {
        var raw = input.value;
        if (!raw.trim()) {
            preview.innerHTML = '<p style="color: var(--text-dim); opacity: 0.5;">Preview will appear here...</p>';
            return;
        }
        var html = marked.parse(raw);
        preview.innerHTML = DOMPurify.sanitize(html);
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
        var raw = input.value;
        if (!raw.trim()) return;
        var html = DOMPurify.sanitize(marked.parse(raw));
        navigator.clipboard.writeText(html).then(function () {
            showToast('HTML copied to clipboard');
        }).catch(function () {
            showToast('Failed to copy');
        });
    };

    window.mpDownload = function () {
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
        var raw = input.value;
        if (!raw.trim()) return;
        var body = DOMPurify.sanitize(marked.parse(raw));
        var hljsCss = _hljs ? '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.11.1/styles/github-dark.min.css">' : '';
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

    input.addEventListener('keydown', function (e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            var start = this.selectionStart;
            var end = this.selectionEnd;
            this.setRangeText('    ', start, end, 'end');
            render();
        }
    });

    input.addEventListener('input', render);

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
