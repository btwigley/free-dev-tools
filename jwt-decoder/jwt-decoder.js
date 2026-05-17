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

    const CLAIM_DESCRIPTIONS = {
        iss: 'Issuer',
        sub: 'Subject',
        aud: 'Audience',
        exp: 'Expiration Time',
        nbf: 'Not Before',
        iat: 'Issued At',
        jti: 'JWT ID',
        name: 'Full Name',
        email: 'Email Address',
        role: 'Role',
        scope: 'Scope',
        permissions: 'Permissions',
        azp: 'Authorized Party',
        nonce: 'Nonce',
        at_hash: 'Access Token Hash',
        typ: 'Token Type',
        sid: 'Session ID'
    };

    const TIME_CLAIMS = new Set(['exp', 'iat', 'nbf', 'auth_time']);

    function b64Decode(str) {
        let s = str.replace(/-/g, '+').replace(/_/g, '/');
        while (s.length % 4) s += '=';
        return decodeURIComponent(
            atob(s).split('').map(c =>
                '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
            ).join('')
        );
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
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                timeZoneName: 'short'
            });
        } catch {
            return null;
        }
    }

    function decode() {
        const token = input.value.trim();

        errorDiv.classList.remove('visible');
        statusDiv.classList.add('jd-hidden');
        decodedDiv.classList.add('jd-hidden');
        claimsDiv.classList.add('jd-hidden');

        if (!token) return;

        const parts = token.split('.');
        if (parts.length !== 3) {
            errorMsg.textContent = 'Invalid JWT format. A JWT must have exactly three parts separated by dots (header.payload.signature).';
            errorDiv.classList.add('visible');
            return;
        }

        let header, payload;
        try {
            header = JSON.parse(b64Decode(parts[0]));
        } catch (e) {
            errorMsg.textContent = 'Failed to decode header: ' + e.message;
            errorDiv.classList.add('visible');
            return;
        }

        try {
            payload = JSON.parse(b64Decode(parts[1]));
        } catch (e) {
            errorMsg.textContent = 'Failed to decode payload: ' + e.message;
            errorDiv.classList.add('visible');
            return;
        }

        headerDiv.innerHTML = syntaxHighlight(header);
        payloadDiv.innerHTML = syntaxHighlight(payload);
        signatureDiv.textContent = parts[2];
        decodedDiv.classList.remove('jd-hidden');

        // Expiration status
        let statusHtml = '';
        if (payload.exp) {
            const now = Math.floor(Date.now() / 1000);
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
    }

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
