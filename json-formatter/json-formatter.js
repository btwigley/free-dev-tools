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
    var copyBtn     = document.getElementById('jf-copy-btn');
    var downloadBtn = document.getElementById('jf-download-btn');

    var lastFormattedText = '';
    var DIFF_LINE_LIMIT = 50000;
    var DIFF_CELL_LIMIT = 4000000;

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
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

    // One tokenizing pass over the raw text. Each token is escaped as it is emitted, so the class names are the only
    // markup, and digits or "true" inside a string are never colored.
    var HL_RE = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
    function syntaxHighlight(json) {
        var out = '', last = 0, m;
        HL_RE.lastIndex = 0;
        while ((m = HL_RE.exec(json)) !== null) {
            out += escapeHtml(json.slice(last, m.index));
            if (m[1] !== undefined) {
                out += m[2] !== undefined
                    ? '<span class="jf-key">' + escapeHtml(m[1]) + '</span>' + m[2].slice(0, -1) + '<span class="jf-colon">:</span>'
                    : '<span class="jf-string">' + escapeHtml(m[1]) + '</span>';
            } else if (m[3] !== undefined) {
                out += '<span class="' + (m[3] === 'null' ? 'jf-null' : 'jf-boolean') + '">' + m[3] + '</span>';
            } else {
                out += '<span class="jf-number">' + m[0] + '</span>';
            }
            last = HL_RE.lastIndex;
        }
        return out + escapeHtml(json.slice(last));
    }

    // JSON.parse only validates. Output is built by re-indenting the validated token stream, never by
    // JSON.stringify of parsed values, so a number keeps its exact digits (no 2^53 rounding, no 1e400 -> null),
    // keys keep their order (integer-like keys are not hoisted) and a duplicate key stays where it was written.
    var NUM_RE = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
    function tokenize(text) {
        var toks = [], i = 0, n = text.length, c, j, m;
        while (i < n) {
            c = text.charAt(i);
            if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
            if (c === '"') {
                j = i + 1;
                while (j < n && text.charAt(j) !== '"') { if (text.charAt(j) === '\\') j++; j++; }
                toks.push({ t: 's', v: text.slice(i, j + 1) });
                i = j + 1;
                continue;
            }
            if ('{}[]:,'.indexOf(c) !== -1) { toks.push({ t: c, v: c }); i++; continue; }
            if (c === 't' || c === 'n') { toks.push({ t: 'l', v: text.substr(i, 4) }); i += 4; continue; }
            if (c === 'f') { toks.push({ t: 'l', v: 'false' }); i += 5; continue; }
            NUM_RE.lastIndex = i;
            m = NUM_RE.exec(text);
            if (!m) throw new Error('Unexpected character at position ' + i);
            toks.push({ t: 'n', v: m[0] });
            i += m[0].length;
        }
        return toks;
    }

    // Keys that appear twice in one object (compared after unescaping, so "a" and "\u0061" collide).
    function findDuplicateKeys(toks) {
        var stack = [], dups = [], i, t, keys, k;
        for (i = 0; i < toks.length; i++) {
            t = toks[i].t;
            if (t === '{') stack.push(new Set());
            else if (t === '[') stack.push(null);
            else if (t === '}' || t === ']') stack.pop();
            else if (t === 's' && toks[i + 1] && toks[i + 1].t === ':') {
                keys = stack[stack.length - 1];
                k = JSON.parse(toks[i].v);
                if (keys.has(k)) dups.push(k); else keys.add(k);
            }
        }
        return dups;
    }

    // indent: a number of spaces, '\t', or 0 for minified output. Same layout as JSON.stringify(v, null, indent).
    function formatTokens(toks, indent) {
        var unit = indent === '\t' ? '\t' : ' '.repeat(indent || 0);
        var nl = unit ? '\n' : '', colon = unit ? ': ' : ':';
        var pads = [''], depth = 0, out = [], i, t, next;
        function pad(d) { while (pads.length <= d) pads.push(pads[pads.length - 1] + unit); return pads[d]; }
        for (i = 0; i < toks.length; i++) {
            t = toks[i].t;
            if (t === '{' || t === '[') {
                next = toks[i + 1];
                if (next && (next.t === '}' || next.t === ']')) { out.push(t + next.t); i++; continue; }
                depth++;
                out.push(t + nl + pad(depth));
            } else if (t === '}' || t === ']') {
                depth--;
                out.push(nl + pad(depth) + t);
            } else if (t === ',') out.push(',' + nl + pad(depth));
            else if (t === ':') out.push(colon);
            else out.push(toks[i].v);
        }
        return out.join('');
    }

    // A tree of the source as written: {k:'o', e:[[key, node]...]}, {k:'a', e:[node...]}, {k:'s'|'n'|'l', v:raw}.
    function buildAst(toks) {
        var root = null, stack = [], pendingKey, i, tk, node;
        function attach(nd) {
            var top = stack[stack.length - 1];
            if (!top) root = nd;
            else if (top.k === 'o') top.e.push([pendingKey, nd]);
            else top.e.push(nd);
        }
        for (i = 0; i < toks.length; i++) {
            tk = toks[i];
            if (tk.t === '{' || tk.t === '[') { node = { k: tk.t === '{' ? 'o' : 'a', e: [] }; attach(node); stack.push(node); }
            else if (tk.t === '}' || tk.t === ']') stack.pop();
            else if (tk.t === ',' || tk.t === ':') continue;
            else if (tk.t === 's' && toks[i + 1] && toks[i + 1].t === ':') pendingKey = JSON.parse(tk.v);
            else attach({ k: tk.t, v: tk.v });
        }
        return root;
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
    // Built from the source tree, so values read exactly as written. Only the top two levels (and at most
    // TREE_OPEN_BUDGET nodes) render open; a deeper branch builds its children when it is first expanded, and a
    // container shows TREE_CHUNK children at a time with a button for the rest, so nothing is dropped.
    var TREE_OPEN_DEPTH = 2, TREE_CHUNK = 500, TREE_OPEN_BUDGET = 2000;
    function treeEl(tag, cls, text) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text !== undefined) e.textContent = text;
        return e;
    }
    function treeLabel(parent, key) {
        if (key === undefined) return;
        parent.appendChild(treeEl('span', 'jf-tree-key', String(key)));
        parent.appendChild(document.createTextNode(': '));
    }
    function buildTreeNode(node, key, depth, budget) {
        if (node.k !== 'o' && node.k !== 'a') {
            var leaf = treeEl('div', 'jf-tree-leaf');
            treeLabel(leaf, key);
            var cls = node.k === 's' ? 'jf-string' : node.k === 'n' ? 'jf-number' : node.v === 'null' ? 'jf-null' : 'jf-boolean';
            leaf.appendChild(treeEl('span', cls, node.v));
            return leaf;
        }
        var isObj = node.k === 'o', count = node.e.length;
        if (!count) {
            var empty = treeEl('div', 'jf-tree-leaf');
            treeLabel(empty, key);
            empty.appendChild(treeEl('span', 'jf-bracket', isObj ? '{}' : '[]'));
            return empty;
        }
        var det = treeEl('details'), sum = treeEl('summary'), kids = treeEl('div', 'jf-tree-children');
        treeLabel(sum, key);
        sum.appendChild(treeEl('span', 'jf-bracket', isObj ? 'Object{' + count + '}' : 'Array[' + count + ']'));
        det.appendChild(sum);
        det.appendChild(kids);
        var shown = 0;
        function more() {
            var end = Math.min(count, shown + TREE_CHUNK), frag = document.createDocumentFragment(), entry;
            for (; shown < end; shown++) {
                entry = node.e[shown];
                budget.n++;
                frag.appendChild(isObj ? buildTreeNode(entry[1], entry[0], depth + 1, budget) : buildTreeNode(entry, shown, depth + 1, budget));
            }
            kids.appendChild(frag);
            if (shown < count) {
                var rest = count - shown;
                var btn = treeEl('button', 'jf-tree-more', 'Show ' + Math.min(TREE_CHUNK, rest) + ' more (' + rest + ' not shown)');
                btn.type = 'button';
                btn.addEventListener('click', function () { kids.removeChild(btn); more(); });
                kids.appendChild(btn);
            }
        }
        if (depth < TREE_OPEN_DEPTH && budget.n < TREE_OPEN_BUDGET) { det.open = true; more(); }
        else det.addEventListener('toggle', function () { if (det.open && shown === 0) more(); });
        return det;
    }

    function renderTree(ast) {
        if (!treeOutput) return;
        treeOutput.replaceChildren(buildTreeNode(ast, undefined, 0, { n: 0 }));
        treeOutput.style.display = 'block';
    }

    // --- Repair mode ---
    // Repairs comments, trailing commas, unquoted keys and single-quoted
    // strings in one pass that knows where strings begin and end, so text
    // inside a string (a URL's "//", a "/*", a ",}") is never changed.
    function repairJson(text) {
        var n = text.length, i = 0, out = '', lastSig = '';
        var identRe = /[A-Za-z_$][\w$]*/y;

        function skipSpaceAndComments(j) {
            while (j < n) {
                var c = text.charAt(j);
                if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { j++; continue; }
                if (c === '/' && text.charAt(j + 1) === '/') {
                    while (j < n && text.charAt(j) !== '\n') j++;
                    continue;
                }
                if (c === '/' && text.charAt(j + 1) === '*') {
                    var end = text.indexOf('*/', j + 2);
                    j = end === -1 ? n : end + 2;
                    continue;
                }
                break;
            }
            return j;
        }

        while (i < n) {
            var c = text.charAt(i);
            if (c === '"') {
                var j = i + 1;
                while (j < n && text.charAt(j) !== '"') { if (text.charAt(j) === '\\') j++; j++; }
                out += text.slice(i, j + 1);
                i = j + 1; lastSig = '"';
                continue;
            }
            if (c === "'") {
                var k = i + 1, inner = '';
                while (k < n && text.charAt(k) !== "'") {
                    var ch = text.charAt(k);
                    if (ch === '\\' && k + 1 < n) {
                        var nx = text.charAt(k + 1);
                        inner += nx === "'" ? "'" : '\\' + nx;
                        k += 2;
                        continue;
                    }
                    inner += ch === '"' ? '\\"' : ch;
                    k++;
                }
                out += '"' + inner + '"';
                i = k + 1; lastSig = '"';
                continue;
            }
            if (c === '/' && (text.charAt(i + 1) === '/' || text.charAt(i + 1) === '*')) {
                i = skipSpaceAndComments(i);
                continue;
            }
            if (c === ',') {
                var next = text.charAt(skipSpaceAndComments(i + 1));
                if (next === '}' || next === ']') { i++; continue; }
            }
            if ((lastSig === '{' || lastSig === ',') && /[A-Za-z_$]/.test(c)) {
                identRe.lastIndex = i;
                var m = identRe.exec(text);
                if (m && text.charAt(skipSpaceAndComments(i + m[0].length)) === ':') {
                    out += '"' + m[0] + '"';
                    i += m[0].length; lastSig = '"';
                    continue;
                }
            }
            out += c;
            if (!/\s/.test(c)) lastSig = c;
            i++;
        }
        return out;
    }

    // --- Core Operations ---
    // The raw text is validated untrimmed (JSON allows surrounding whitespace), so a reported line and column
    // match the textarea even after leading blank lines.
    function readJson(raw) {
        var result = parseJsonWithDetail(raw);
        if (!result.success) return result;
        var toks = tokenize(raw);
        return { success: true, data: result.data, toks: toks, dups: findDuplicateKeys(toks) };
    }

    function invalidDetail(result) { return result.position ? result.error + ' (' + result.position + ')' : result.error; }

    function duplicateNote(dups) {
        if (!dups.length) return '';
        var names = dups.slice(0, 3).map(function (k) { return JSON.stringify(k); }).join(', ') + (dups.length > 3 ? ', ...' : '');
        return '. Warning: ' + dups.length + ' duplicate key' + (dups.length === 1 ? '' : 's') + ' (' + names +
            '), kept as written; most JSON parsers keep only the last one';
    }

    // The visible output, the text Copy/Download use, and whether those buttons work always change together.
    function setOutput(text, ast) {
        lastFormattedText = text || '';
        output.innerHTML = lastFormattedText ? syntaxHighlight(lastFormattedText) : '';
        if (treeOutput) {
            if (ast) renderTree(ast);
            else treeOutput.innerHTML = '';
        }
        updateOutputInfo(lastFormattedText);
        [copyBtn, downloadBtn].forEach(function (b) { if (b) b.disabled = !lastFormattedText; });
    }

    window.jfFormat = function () {
        hideMessages();
        var raw = input.value;
        if (!raw.trim()) { setOutput(''); return; }
        var result = readJson(raw);
        if (!result.success) {
            showError('Invalid JSON', invalidDetail(result));
            setOutput('');
            return;
        }
        var formatted = formatTokens(result.toks, getIndent());
        setOutput(formatted, buildAst(result.toks));
        showSuccess('Formatted successfully (' + countLines(formatted) + ' lines)' + duplicateNote(result.dups));
    };

    window.jfMinify = function () {
        hideMessages();
        var raw = input.value;
        if (!raw.trim()) { setOutput(''); return; }
        var result = readJson(raw);
        if (!result.success) {
            showError('Invalid JSON', invalidDetail(result));
            setOutput('');
            return;
        }
        var minified = formatTokens(result.toks, 0);
        setOutput(minified);
        var originalSize = new Blob([raw]).size;
        var minifiedSize = new Blob([minified]).size;
        var saved = originalSize > 0 ? ((1 - minifiedSize / originalSize) * 100).toFixed(1) : 0;
        showSuccess('Minified: ' + formatBytes(originalSize) + ' -> ' + formatBytes(minifiedSize) + ' (-' + saved + '%)' + duplicateNote(result.dups));
    };

    window.jfValidate = function () {
        hideMessages();
        var raw = input.value;
        if (!raw.trim()) { showError('No Input', 'Please paste some JSON to validate.'); return; }
        var result = readJson(raw);
        if (!result.success) {
            showError('Invalid JSON', invalidDetail(result));
            return;
        }
        var type = Array.isArray(result.data) ? 'Array' : result.data === null ? 'null' : typeof result.data;
        showSuccess('Valid JSON (' + type + ', ' + formatBytes(new Blob([raw]).size) + ')' + duplicateNote(result.dups));
    };

    window.jfRepair = function () {
        hideMessages();
        var raw = input.value;
        if (!raw.trim()) { showError('No Input', 'Please paste some JSON to repair.'); return; }
        var tryFirst = parseJsonWithDetail(raw);
        if (tryFirst.success) { showSuccess('JSON is already valid -- no repair needed.'); return; }
        var result = readJson(repairJson(raw));
        if (result.success) {
            var formatted = formatTokens(result.toks, getIndent());
            input.value = formatted;
            setOutput(formatted, buildAst(result.toks));
            updateInputInfo();
            showSuccess('Repaired: removed comments, trailing commas, unquoted keys, and single quotes' + duplicateNote(result.dups) + '.');
        } else {
            // The position refers to the text after the automatic fixes, not to the textarea.
            showError('Repair Failed', 'Could not auto-fix the JSON. In the repaired text: ' + invalidDetail(result));
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
        setOutput('');
        inputInfo.textContent = '';
        hideMessages();
    };

    // --- Diff ---
    // Lines shared at the start and end are matched directly; the LCS table covers only the changed middle, and
    // is refused past DIFF_CELL_LIMIT cells (memory and time grow with lines-changed-left x lines-changed-right).
    function computeDiff(a, b) {
        var start = 0, endA = a.length, endB = b.length, i, j;
        while (start < endA && start < endB && a[start] === b[start]) start++;
        while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
        var m = endA - start, n = endB - start;
        if (m * n > DIFF_CELL_LIMIT) return { tooLarge: true, left: m, right: n };
        var dp = new Array(m + 1);
        for (i = 0; i <= m; i++) dp[i] = new Uint32Array(n + 1);
        for (i = 1; i <= m; i++) {
            for (j = 1; j <= n; j++) {
                dp[i][j] = a[start + i - 1] === b[start + j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
        var mid = [];
        i = m; j = n;
        while (i > 0 || j > 0) {
            if (i > 0 && j > 0 && a[start + i - 1] === b[start + j - 1]) { mid.push({ type: 'same', text: a[start + i - 1] }); i--; j--; }
            else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) { mid.push({ type: 'add', text: b[start + j - 1] }); j--; }
            else { mid.push({ type: 'remove', text: a[start + i - 1] }); i--; }
        }
        var result = [];
        for (i = 0; i < start; i++) result.push({ type: 'same', text: a[i] });
        for (i = mid.length - 1; i >= 0; i--) result.push(mid[i]);
        for (i = endA; i < a.length; i++) result.push({ type: 'same', text: a[i] });
        return result;
    }

    window.jfRunDiff = function () {
        hideDiffError();
        diffResult.style.display = 'none';
        var leftText = diffLeft.value, rightText = diffRight.value;
        if (!leftText.trim() || !rightText.trim()) { showDiffError('Missing Input', 'Please paste JSON in both panels.'); return; }
        var leftResult = readJson(leftText);
        if (!leftResult.success) { showDiffError('Left JSON Invalid', invalidDetail(leftResult)); return; }
        var rightResult = readJson(rightText);
        if (!rightResult.success) { showDiffError('Right JSON Invalid', invalidDetail(rightResult)); return; }

        var leftLines = formatTokens(leftResult.toks, 2).split('\n');
        var rightLines = formatTokens(rightResult.toks, 2).split('\n');

        if (leftLines.length > DIFF_LINE_LIMIT || rightLines.length > DIFF_LINE_LIMIT) {
            showDiffError('Inputs Too Large', 'Diff is limited to ' + DIFF_LINE_LIMIT.toLocaleString() + ' formatted lines per side to prevent browser freezing. Split your data.');
            return;
        }

        var diff = computeDiff(leftLines, rightLines);
        if (diff.tooLarge) {
            showDiffError('Too Many Changes', 'The part that differs is ' + diff.left.toLocaleString() + ' lines on the left and ' +
                diff.right.toLocaleString() + ' on the right, too large to compare here without freezing the browser. Compare smaller sections.');
            return;
        }
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
        document.querySelectorAll('.jf-tab').forEach(function (tab) {
            var on = tab.getAttribute('data-mode') === mode;
            tab.classList.toggle('active', on);
            tab.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        var singleSection = document.getElementById('jf-single-section');
        var diffSection = document.getElementById('jf-diff-section');
        if (mode === 'single') { singleSection.classList.add('active'); diffSection.classList.remove('active'); }
        else { singleSection.classList.remove('active'); diffSection.classList.add('active'); }
    };

    // Tab and Shift+Tab keep their normal job of moving focus (no keyboard trap); Format does the indenting.
    input.addEventListener('input', updateInputInfo);
    setOutput('');
})();
