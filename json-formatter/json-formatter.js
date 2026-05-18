(function () {
    'use strict';

    var input       = document.getElementById('jf-input');
    var output      = document.getElementById('jf-output');
    var treeOutput  = document.getElementById('jf-tree-output');
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
    var indentSelect = document.getElementById('jf-indent');

    var lastFormattedText = '';
    var DIFF_LINE_LIMIT = 5000;

    function getIndent() {
        if (!indentSelect) return 2;
        var v = indentSelect.value;
        if (v === 'tab') return '\t';
        return parseInt(v, 10) || 2;
    }

    // Persist indent preference
    if (indentSelect) {
        try {
            var stored = localStorage.getItem('jf_indent');
            if (stored) indentSelect.value = stored;
        } catch (_) {}
        indentSelect.addEventListener('change', function () {
            try { localStorage.setItem('jf_indent', indentSelect.value); } catch (_) {}
        });
    }

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        var kb = bytes / 1024;
        if (kb < 1024) return kb.toFixed(1) + ' KB';
        return (kb / 1024).toFixed(2) + ' MB';
    }

    function countLines(str) { return str ? str.split('\n').length : 0; }

    function hideMessages() { errorPanel.classList.remove('visible'); successPanel.classList.remove('visible'); }
    function showError(title, detail) { hideMessages(); errorTitle.textContent = title; errorDetail.textContent = detail || ''; errorPanel.classList.add('visible'); }
    function showSuccess(msg) { hideMessages(); successText.textContent = msg; successPanel.classList.add('visible'); }
    function hideDiffError() { diffError.classList.remove('visible'); }
    function showDiffError(title, detail) { hideDiffError(); diffErrorTitle.textContent = title; diffErrorDetail.textContent = detail || ''; diffError.classList.add('visible'); }

    function updateInputInfo() {
        var text = input.value;
        if (!text) { inputInfo.textContent = ''; return; }
        inputInfo.textContent = countLines(text) + ' lines, ' + formatBytes(new Blob([text]).size);
    }

    function updateOutputInfo(text) {
        if (!text) { outputInfo.textContent = ''; return; }
        outputInfo.textContent = countLines(text) + ' lines, ' + formatBytes(new Blob([text]).size);
    }

    function syntaxHighlight(json) {
        var escaped = escapeHtml(json);
        return escaped
            .replace(/("(?:\\.|[^"\\])*")\s*:/g, '<span class="jf-key">$1</span><span class="jf-colon">:</span>')
            .replace(/:\s*("(?:\\.|[^"\\])*")/g, ': <span class="jf-string">$1</span>')
            .replace(/:\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g, ': <span class="jf-number">$1</span>')
            .replace(/:\s*(true|false)/g, ': <span class="jf-boolean">$1</span>')
            .replace(/:\s*(null)/g, ': <span class="jf-null">$1</span>')
            .replace(/("(?:\\.|[^"\\])*")(?!\s*:)(?![^<]*<\/span>)/g, '<span class="jf-string">$1</span>')
            .replace(/(?<!["\w])(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(?!["\w])/g, '<span class="jf-number">$1</span>')
            .replace(/(?<!["\w])(true|false)(?!["\w])/g, '<span class="jf-boolean">$1</span>')
            .replace(/(?<!["\w])(null)(?!["\w])/g, '<span class="jf-null">$1</span>');
    }

    function parseJsonWithDetail(text) {
        try { return { success: true, data: JSON.parse(text) }; } catch (e) {
            var msg = e.message || 'Unknown error';
            var position = '';
            var match = msg.match(/position\s+(\d+)/i);
            if (match) {
                var pos = parseInt(match[1], 10);
                var before = text.substring(0, pos);
                position = 'Line ' + before.split('\n').length + ', Column ' + (pos - before.lastIndexOf('\n'));
            }
            return { success: false, error: msg, position: position };
        }
    }

    // --- Tree view ---
    function buildTree(data, key) {
        var label = key !== undefined ? '<span class="jf-tree-key">' + escapeHtml(String(key)) + '</span>: ' : '';
        if (data === null) return '<div class="jf-tree-leaf">' + label + '<span class="jf-null">null</span></div>';
        if (typeof data === 'boolean') return '<div class="jf-tree-leaf">' + label + '<span class="jf-boolean">' + data + '</span></div>';
        if (typeof data === 'number') return '<div class="jf-tree-leaf">' + label + '<span class="jf-number">' + data + '</span></div>';
        if (typeof data === 'string') return '<div class="jf-tree-leaf">' + label + '<span class="jf-string">"' + escapeHtml(data) + '"</span></div>';
        if (Array.isArray(data)) {
            if (data.length === 0) return '<div class="jf-tree-leaf">' + label + '<span class="jf-bracket">[]</span></div>';
            var items = data.map(function (v, i) { return buildTree(v, i); }).join('');
            return '<details open><summary>' + label + '<span class="jf-bracket">Array[' + data.length + ']</span></summary><div class="jf-tree-children">' + items + '</div></details>';
        }
        if (typeof data === 'object') {
            var keys = Object.keys(data);
            if (keys.length === 0) return '<div class="jf-tree-leaf">' + label + '<span class="jf-bracket">{}</span></div>';
            var children = keys.map(function (k) { return buildTree(data[k], k); }).join('');
            return '<details open><summary>' + label + '<span class="jf-bracket">Object{' + keys.length + '}</span></summary><div class="jf-tree-children">' + children + '</div></details>';
        }
        return '<div class="jf-tree-leaf">' + label + escapeHtml(String(data)) + '</div>';
    }

    function renderTree(data) {
        if (!treeOutput) return;
        treeOutput.innerHTML = buildTree(data);
        treeOutput.style.display = 'block';
    }

    // --- Repair mode ---
    function repairJson(text) {
        var s = text;
        s = s.replace(/\/\/[^\n]*/g, '');
        s = s.replace(/\/\*[\s\S]*?\*\//g, '');
        s = s.replace(/,(\s*[}\]])/g, '$1');
        s = s.replace(/([{,]\s*)([a-zA-Z_$][\w$]*)\s*:/g, '$1"$2":');
        s = s.replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, function (_, inner) {
            return ': "' + inner.replace(/"/g, '\\"') + '"';
        });
        return s;
    }

    // --- Core Operations ---
    window.jfFormat = function () {
        hideMessages();
        var text = input.value.trim();
        if (!text) { output.innerHTML = ''; if (treeOutput) treeOutput.innerHTML = ''; outputInfo.textContent = ''; return; }
        var result = parseJsonWithDetail(text);
        if (!result.success) {
            showError('Invalid JSON', result.position ? result.error + ' (' + result.position + ')' : result.error);
            output.innerHTML = ''; if (treeOutput) treeOutput.innerHTML = ''; outputInfo.textContent = '';
            return;
        }
        var formatted = JSON.stringify(result.data, null, getIndent());
        lastFormattedText = formatted;
        output.innerHTML = syntaxHighlight(formatted);
        renderTree(result.data);
        updateOutputInfo(formatted);
        showSuccess('Formatted successfully (' + countLines(formatted) + ' lines)');
    };

    window.jfMinify = function () {
        hideMessages();
        var text = input.value.trim();
        if (!text) { output.innerHTML = ''; outputInfo.textContent = ''; return; }
        var result = parseJsonWithDetail(text);
        if (!result.success) {
            showError('Invalid JSON', result.position ? result.error + ' (' + result.position + ')' : result.error);
            output.innerHTML = ''; outputInfo.textContent = '';
            return;
        }
        var minified = JSON.stringify(result.data);
        lastFormattedText = minified;
        output.innerHTML = syntaxHighlight(minified);
        if (treeOutput) treeOutput.innerHTML = '';
        updateOutputInfo(minified);
        var originalSize = new Blob([text]).size;
        var minifiedSize = new Blob([minified]).size;
        var saved = originalSize > 0 ? ((1 - minifiedSize / originalSize) * 100).toFixed(1) : 0;
        showSuccess('Minified: ' + formatBytes(originalSize) + ' -> ' + formatBytes(minifiedSize) + ' (-' + saved + '%)');
    };

    window.jfValidate = function () {
        hideMessages();
        var text = input.value.trim();
        if (!text) { showError('No Input', 'Please paste some JSON to validate.'); return; }
        var result = parseJsonWithDetail(text);
        if (!result.success) {
            showError('Invalid JSON', result.position ? result.error + ' (' + result.position + ')' : result.error);
            return;
        }
        var type = Array.isArray(result.data) ? 'Array' : typeof result.data;
        showSuccess('Valid JSON (' + type + ', ' + formatBytes(new Blob([text]).size) + ')');
    };

    window.jfRepair = function () {
        hideMessages();
        var text = input.value.trim();
        if (!text) { showError('No Input', 'Please paste some JSON to repair.'); return; }
        var tryFirst = parseJsonWithDetail(text);
        if (tryFirst.success) { showSuccess('JSON is already valid -- no repair needed.'); return; }
        var repaired = repairJson(text);
        var result = parseJsonWithDetail(repaired);
        if (result.success) {
            var formatted = JSON.stringify(result.data, null, getIndent());
            input.value = formatted;
            lastFormattedText = formatted;
            output.innerHTML = syntaxHighlight(formatted);
            renderTree(result.data);
            updateInputInfo();
            updateOutputInfo(formatted);
            showSuccess('Repaired: removed comments, trailing commas, unquoted keys, and single quotes.');
        } else {
            showError('Repair Failed', 'Could not auto-fix the JSON. ' + result.error);
        }
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
        }).catch(function (err) { console.warn('[json-formatter] clipboard copy failed', err); });
    };

    window.jfDownloadOutput = function () {
        if (!lastFormattedText) return;
        var blob = new Blob([lastFormattedText], { type: 'application/json;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = 'formatted.json';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    window.jfClearAll = function () {
        input.value = '';
        output.innerHTML = '';
        if (treeOutput) treeOutput.innerHTML = '';
        inputInfo.textContent = '';
        outputInfo.textContent = '';
        lastFormattedText = '';
        hideMessages();
    };

    // --- Diff ---
    function computeDiff(linesA, linesB) {
        var m = linesA.length, n = linesB.length;
        var dp = [], i, j;
        for (i = 0; i <= m; i++) {
            dp[i] = [];
            for (j = 0; j <= n; j++) {
                if (i === 0 || j === 0) dp[i][j] = 0;
                else if (linesA[i - 1] === linesB[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
                else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
        var result = [];
        i = m; j = n;
        while (i > 0 || j > 0) {
            if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) { result.unshift({ type: 'same', text: linesA[i - 1] }); i--; j--; }
            else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) { result.unshift({ type: 'add', text: linesB[j - 1] }); j--; }
            else { result.unshift({ type: 'remove', text: linesA[i - 1] }); i--; }
        }
        return result;
    }

    window.jfRunDiff = function () {
        hideDiffError();
        diffResult.style.display = 'none';
        var leftText = diffLeft.value.trim(), rightText = diffRight.value.trim();
        if (!leftText || !rightText) { showDiffError('Missing Input', 'Please paste JSON in both panels.'); return; }
        var leftResult = parseJsonWithDetail(leftText);
        if (!leftResult.success) { showDiffError('Left JSON Invalid', leftResult.position ? leftResult.error + ' (' + leftResult.position + ')' : leftResult.error); return; }
        var rightResult = parseJsonWithDetail(rightText);
        if (!rightResult.success) { showDiffError('Right JSON Invalid', rightResult.position ? rightResult.error + ' (' + rightResult.position + ')' : rightResult.error); return; }

        var leftFormatted = JSON.stringify(leftResult.data, null, 2);
        var rightFormatted = JSON.stringify(rightResult.data, null, 2);
        var leftLines = leftFormatted.split('\n');
        var rightLines = rightFormatted.split('\n');

        if (leftLines.length > DIFF_LINE_LIMIT || rightLines.length > DIFF_LINE_LIMIT) {
            showDiffError('Inputs Too Large', 'Diff is limited to ' + DIFF_LINE_LIMIT.toLocaleString() + ' lines per side to prevent browser freezing. Minify or split your data.');
            return;
        }

        var diff = computeDiff(leftLines, rightLines);
        var addCount = 0, removeCount = 0, sameCount = 0, html = '';
        diff.forEach(function (d) {
            var line = escapeHtml(d.text);
            if (d.type === 'add') { html += '<span class="jf-diff-line jf-diff-add">+ ' + line + '</span>\n'; addCount++; }
            else if (d.type === 'remove') { html += '<span class="jf-diff-line jf-diff-remove">- ' + line + '</span>\n'; removeCount++; }
            else { html += '<span class="jf-diff-line jf-diff-same">  ' + line + '</span>\n'; sameCount++; }
        });
        diffOutput.innerHTML = html;
        diffStats.innerHTML = addCount === 0 && removeCount === 0
            ? '<span class="jf-diff-stat-same">Identical -- no differences found</span>'
            : '<span class="jf-diff-stat-add">+' + addCount + ' added</span><span class="jf-diff-stat-remove">-' + removeCount + ' removed</span><span class="jf-diff-stat-same">' + sameCount + ' unchanged</span>';
        diffResult.style.display = 'block';
    };

    window.jfSwapDiff = function () { var tmp = diffLeft.value; diffLeft.value = diffRight.value; diffRight.value = tmp; };
    window.jfClearDiff = function () { diffLeft.value = ''; diffRight.value = ''; diffResult.style.display = 'none'; diffOutput.innerHTML = ''; hideDiffError(); };

    window.jfSwitchMode = function (mode) {
        document.querySelectorAll('.jf-tab').forEach(function (tab) { tab.classList.toggle('active', tab.getAttribute('data-mode') === mode); });
        var singleSection = document.getElementById('jf-single-section');
        var diffSection = document.getElementById('jf-diff-section');
        if (mode === 'single') { singleSection.classList.add('active'); diffSection.classList.remove('active'); }
        else { singleSection.classList.remove('active'); diffSection.classList.add('active'); }
    };

    input.addEventListener('input', updateInputInfo);
    function handleTab(e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            var ta = e.target, start = ta.selectionStart, end = ta.selectionEnd;
            ta.value = ta.value.substring(0, start) + '  ' + ta.value.substring(end);
            ta.selectionStart = ta.selectionEnd = start + 2;
        }
    }
    input.addEventListener('keydown', handleTab);
    diffLeft.addEventListener('keydown', handleTab);
    diffRight.addEventListener('keydown', handleTab);
})();
