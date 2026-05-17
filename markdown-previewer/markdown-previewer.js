(function () {
    'use strict';

    const input = document.getElementById('mp-input');
    const preview = document.getElementById('mp-preview');
    const toast = document.getElementById('mp-toast');

    marked.setOptions({
        breaks: true,
        gfm: true
    });

    function render() {
        const raw = input.value;
        if (!raw.trim()) {
            preview.innerHTML = '<p style="color: var(--text-dim); opacity: 0.5;">Preview will appear here...</p>';
            return;
        }
        const html = marked.parse(raw);
        preview.innerHTML = DOMPurify.sanitize(html);
    }

    function showToast(msg) {
        toast.textContent = msg;
        toast.classList.add('visible');
        setTimeout(function () { toast.classList.remove('visible'); }, 2000);
    }

    // Toolbar: wrap selection
    window.mpInsert = function (before, after) {
        input.focus();
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const selected = input.value.substring(start, end);
        const replacement = before + (selected || 'text') + after;
        input.setRangeText(replacement, start, end, 'select');
        render();
    };

    // Toolbar: prefix line
    window.mpInsertLine = function (prefix) {
        input.focus();
        const start = input.selectionStart;
        const val = input.value;
        const lineStart = val.lastIndexOf('\n', start - 1) + 1;
        input.setRangeText(prefix, lineStart, lineStart, 'end');
        render();
    };

    // Copy HTML
    window.mpCopyHtml = function () {
        const raw = input.value;
        if (!raw.trim()) return;
        const html = DOMPurify.sanitize(marked.parse(raw));
        navigator.clipboard.writeText(html).then(function () {
            showToast('HTML copied to clipboard');
        }).catch(function () {
            showToast('Failed to copy');
        });
    };

    // Download .md
    window.mpDownload = function () {
        const raw = input.value;
        if (!raw.trim()) return;
        const blob = new Blob([raw], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'document.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Tab key support
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = this.selectionStart;
            const end = this.selectionEnd;
            this.setRangeText('    ', start, end, 'end');
            render();
        }
    });

    input.addEventListener('input', render);

    // Default content
    input.value = '# Welcome to Markdown Previewer\n\nStart typing on the left and see a **live preview** on the right.\n\n## Features\n\n- **Bold**, *italic*, and ~~strikethrough~~ text\n- [Links](https://wigleystudios.com) and images\n- Code blocks with `inline code`\n- Tables, blockquotes, and lists\n\n## Code Example\n\n```javascript\nfunction greet(name) {\n    return `Hello, ${name}!`;\n}\n```\n\n> This is a blockquote. It supports\n> multiple lines.\n\n## Table\n\n| Feature | Status |\n|---------|--------|\n| Bold    | Yes    |\n| Tables  | Yes    |\n| Lists   | Yes    |\n\n---\n\nBuilt by [Wigley Studios](https://wigleystudios.com). 100% browser-based.\n';

    render();
})();
