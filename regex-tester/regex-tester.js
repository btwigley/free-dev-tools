(function () {
    'use strict';

    const patternInput = document.getElementById('rt-pattern');
    const testInput = document.getElementById('rt-input');
    const renderDiv = document.getElementById('rt-render');
    const errorDiv = document.getElementById('rt-error');
    const errorMsg = document.getElementById('rt-error-msg');
    const matchCount = document.getElementById('rt-match-count');
    const resultsPanel = document.getElementById('rt-results');
    const resultsBody = document.getElementById('rt-results-body');

    const flagButtons = document.querySelectorAll('.rt-flag');

    function getFlags() {
        let f = '';
        flagButtons.forEach(btn => {
            if (btn.classList.contains('active')) f += btn.dataset.flag;
        });
        return f;
    }

    flagButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
            runMatch();
        });
    });

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function runMatch() {
        const pattern = patternInput.value;
        const text = testInput.value;

        errorDiv.classList.remove('visible');
        matchCount.textContent = '';
        resultsBody.innerHTML = '';

        if (!pattern) {
            renderDiv.innerHTML = escapeHtml(text) || '';
            resultsPanel.style.display = 'none';
            return;
        }

        let regex;
        try {
            regex = new RegExp(pattern, getFlags());
        } catch (e) {
            errorMsg.textContent = e.message;
            errorDiv.classList.add('visible');
            renderDiv.innerHTML = escapeHtml(text) || '';
            resultsPanel.style.display = 'none';
            return;
        }

        if (!text) {
            renderDiv.innerHTML = '';
            resultsPanel.style.display = 'none';
            return;
        }

        const matches = [];
        let highlighted = '';
        let lastIndex = 0;
        let matchIdx = 0;
        const MAX_MATCHES = 5000;

        if (regex.global) {
            let m;
            while ((m = regex.exec(text)) !== null && matchIdx < MAX_MATCHES) {
                if (m.index === regex.lastIndex) {
                    regex.lastIndex++;
                    if (regex.lastIndex > text.length) break;
                    continue;
                }
                matches.push(m);
                const cls = matchIdx % 2 === 0 ? 'rt-hl' : 'rt-hl-alt';
                highlighted += escapeHtml(text.slice(lastIndex, m.index));
                highlighted += '<span class="' + cls + '">' + escapeHtml(m[0]) + '</span>';
                lastIndex = m.index + m[0].length;
                matchIdx++;
            }
        } else {
            const m = regex.exec(text);
            if (m && m[0].length > 0) {
                matches.push(m);
                highlighted += escapeHtml(text.slice(0, m.index));
                highlighted += '<span class="rt-hl">' + escapeHtml(m[0]) + '</span>';
                lastIndex = m.index + m[0].length;
            }
        }

        highlighted += escapeHtml(text.slice(lastIndex));
        renderDiv.innerHTML = highlighted;

        matchCount.textContent = matches.length + ' match' + (matches.length !== 1 ? 'es' : '');

        if (matches.length > 0) {
            resultsPanel.style.display = 'block';
            let rows = '';
            matches.forEach((m, i) => {
                const groups = m.slice(1).filter(g => g !== undefined);
                rows += '<div class="rt-match-row">' +
                    '<span class="rt-match-idx">' + (i + 1) + '</span>' +
                    '<span class="rt-match-val">' + escapeHtml(m[0]) + '</span>' +
                    '<span class="rt-match-pos">' + m.index + '-' + (m.index + m[0].length) + '</span>' +
                    '<span class="rt-match-groups">' + (groups.length ? groups.map(g => escapeHtml(g)).join(', ') : '-') + '</span>' +
                    '</div>';
            });
            resultsBody.innerHTML = rows;
        } else {
            resultsPanel.style.display = 'block';
            resultsBody.innerHTML = '<div class="rt-no-matches">No matches found</div>';
        }
    }

    patternInput.addEventListener('input', runMatch);
    testInput.addEventListener('input', function () {
        runMatch();
        syncScroll();
    });

    testInput.addEventListener('scroll', syncScroll);

    function syncScroll() {
        renderDiv.scrollTop = testInput.scrollTop;
        renderDiv.scrollLeft = testInput.scrollLeft;
    }

    patternInput.value = '\\b\\w+@\\w+\\.\\w+\\b';
    testInput.value = 'Contact us at hello@example.com or support@wigleystudios.com for help.\nInvalid: not-an-email, @missing, test@.broken';
    runMatch();
})();
