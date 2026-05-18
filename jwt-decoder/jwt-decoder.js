(function () {
    'use strict';

    const input = document.getElementById('jd-input');
    const errorDiv = document.getElementById('jd-error');
    const errorMsg = document.getElementById('jd-error-msg');
    const statusDiv = document.getElementById('jd-status');
    const decodedDiv = document.getElementById('jd-decoded');
    const headerDiv = document.getElementById('jd-header');
    const payloadDiv = document.getElementById('jd-payload');
    const signatureDiv = document.getElementById('jd-signature');
    const claimsDiv = document.getElementById('jd-claims');
    const claimsBody = document.getElementById('jd-claims-body');
    const algWarningDiv = document.getElementById('jd-alg-warning');
    const verifySection = document.getElementById('jd-verify-section');
    const verifyKeyInput = document.getElementById('jd-verify-key');
    const verifyResultDiv = document.getElementById('jd-verify-result');
    const verifyAlgLabel = document.getElementById('jd-verify-alg');
    const verifyKeyLabel = document.getElementById('jd-verify-key-label');

    const CLAIM_DESCRIPTIONS = {
        iss: 'Issuer', sub: 'Subject', aud: 'Audience', exp: 'Expiration Time',
        nbf: 'Not Before', iat: 'Issued At', jti: 'JWT ID', name: 'Full Name',
        email: 'Email Address', role: 'Role', scope: 'Scope', permissions: 'Permissions',
        azp: 'Authorized Party', nonce: 'Nonce', at_hash: 'Access Token Hash',
        typ: 'Token Type', sid: 'Session ID'
    };

    const TIME_CLAIMS = new Set(['exp', 'iat', 'nbf', 'auth_time']);
    const HMAC_ALG = { HS256: 'SHA-256', HS384: 'SHA-384', HS512: 'SHA-512' };
    const RSA_ALG = { RS256: 'SHA-256', RS384: 'SHA-384', RS512: 'SHA-512' };
    const PSS_ALG = { PS256: { hash: 'SHA-256', salt: 32 }, PS384: { hash: 'SHA-384', salt: 48 }, PS512: { hash: 'SHA-512', salt: 64 } };
    const EC_ALG = { ES256: { hash: 'SHA-256', curve: 'P-256' }, ES384: { hash: 'SHA-384', curve: 'P-384' }, ES512: { hash: 'SHA-512', curve: 'P-521' } };

    let lastParts = null;
    let lastHeader = null;

    function b64Decode(str) {
        let s = str.replace(/-/g, '+').replace(/_/g, '/');
        while (s.length % 4) s += '=';
        return decodeURIComponent(
            atob(s).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
        );
    }

    function b64ToUint8(str) {
        let s = str.replace(/-/g, '+').replace(/_/g, '/');
        while (s.length % 4) s += '=';
        const bin = atob(s);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return arr;
    }

    function pemToBuffer(pem) {
        const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
        return b64ToUint8(b64);
    }

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function syntaxHighlight(json) {
        const str = JSON.stringify(json, null, 2);
        return str.replace(
            /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
            function (match) {
                let cls = 'jd-number';
                if (/^"/.test(match)) {
                    cls = /:$/.test(match) ? 'jd-key' : 'jd-string';
                } else if (/true|false/.test(match)) {
                    cls = 'jd-boolean';
                } else if (/null/.test(match)) {
                    cls = 'jd-null';
                }
                return '<span class="' + cls + '">' + escapeHtml(match) + '</span>';
            }
        );
    }

    function formatTimestamp(ts) {
        try {
            const d = new Date(ts * 1000);
            if (isNaN(d.getTime())) return null;
            return d.toLocaleString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short'
            });
        } catch { return null; }
    }

    function decode() {
        const token = input.value.trim();

        errorDiv.classList.remove('visible');
        statusDiv.classList.add('jd-hidden');
        decodedDiv.classList.add('jd-hidden');
        claimsDiv.classList.add('jd-hidden');
        if (algWarningDiv) algWarningDiv.classList.remove('visible');
        if (verifySection) verifySection.classList.add('jd-hidden');
        if (verifyResultDiv) verifyResultDiv.innerHTML = '';

        lastParts = null;
        lastHeader = null;

        if (!token) return;

        const parts = token.split('.');
        if (parts.length !== 3) {
            errorMsg.textContent = 'Invalid JWT format. A JWT must have exactly three parts separated by dots (header.payload.signature).';
            errorDiv.classList.add('visible');
            return;
        }

        let header, payload;
        try { header = JSON.parse(b64Decode(parts[0])); } catch (e) {
            errorMsg.textContent = 'Failed to decode header: ' + e.message;
            errorDiv.classList.add('visible');
            return;
        }

        try { payload = JSON.parse(b64Decode(parts[1])); } catch (e) {
            errorMsg.textContent = 'Failed to decode payload: ' + e.message;
            errorDiv.classList.add('visible');
            return;
        }

        lastParts = parts;
        lastHeader = header;

        headerDiv.innerHTML = syntaxHighlight(header);
        payloadDiv.innerHTML = syntaxHighlight(payload);
        signatureDiv.textContent = parts[2];
        decodedDiv.classList.remove('jd-hidden');

        // alg:none warning (CVE-2015-9235)
        const algVal = (header.alg || '').toLowerCase();
        if (algWarningDiv) {
            if (!header.alg || algVal === 'none') {
                algWarningDiv.classList.add('visible');
            }
        }

        // Expiration + temporal validation
        const now = Math.floor(Date.now() / 1000);
        let statusHtml = '';

        if (payload.exp) {
            if (now < payload.exp) {
                const remaining = payload.exp - now;
                const hours = Math.floor(remaining / 3600);
                const mins = Math.floor((remaining % 3600) / 60);
                statusHtml += '<span class="jd-status-pill jd-status-valid"><i class="fas fa-check-circle"></i> Valid &mdash; expires in ' + hours + 'h ' + mins + 'm</span>';
            } else {
                const ago = now - payload.exp;
                const days = Math.floor(ago / 86400);
                const hours = Math.floor((ago % 86400) / 3600);
                statusHtml += '<span class="jd-status-pill jd-status-expired"><i class="fas fa-times-circle"></i> Expired &mdash; ' + (days > 0 ? days + 'd ' : '') + hours + 'h ago</span>';
            }
        } else {
            statusHtml += '<span class="jd-status-pill jd-status-no-exp"><i class="fas fa-info-circle"></i> No expiration claim (exp)</span>';
        }

        if (payload.nbf && typeof payload.nbf === 'number' && now < payload.nbf) {
            statusHtml += '<span class="jd-status-pill jd-status-nbf-warn"><i class="fas fa-clock"></i> Not yet valid (nbf: ' + escapeHtml(formatTimestamp(payload.nbf) || String(payload.nbf)) + ')</span>';
        }

        if (payload.iat && typeof payload.iat === 'number' && payload.iat > now + 60) {
            statusHtml += '<span class="jd-status-pill jd-status-iat-warn"><i class="fas fa-exclamation-circle"></i> Issued in the future (iat)</span>';
        }

        statusDiv.innerHTML = statusHtml;
        statusDiv.classList.remove('jd-hidden');

        // Claims table
        const keys = Object.keys(payload);
        if (keys.length > 0) {
            let rows = '';
            keys.forEach(key => {
                const val = payload[key];
                const desc = CLAIM_DESCRIPTIONS[key] || '';
                let displayVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
                let timeStr = '';
                if (TIME_CLAIMS.has(key) && typeof val === 'number') {
                    const formatted = formatTimestamp(val);
                    if (formatted) timeStr = '<div class="jd-claim-time">' + escapeHtml(formatted) + '</div>';
                }
                rows += '<div class="jd-claim-row">' +
                    '<span class="jd-claim-name">' + escapeHtml(key) + '</span>' +
                    '<span class="jd-claim-value">' + escapeHtml(displayVal) + timeStr + '</span>' +
                    '<span class="jd-claim-desc">' + escapeHtml(desc) + '</span>' +
                    '</div>';
            });
            claimsBody.innerHTML = rows;
            claimsDiv.classList.remove('jd-hidden');
        }

        // Signature verification panel
        if (verifySection && header.alg && algVal !== 'none') {
            const alg = header.alg.toUpperCase();
            const isHmac = !!HMAC_ALG[alg];
            if (verifyAlgLabel) verifyAlgLabel.textContent = header.alg;
            if (verifyKeyLabel) verifyKeyLabel.textContent = isHmac ? 'Secret' : 'Public Key (PEM)';
            if (verifyKeyInput) verifyKeyInput.placeholder = isHmac
                ? 'Enter the HMAC secret...'
                : '-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----';
            verifySection.classList.remove('jd-hidden');
        }
    }

    window.jdVerify = async function () {
        if (!verifyResultDiv || !verifyKeyInput || !lastParts || !lastHeader) return;
        const keyVal = verifyKeyInput.value.trim();
        if (!keyVal) {
            verifyResultDiv.innerHTML = '<span class="jd-verify-error">Please enter a secret or public key.</span>';
            return;
        }

        const alg = (lastHeader.alg || '').toUpperCase();
        const data = new TextEncoder().encode(lastParts[0] + '.' + lastParts[1]);
        const sig = b64ToUint8(lastParts[2]);

        try {
            let valid = false;

            if (HMAC_ALG[alg]) {
                const key = await crypto.subtle.importKey(
                    'raw', new TextEncoder().encode(keyVal),
                    { name: 'HMAC', hash: HMAC_ALG[alg] }, false, ['verify']
                );
                valid = await crypto.subtle.verify('HMAC', key, sig, data);
            } else if (RSA_ALG[alg]) {
                const key = await crypto.subtle.importKey(
                    'spki', pemToBuffer(keyVal),
                    { name: 'RSASSA-PKCS1-v1_5', hash: RSA_ALG[alg] }, false, ['verify']
                );
                valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, data);
            } else if (PSS_ALG[alg]) {
                const cfg = PSS_ALG[alg];
                const key = await crypto.subtle.importKey(
                    'spki', pemToBuffer(keyVal),
                    { name: 'RSA-PSS', hash: cfg.hash }, false, ['verify']
                );
                valid = await crypto.subtle.verify({ name: 'RSA-PSS', saltLength: cfg.salt }, key, sig, data);
            } else if (EC_ALG[alg]) {
                const cfg = EC_ALG[alg];
                const key = await crypto.subtle.importKey(
                    'spki', pemToBuffer(keyVal),
                    { name: 'ECDSA', namedCurve: cfg.curve }, false, ['verify']
                );
                valid = await crypto.subtle.verify({ name: 'ECDSA', hash: cfg.hash }, key, sig, data);
            } else {
                verifyResultDiv.innerHTML = '<span class="jd-verify-error">Unsupported algorithm: ' + escapeHtml(alg) + '</span>';
                return;
            }

            if (valid) {
                verifyResultDiv.innerHTML = '<span class="jd-verify-valid"><i class="fas fa-check-circle"></i> Signature is valid</span>';
            } else {
                verifyResultDiv.innerHTML = '<span class="jd-verify-invalid"><i class="fas fa-times-circle"></i> Signature is invalid</span>';
            }
        } catch (e) {
            verifyResultDiv.innerHTML = '<span class="jd-verify-error"><i class="fas fa-exclamation-triangle"></i> ' + escapeHtml(e.message || 'Verification failed') + '</span>';
        }
    };

    window.jdClear = function () {
        input.value = '';
        decode();
    };

    let debounceTimer;
    input.addEventListener('input', function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(decode, 150);
    });

    if (input.value.trim()) {
        decode();
    }
})();
