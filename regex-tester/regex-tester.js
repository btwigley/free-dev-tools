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
    const replacePatternEl = document.getElementById('rt-replace-pattern');
    const replaceOutputEl = document.getElementById('rt-replace-output');

    const flagButtons = document.querySelectorAll('.rt-flag');
    const MAX_MATCHES = 10000;
    const TIMEOUT_MS = 1000;

    let _wUrl = null;
    function wUrl() {
        if (_wUrl) return _wUrl;
        // After an empty match the scan steps forward by one code point when the u or v flag is set (the spec's
        // AdvanceStringIndex): stepping one UTF-16 unit into a surrogate pair makes exec match the pair's start
        // again, forever. A lone high surrogate still steps by one unit.
        const src = `function adv(s,i,u){if(!u||i+1>=s.length)return i+1;var c=s.charCodeAt(i);
if(c>=0xD800&&c<=0xDBFF){var n=s.charCodeAt(i+1);if(n>=0xDC00&&n<=0xDFFF)return i+2}return i+1}
self.onmessage=function(e){
var d=e.data,r;
try{r=new RegExp(d.p,d.f)}catch(err){postMessage({k:'e',v:err.message});return}
var ms=[],gl=d.f.indexOf('g')>=0,m,u=!!(r.unicode||r.unicodeSets);
if(gl){while((m=r.exec(d.t))!==null&&ms.length<d.m){
var ng=null;if(m.groups){ng={};for(var k in m.groups)ng[k]=m.groups[k]}
ms.push({v:m[0],i:m.index,l:m[0].length,g:Array.prototype.slice.call(m,1),n:ng});
if(!m[0].length){r.lastIndex=adv(d.t,r.lastIndex,u);if(r.lastIndex>d.t.length)break}
}}else{m=r.exec(d.t);if(m){
var ng=null;if(m.groups){ng={};for(var k in m.groups)ng[k]=m.groups[k]}
ms.push({v:m[0],i:m.index,l:m[0].length,g:Array.prototype.slice.call(m,1),n:ng})}}
postMessage({k:'r',ms:ms,tr:gl&&ms.length>=d.m})}`;
        _wUrl = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
        return _wUrl;
    }

    function getFlags() {
        let f = '';
        flagButtons.forEach(btn => { if (btn.classList.contains('active')) f += btn.dataset.flag; });
        return f;
    }

    flagButtons.forEach(btn => {
        btn.setAttribute('aria-pressed', btn.classList.contains('active') ? 'true' : 'false');
        btn.addEventListener('click', () => {
            btn.setAttribute('aria-pressed', btn.classList.toggle('active') ? 'true' : 'false');
            runMatch();
        });
    });

    function esc(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    let activeW = null;
    let safePattern = null, safeFlags = null, safeText = null;

    function runMatch() {
        const pattern = patternInput.value;
        const text = testInput.value;
        const flags = getFlags();

        if (activeW) { activeW.terminate(); activeW = null; }
        errorDiv.classList.remove('visible');
        matchCount.textContent = '';
        resultsBody.innerHTML = '';

        if (!pattern) {
            renderDiv.innerHTML = esc(text) || '';
            resultsPanel.style.display = 'none';
            safePattern = null;
            doReplace();
            return;
        }

        try { new RegExp(pattern, flags); } catch (e) {
            errorMsg.textContent = e.message;
            errorDiv.classList.add('visible');
            renderDiv.innerHTML = esc(text) || '';
            resultsPanel.style.display = 'none';
            safePattern = null;
            doReplace();
            return;
        }

        if (!text) {
            renderDiv.innerHTML = '';
            resultsPanel.style.display = 'none';
            safePattern = pattern; safeFlags = flags; safeText = text;
            doReplace();
            return;
        }

        const w = new Worker(wUrl());
        activeW = w;
        let expired = false;

        const timer = setTimeout(() => {
            expired = true; w.terminate(); activeW = null;
            errorMsg.textContent = 'Pattern took too long \u2014 likely catastrophic backtracking. Simplify the pattern or avoid nested quantifiers.';
            errorDiv.classList.add('visible');
            renderDiv.innerHTML = esc(text);
            resultsPanel.style.display = 'none';
            safePattern = null;
            doReplace();
        }, TIMEOUT_MS);

        w.onmessage = ev => {
            clearTimeout(timer);
            if (expired) return;
            activeW = null;
            const d = ev.data;
            if (d.k === 'e') {
                errorMsg.textContent = d.v;
                errorDiv.classList.add('visible');
                renderDiv.innerHTML = esc(text);
                resultsPanel.style.display = 'none';
                return;
            }
            paint(text, d.ms);
            showTable(d.ms, d.tr);
            safePattern = pattern; safeFlags = flags; safeText = text;
            doReplace();
        };

        w.onerror = () => {
            clearTimeout(timer);
            if (expired) return;
            activeW = null;
            errorMsg.textContent = 'Unexpected error during matching.';
            errorDiv.classList.add('visible');
        };

        w.postMessage({ p: pattern, f: flags, t: text, m: MAX_MATCHES });
    }

    function paint(text, ms) {
        let html = '', last = 0;
        ms.forEach((m, i) => {
            html += esc(text.slice(last, m.i));
            const cls = i % 2 === 0 ? 'rt-hl' : 'rt-hl-alt';
            html += '<span class="' + cls + '">' + (m.v ? esc(m.v) : '') + '</span>';
            last = m.i + m.l;
        });
        html += esc(text.slice(last));
        renderDiv.innerHTML = html;
        matchCount.textContent = ms.length + ' match' + (ms.length !== 1 ? 'es' : '');
    }

    function showTable(ms, truncated) {
        resultsPanel.style.display = 'block';
        if (!ms.length) {
            resultsBody.innerHTML = '<div class="rt-no-matches">No matches found</div>';
            return;
        }
        let rows = '';
        ms.forEach((m, i) => {
            // Every group keeps its number: an unmatched group reads as a dash, an empty match reads "".
            const indexed = m.g.map((v, gi) => '$' + (gi + 1) + ': ' +
                (v === undefined || v === null ? '<i style="opacity:.5" title="did not participate">&ndash;</i>'
                    : v === '' ? '<i style="opacity:.5">""</i>' : esc(String(v))));
            let named = '';
            if (m.n && Object.keys(m.n).length) {
                named = '<div class="rt-named-groups">' +
                    Object.keys(m.n).map(k =>
                        '<span class="rt-named-tag">' + esc(k) + '=<em>' + (m.n[k] === undefined || m.n[k] === null ? '&ndash;' : esc(String(m.n[k]))) + '</em></span>'
                    ).join(' ') + '</div>';
            }
            rows += '<div class="rt-match-row">' +
                '<span class="rt-match-idx">' + (i + 1) + '</span>' +
                '<span class="rt-match-val">' + (m.v ? esc(m.v) : '<i style="opacity:.5">empty</i>') + '</span>' +
                '<span class="rt-match-pos">' + m.i + '\u2013' + (m.i + m.l) + '</span>' +
                '<span class="rt-match-groups">' + (indexed.length ? indexed.join(', ') : '\u2013') + named + '</span>' +
                '</div>';
        });
        if (truncated) {
            rows += '<div class="rt-truncation-notice"><i class="fas fa-info-circle"></i> Showing first ' +
                MAX_MATCHES.toLocaleString() + ' matches (results truncated).</div>';
        }
        resultsBody.innerHTML = rows;
    }

    // Replacement re-runs the user's pattern over the whole text (past the
    // match cap), so it gets the same Worker and time limit as matching and
    // never runs on the page's own thread.
    let _rUrl = null;
    function rUrl() {
        if (_rUrl) return _rUrl;
        const src = `self.onmessage=function(e){var d=e.data;
try{postMessage({k:'r',v:d.t.replace(new RegExp(d.p,d.f),d.r)})}catch(err){postMessage({k:'e',v:err.message})}}`;
        _rUrl = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
        return _rUrl;
    }

    let replaceW = null, replaceTimer = null;
    function doReplace() {
        if (!replacePatternEl || !replaceOutputEl) return;
        if (replaceW) { replaceW.terminate(); replaceW = null; }
        if (replaceTimer) { clearTimeout(replaceTimer); replaceTimer = null; }
        if (!safePattern || !safeText) { replaceOutputEl.textContent = ''; return; }
        const w = new Worker(rUrl());
        replaceW = w;
        let expired = false;
        const timer = setTimeout(() => {
            if (replaceW !== w) return;   // a newer replacement owns the output
            expired = true; w.terminate();
            replaceW = null; replaceTimer = null;
            replaceOutputEl.textContent = 'Replacement took too long \u2014 likely catastrophic backtracking. Simplify the pattern or avoid nested quantifiers.';
        }, TIMEOUT_MS);
        replaceTimer = timer;
        w.onmessage = ev => {
            clearTimeout(timer);
            if (expired || replaceW !== w) return;
            replaceW = null; replaceTimer = null;
            replaceOutputEl.textContent = ev.data.k === 'r' ? ev.data.v : '';
        };
        w.onerror = () => {
            clearTimeout(timer);
            if (expired || replaceW !== w) return;
            replaceW = null; replaceTimer = null;
            replaceOutputEl.textContent = '';
        };
        w.postMessage({ p: safePattern, f: safeFlags, t: safeText, r: replacePatternEl.value });
    }

    patternInput.addEventListener('input', runMatch);
    testInput.addEventListener('input', () => { runMatch(); syncScroll(); });
    if (replacePatternEl) replacePatternEl.addEventListener('input', doReplace);
    testInput.addEventListener('scroll', syncScroll);

    function syncScroll() {
        renderDiv.scrollTop = testInput.scrollTop;
        renderDiv.scrollLeft = testInput.scrollLeft;
    }

    patternInput.value = '\\b\\w+@\\w+\\.\\w+\\b';
    testInput.value = 'Contact us at hello@example.com or support@wigleystudios.com for help.\nInvalid: not-an-email, @missing, test@.broken';
    runMatch();
})();
