/**
 * JSON Formatter & Validator - Client-Side Tool
 * Wigley Studios Free Resources
 *
 * Pure client-side JSON formatting, validation, minification, and diff.
 * No external libraries needed. Everything runs in the browser.
 */

(function () {
    'use strict';

    // ── DOM refs ────────────────────────────────────────────────────────────────
    var input       = document.getElementById('jf-input');
    var output      = document.getElementById('jf-output');
    var inputInfo   = document.getElementById('jf-input-info');
    var outputInfo  = document.getElementById('jf-output-info');
    var errorPanel  = document.getElementById('jf-error');
    var errorTitle  = document.getElementById('jf-error-title');
    var errorDetail = document.getElementById('jf-error-detail');
    var successPanel = document.getElementById('jf-success');
    var successText  = document.getElementById('jf-success-text');
    var diffLeft    = document.getElementById('jf-diff-left');
    var diffRight   = document.getElementById('jf-diff-right');
    var diffError   = document.getElementById('jf-diff-error');
    var diffErrorTitle  = document.getElementById('jf-diff-error-title');
    var diffErrorDetail = document.getElementById('jf-diff-error-detail');
    var diffResult  = document.getElementById('jf-diff-result');
    var diffOutput  = document.getElementById('jf-diff-output');
    var diffStats   = document.getElementById('jf-diff-stats');

    // ── State ───────────────────────────────────────────────────────────────────
    var lastFormattedText = '';

    // ── Helpers ──────────────────────────────────────────────────────────────────

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;');
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        var kb = bytes / 1024;
        if (kb < 1024) return kb.toFixed(1) + ' KB';
        return (kb / 1024).toFixed(2) + ' MB';
    }

    function countLines(str) {
        if (!str) return 0;
        return str.split('\n').length;
    }

    function hideMessages() {
        errorPanel.classList.remove('visible');
        successPanel.classList.remove('visible');
    }

    function showError(title, detail) {
        hideMessages();
        errorTitle.textContent = title;
        errorDetail.textContent = detail || '';
        errorPanel.classList.add('visible');
    }

    function showSuccess(msg) {
        hideMessages();
        successText.textContent = msg;
        successPanel.classList.add('visible');
    }

    function hideDiffError() {
        diffError.classList.remove('visible');
    }

    function showDiffError(title, detail) {
        hideDiffError();
        diffErrorTitle.textContent = title;
        diffErrorDetail.textContent = detail || '';
        diffError.classList.add('visible');
    }

    function updateInputInfo() {
        var text = input.value;
        if (!text) {
            inputInfo.textContent = '';
            return;
        }
        var bytes = new Blob([text]).size;
        inputInfo.textContent = countLines(text) + ' lines, ' + formatBytes(bytes);
    }

    function updateOutputInfo(text) {
        if (!text) {
            outputInfo.textContent = '';
            return;
        }
        var bytes = new Blob([text]).size;
        outputInfo.textContent = countLines(text) + ' lines, ' + formatBytes(bytes);
    }

    // ── Syntax Highlighting ─────────────────────────────────────────────────────

    function syntaxHighlight(json) {
        var escaped = escapeHtml(json);
        return escaped.replace(
            /("(?:\\.|[^"\\])*")\s*:/g,
            '<span class="jf-key">$1</span><span class="jf-colon">:</span>'
        ).replace(
            /:\s*("(?:\\.|[^"\\])*")/g,
            ': <span class="jf-string">$1</span>'
        ).replace(
            /:\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
            ': <span class="jf-number">$1</span>'
        ).replace(
            /:\s*(true|false)/g,
            ': <span class="jf-boolean">$1</span>'
        ).replace(
            /:\s*(null)/g,
            ': <span class="jf-null">$1</span>'
        ).replace(
            /("(?:\\.|[^"\\])*")(?!\s*:)(?![^<]*<\/span>)/g,
            '<span class="jf-string">$1</span>'
        ).replace(
            /(?<!["\w])(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(?!["\w])/g,
            '<span class="jf-number">$1</span>'
        ).replace(
            /(?<!["\w])(true|false)(?!["\w])/g,
            '<span class="jf-boolean">$1</span>'
        ).replace(
            /(?<!["\w])(null)(?!["\w])/g,
            '<span class="jf-null">$1</span>'
        );
    }

    // ── Parse Error Enhancement ─────────────────────────────────────────────────

    function parseJsonWithDetail(text) {
        try {
            var parsed = JSON.parse(text);
            return { success: true, data: parsed };
        } catch (e) {
            var msg = e.message || 'Unknown error';
            var position = '';
            var match = msg.match(/position\s+(\d+)/i);
            if (match) {
                var pos = parseInt(match[1], 10);
                var before = text.substring(0, pos);
                var line = before.split('\n').length;
                var col = pos - before.lastIndexOf('\n');
                position = 'Line ' + line + ', Column ' + col;
            }
            return { success: false, error: msg, position: position };
        }
    }

    // ── Core Operations ─────────────────────────────────────────────────────────

    window.jfFormat = function () {
        hideMessages();
        var text = input.value.trim();
        if (!text) {
            output.innerHTML = '';
            outputInfo.textContent = '';
            return;
        }

        var result = parseJsonWithDetail(text);
        if (!result.success) {
            showError('Invalid JSON', result.position ? result.error + ' (' + result.position + ')' : result.error);
            output.innerHTML = '';
            outputInfo.textContent = '';
            return;
        }

        var formatted = JSON.stringify(result.data, null, 2);
        lastFormattedText = formatted;
        output.innerHTML = syntaxHighlight(formatted);
        updateOutputInfo(formatted);
        showSuccess('Formatted successfully (' + countLines(formatted) + ' lines)');
    };

    window.jfMinify = function () {
        hideMessages();
        var text = input.value.trim();
        if (!text) {
            output.innerHTML = '';
            outputInfo.textContent = '';
            return;
        }

        var result = parseJsonWithDetail(text);
        if (!result.success) {
            showError('Invalid JSON', result.position ? result.error + ' (' + result.position + ')' : result.error);
            output.innerHTML = '';
            outputInfo.textContent = '';
            return;
        }

        var minified = JSON.stringify(result.data);
        lastFormattedText = minified;
        output.innerHTML = syntaxHighlight(minified);
        updateOutputInfo(minified);

        var originalSize = new Blob([text]).size;
        var minifiedSize = new Blob([minified]).size;
        var saved = originalSize > 0 ? ((1 - minifiedSize / originalSize) * 100).toFixed(1) : 0;
        showSuccess('Minified: ' + formatBytes(originalSize) + ' -> ' + formatBytes(minifiedSize) + ' (-' + saved + '%)');
    };

    window.jfValidate = function () {
        hideMessages();
        var text = input.value.trim();
        if (!text) {
            showError('No Input', 'Please paste some JSON to validate.');
            return;
        }

        var result = parseJsonWithDetail(text);
        if (!result.success) {
            showError('Invalid JSON', result.position ? result.error + ' (' + result.position + ')' : result.error);
            return;
        }

        var type = Array.isArray(result.data) ? 'Array' : typeof result.data;
        var size = formatBytes(new Blob([text]).size);
        showSuccess('Valid JSON (' + type + ', ' + size + ')');
    };

    window.jfCopyOutput = function () {
        if (!lastFormattedText) return;
        navigator.clipboard.writeText(lastFormattedText).then(function () {
            var btns = document.querySelectorAll('.jf-single-section .jf-btn');
            btns.forEach(function (btn) {
                if (btn.textContent.trim().indexOf('Copy') !== -1) {
                    var orig = btn.innerHTML;
                    btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    setTimeout(function () { btn.innerHTML = orig; }, 1500);
                }
            });
        }).catch(function (err) {
            console.warn('[json-formatter] clipboard copy failed', err);
        });
    };

    window.jfDownloadOutput = function () {
        if (!lastFormattedText) return;
        var blob = new Blob([lastFormattedText], { type: 'application/json;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'formatted.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    window.jfClearAll = function () {
        input.value = '';
        output.innerHTML = '';
        inputInfo.textContent = '';
        outputInfo.textContent = '';
        lastFormattedText = '';
        hideMessages();
    };

    // ── Diff ────────────────────────────────────────────────────────────────────

    function computeDiff(linesA, linesB) {
        var m = linesA.length;
        var n = linesB.length;
        var dp = [];
        var i, j;

        for (i = 0; i <= m; i++) {
            dp[i] = [];
            for (j = 0; j <= n; j++) {
                if (i === 0 || j === 0) {
                    dp[i][j] = 0;
                } else if (linesA[i - 1] === linesB[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                }
            }
        }

        var result = [];
        i = m;
        j = n;
        while (i > 0 || j > 0) {
            if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
                result.unshift({ type: 'same', text: linesA[i - 1] });
                i--;
                j--;
            } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
                result.unshift({ type: 'add', text: linesB[j - 1] });
                j--;
            } else {
                result.unshift({ type: 'remove', text: linesA[i - 1] });
                i--;
            }
        }
        return result;
    }

    window.jfRunDiff = function () {
        hideDiffError();
        diffResult.style.display = 'none';

        var leftText = diffLeft.value.trim();
        var rightText = diffRight.value.trim();

        if (!leftText || !rightText) {
            showDiffError('Missing Input', 'Please paste JSON in both panels.');
            return;
        }

        var leftResult = parseJsonWithDetail(leftText);
        if (!leftResult.success) {
            showDiffError('Left JSON Invalid', leftResult.position ? leftResult.error + ' (' + leftResult.position + ')' : leftResult.error);
            return;
        }

        var rightResult = parseJsonWithDetail(rightText);
        if (!rightResult.success) {
            showDiffError('Right JSON Invalid', rightResult.position ? rightResult.error + ' (' + rightResult.position + ')' : rightResult.error);
            return;
        }

        var leftFormatted = JSON.stringify(leftResult.data, null, 2);
        var rightFormatted = JSON.stringify(rightResult.data, null, 2);

        var leftLines = leftFormatted.split('\n');
        var rightLines = rightFormatted.split('\n');

        var diff = computeDiff(leftLines, rightLines);

        var addCount = 0, removeCount = 0, sameCount = 0;
        var html = '';

        diff.forEach(function (d) {
            var line = escapeHtml(d.text);
            if (d.type === 'add') {
                html += '<span class="jf-diff-line jf-diff-add">+ ' + line + '</span>\n';
                addCount++;
            } else if (d.type === 'remove') {
                html += '<span class="jf-diff-line jf-diff-remove">- ' + line + '</span>\n';
                removeCount++;
            } else {
                html += '<span class="jf-diff-line jf-diff-same">  ' + line + '</span>\n';
                sameCount++;
            }
        });

        diffOutput.innerHTML = html;
        diffStats.innerHTML =
            '<span class="jf-diff-stat-add">+' + addCount + ' added</span>' +
            '<span class="jf-diff-stat-remove">-' + removeCount + ' removed</span>' +
            '<span class="jf-diff-stat-same">' + sameCount + ' unchanged</span>';

        diffResult.style.display = 'block';

        if (addCount === 0 && removeCount === 0) {
            diffStats.innerHTML = '<span class="jf-diff-stat-same">Identical -- no differences found</span>';
        }
    };

    window.jfSwapDiff = function () {
        var tmp = diffLeft.value;
        diffLeft.value = diffRight.value;
        diffRight.value = tmp;
    };

    window.jfClearDiff = function () {
        diffLeft.value = '';
        diffRight.value = '';
        diffResult.style.display = 'none';
        diffOutput.innerHTML = '';
        hideDiffError();
    };

    // ── Mode Switching ──────────────────────────────────────────────────────────

    window.jfSwitchMode = function (mode) {
        document.querySelectorAll('.jf-tab').forEach(function (tab) {
            tab.classList.toggle('active', tab.getAttribute('data-mode') === mode);
        });

        var singleSection = document.getElementById('jf-single-section');
        var diffSection = document.getElementById('jf-diff-section');

        if (mode === 'single') {
            singleSection.classList.add('active');
            diffSection.classList.remove('active');
        } else {
            singleSection.classList.remove('active');
            diffSection.classList.add('active');
        }
    };

    // ── Live Input Info ──────────────────────────────────────────────────────────

    input.addEventListener('input', updateInputInfo);

    // ── Tab key support in textareas ─────────────────────────────────────────────

    function handleTab(e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            var ta = e.target;
            var start = ta.selectionStart;
            var end = ta.selectionEnd;
            ta.value = ta.value.substring(0, start) + '  ' + ta.value.substring(end);
            ta.selectionStart = ta.selectionEnd = start + 2;
        }
    }

    input.addEventListener('keydown', handleTab);
    diffLeft.addEventListener('keydown', handleTab);
    diffRight.addEventListener('keydown', handleTab);

})();
