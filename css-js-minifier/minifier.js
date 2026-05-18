(function () {
    'use strict';

    let minifiedFiles = [];
    let currentPasteType = 'css';

    const dropzone       = document.getElementById('dropzone');
    const fileInput      = document.getElementById('file-input');
    const fileSection    = document.getElementById('file-section');
    const pasteSection   = document.getElementById('paste-section');
    const pasteInput     = document.getElementById('paste-input');
    const pasteOutput    = document.getElementById('paste-output');
    const pasteError     = document.getElementById('paste-error');
    const processing     = document.getElementById('processing');
    const results        = document.getElementById('results');
    const resultsBody    = document.getElementById('results-body');

    const optCompress    = document.getElementById('mn-opt-compress');
    const optMangle      = document.getElementById('mn-opt-mangle');
    const optComments    = document.getElementById('mn-opt-comments');
    const optRestructure = document.getElementById('mn-opt-restructure');

    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        const kb = bytes / 1024;
        if (kb < 1024) return kb.toFixed(1) + ' KB';
        return (kb / 1024).toFixed(2) + ' MB';
    }

    function pct(original, minified) {
        if (original === 0) return '0';
        return ((1 - minified / original) * 100).toFixed(1);
    }

    function getExtension(filename) {
        const dot = filename.lastIndexOf('.');
        return dot === -1 ? '' : filename.substring(dot + 1).toLowerCase();
    }

    function showError(el, msg) { el.textContent = msg; el.classList.add('visible'); }
    function hideError(el) { el.textContent = ''; el.classList.remove('visible'); }

    function getOptions() {
        return {
            compress: optCompress ? optCompress.checked : true,
            mangle:   optMangle ? optMangle.checked : true,
            comments: optComments ? optComments.checked : false,
            restructure: optRestructure ? optRestructure.checked : true
        };
    }

    function minifyCSS(code) {
        try {
            if (typeof csso === 'undefined') throw new Error('csso library not loaded. Please refresh the page.');
            var opts = getOptions();
            var result = csso.minify(code, { restructure: opts.restructure });
            return { success: true, code: result.css };
        } catch (e) { return { success: false, error: e.message }; }
    }

    async function minifyJS(code) {
        try {
            if (typeof Terser === 'undefined') throw new Error('Terser library not loaded. Please refresh the page.');
            var opts = getOptions();
            var result = await Terser.minify(code, {
                compress: opts.compress ? { dead_code: true, drop_console: false } : false,
                mangle: opts.mangle,
                output: { comments: opts.comments ? 'some' : false }
            });
            if (result.error) return { success: false, error: result.error.message };
            return { success: true, code: result.code };
        } catch (e) { return { success: false, error: e.message }; }
    }

    async function minifyContent(content, type) {
        if (type === 'css') return minifyCSS(content);
        if (type === 'js') return await minifyJS(content);
        return { success: false, error: 'Unsupported file type.' };
    }

    async function processFiles(fileList) {
        const validFiles = [];
        const rejectedNames = [];
        for (const file of fileList) {
            const ext = getExtension(file.name);
            if (ext === 'css' || ext === 'js') validFiles.push(file);
            else rejectedNames.push(file.name);
        }

        if (rejectedNames.length > 0 && validFiles.length === 0) {
            showError(pasteError, 'No CSS or JS files found. Rejected: ' + rejectedNames.join(', '));
            return;
        }
        if (rejectedNames.length > 0) {
            showError(pasteError, 'Skipped non-CSS/JS files: ' + rejectedNames.join(', '));
        }
        if (validFiles.length === 0) return;

        hideError(pasteError);
        processing.classList.add('visible');
        results.classList.remove('visible');

        for (const file of validFiles) {
            const ext = getExtension(file.name);
            const content = await file.text();
            const result = await minifyContent(content, ext);
            if (result.success) {
                minifiedFiles.push({
                    name: file.name, type: ext, original: content, minified: result.code,
                    originalSize: new Blob([content]).size, minifiedSize: new Blob([result.code]).size
                });
            } else {
                minifiedFiles.push({
                    name: file.name, type: ext, original: content, minified: null,
                    originalSize: new Blob([content]).size, minifiedSize: 0, error: result.error
                });
            }
        }

        processing.classList.remove('visible');
        renderResults();
    }

    function renderResults() {
        if (minifiedFiles.length === 0) { results.classList.remove('visible'); return; }
        results.classList.add('visible');
        resultsBody.innerHTML = '';

        let totalOriginal = 0, totalMinified = 0, successCount = 0;

        minifiedFiles.forEach(function (file, idx) {
            const tr = document.createElement('tr');
            if (file.error) {
                tr.innerHTML =
                    '<td>' + escapeHtml(file.name) + '</td>' +
                    '<td><span class="mn-file-type ' + file.type + '">' + file.type + '</span></td>' +
                    '<td>' + formatBytes(file.originalSize) + '</td>' +
                    '<td colspan="2" style="color: #fca5a5;">Error: ' + escapeHtml(file.error) + '</td><td></td>';
            } else {
                const saved = pct(file.originalSize, file.minifiedSize);
                totalOriginal += file.originalSize;
                totalMinified += file.minifiedSize;
                successCount++;
                tr.innerHTML =
                    '<td>' + escapeHtml(file.name) + '</td>' +
                    '<td><span class="mn-file-type ' + file.type + '">' + file.type + '</span></td>' +
                    '<td>' + formatBytes(file.originalSize) + '</td>' +
                    '<td>' + formatBytes(file.minifiedSize) + '</td>' +
                    '<td><span class="mn-savings">-' + saved + '%</span></td>' +
                    '<td><button class="mn-download-btn" data-action="mn-download" data-idx="' + idx + '"><i class="fas fa-download"></i></button></td>';
            }
            resultsBody.appendChild(tr);
        });

        document.getElementById('stat-files').textContent = successCount;
        document.getElementById('stat-original').textContent = formatBytes(totalOriginal);
        document.getElementById('stat-minified').textContent = formatBytes(totalMinified);
        document.getElementById('stat-saved').textContent = totalOriginal > 0 ? pct(totalOriginal, totalMinified) + '%' : '0%';
        document.getElementById('download-all-btn').style.display = successCount > 1 ? 'inline-flex' : 'none';
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function triggerDownload(filename, content) {
        var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function downloadSingle(idx) {
        var file = minifiedFiles[idx];
        if (!file || file.error) return;
        triggerDownload(file.name, file.minified);
    }

    document.addEventListener('click', function (e) {
        var target = e.target.closest('[data-action="mn-download"]');
        if (target) downloadSingle(parseInt(target.getAttribute('data-idx'), 10));
    });

    window.downloadAll = async function () {
        if (typeof JSZip === 'undefined') { alert('JSZip library not loaded. Please refresh the page.'); return; }
        var zip = new JSZip();
        minifiedFiles.forEach(function (file) { if (!file.error && file.minified) zip.file(file.name, file.minified); });
        var blob = await zip.generateAsync({ type: 'blob' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = 'minified-files.zip';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    window.clearResults = function () {
        minifiedFiles = [];
        resultsBody.innerHTML = '';
        results.classList.remove('visible');
    };

    window.minifyPaste = async function () {
        var inputVal = pasteInput.value.trim();
        hideError(pasteError);
        pasteOutput.value = '';
        if (!inputVal) { showError(pasteError, 'Please paste some code first.'); return; }
        var result = await minifyContent(inputVal, currentPasteType);
        if (result.success) pasteOutput.value = result.code;
        else showError(pasteError, 'Minification error: ' + result.error);
    };

    window.copyOutput = function () {
        var text = pasteOutput.value;
        if (!text) return;
        navigator.clipboard.writeText(text).then(function () {
            var btn = document.querySelector('.mn-paste-actions button:nth-child(2)');
            var orig = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(function () { btn.innerHTML = orig; }, 1500);
        }).catch(function (err) { console.warn('[minifier] clipboard copy failed', err); });
    };

    window.downloadPasteOutput = function () {
        var text = pasteOutput.value;
        if (!text) return;
        var ext = currentPasteType === 'css' ? '.css' : '.js';
        triggerDownload('minified' + ext, text);
    };

    window.switchPasteType = function (type) {
        currentPasteType = type;
        document.querySelectorAll('.mn-paste-type-btn').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-type') === type);
        });
        pasteInput.placeholder = type === 'css' ? 'Paste your CSS code here...' : 'Paste your JavaScript code here...';
    };

    window.switchMode = function (mode) {
        document.querySelectorAll('.mn-tab').forEach(function (tab) {
            tab.classList.toggle('active', tab.getAttribute('data-mode') === mode);
        });
        if (mode === 'file') { fileSection.classList.add('active'); pasteSection.classList.remove('active'); }
        else { fileSection.classList.remove('active'); pasteSection.classList.add('active'); }
    };

    fileInput.addEventListener('change', function (e) {
        if (e.target.files.length > 0) processFiles(e.target.files);
        e.target.value = '';
    });

    dropzone.addEventListener('dragover', function (e) { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', function () { dropzone.classList.remove('dragover'); });
    dropzone.addEventListener('drop', function (e) {
        e.preventDefault(); dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
    });
})();
