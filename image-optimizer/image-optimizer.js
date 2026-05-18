(function () {
    'use strict';

    var optimizedImages = [];

    var dropzone     = document.getElementById('io-dropzone');
    var fileInput    = document.getElementById('io-file-input');
    var formatSelect = document.getElementById('io-format');
    var qualitySlider = document.getElementById('io-quality');
    var qualityValue = document.getElementById('io-quality-value');
    var maxWidthInput = document.getElementById('io-max-width');
    var maxHeightInput = document.getElementById('io-max-height');
    var processingEl = document.getElementById('io-processing');
    var errorEl      = document.getElementById('io-error');
    var resultsEl    = document.getElementById('io-results');
    var gridEl       = document.getElementById('io-grid');

    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        var kb = bytes / 1024;
        if (kb < 1024) return kb.toFixed(1) + ' KB';
        return (kb / 1024).toFixed(2) + ' MB';
    }

    function pct(original, optimized) {
        if (original === 0) return '0';
        return ((1 - optimized / original) * 100).toFixed(1);
    }

    function getOutputExtension(mimeType) {
        switch (mimeType) {
            case 'image/webp': return '.webp';
            case 'image/jpeg': return '.jpg';
            case 'image/png':  return '.png';
            case 'image/avif': return '.avif';
            default: return '.webp';
        }
    }

    function getFormatLabel(mimeType) {
        switch (mimeType) {
            case 'image/webp': return 'WebP';
            case 'image/jpeg': return 'JPEG';
            case 'image/png':  return 'PNG';
            case 'image/avif': return 'AVIF';
            default: return 'WebP';
        }
    }

    function replaceExtension(filename, newExt) {
        var dot = filename.lastIndexOf('.');
        var base = dot === -1 ? filename : filename.substring(0, dot);
        return base + newExt;
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function showError(msg) {
        errorEl.textContent = msg;
        errorEl.classList.add('visible');
    }

    function hideError() {
        errorEl.textContent = '';
        errorEl.classList.remove('visible');
    }

    qualitySlider.addEventListener('input', function () {
        qualityValue.textContent = qualitySlider.value + '%';
    });

    // AVIF feature detection: add option if supported
    (function detectAvif() {
        var canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        canvas.toBlob(function (blob) {
            if (blob && blob.type === 'image/avif') {
                var opt = document.createElement('option');
                opt.value = 'image/avif';
                opt.textContent = 'AVIF';
                formatSelect.appendChild(opt);
            }
        }, 'image/avif', 0.5);
    })();

    function getResizeConstraints() {
        var mw = maxWidthInput ? parseInt(maxWidthInput.value, 10) : 0;
        var mh = maxHeightInput ? parseInt(maxHeightInput.value, 10) : 0;
        return { maxWidth: mw > 0 ? mw : 0, maxHeight: mh > 0 ? mh : 0 };
    }

    function computeResizedDimensions(origW, origH, maxW, maxH) {
        var w = origW, h = origH;
        if (maxW > 0 && w > maxW) { h = Math.round(h * (maxW / w)); w = maxW; }
        if (maxH > 0 && h > maxH) { w = Math.round(w * (maxH / h)); h = maxH; }
        return { width: w, height: h };
    }

    function processImage(file, outputFormat, quality) {
        return new Promise(function (resolve) {
            var reader = new FileReader();
            reader.onload = function (e) {
                var img = new Image();
                img.onload = function () {
                    var resize = getResizeConstraints();
                    var dims = computeResizedDimensions(img.naturalWidth, img.naturalHeight, resize.maxWidth, resize.maxHeight);

                    var canvas = document.createElement('canvas');
                    canvas.width = dims.width;
                    canvas.height = dims.height;
                    var ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, dims.width, dims.height);

                    var qualityParam = quality / 100;
                    canvas.toBlob(function (blob) {
                        if (!blob) {
                            resolve({ success: false, name: file.name, error: 'Conversion failed -- format may not be supported by this browser.' });
                            return;
                        }
                        var previewUrl = URL.createObjectURL(blob);
                        resolve({
                            success: true, name: file.name,
                            outputName: replaceExtension(file.name, getOutputExtension(outputFormat)),
                            originalSize: file.size, optimizedSize: blob.size,
                            width: dims.width, height: dims.height,
                            originalWidth: img.naturalWidth, originalHeight: img.naturalHeight,
                            blob: blob, previewUrl: previewUrl, format: outputFormat
                        });
                    }, outputFormat, qualityParam);
                };
                img.onerror = function () { resolve({ success: false, name: file.name, error: 'Could not load image.' }); };
                img.src = e.target.result;
            };
            reader.onerror = function () { resolve({ success: false, name: file.name, error: 'Could not read file.' }); };
            reader.readAsDataURL(file);
        });
    }

    async function processFiles(fileList) {
        var imageFiles = [];
        for (var i = 0; i < fileList.length; i++) {
            if (fileList[i].type.startsWith('image/')) imageFiles.push(fileList[i]);
        }

        if (imageFiles.length === 0) {
            showError('No valid image files found. Please select PNG, JPG, GIF, BMP, SVG, or WebP files.');
            return;
        }

        hideError();
        processingEl.classList.add('visible');
        resultsEl.classList.remove('visible');

        // Revoke stale blob URLs before reprocessing
        optimizedImages.forEach(function (img) { if (img.previewUrl) URL.revokeObjectURL(img.previewUrl); });
        optimizedImages = [];

        var outputFormat = formatSelect.value;
        var quality = parseInt(qualitySlider.value, 10);

        for (var j = 0; j < imageFiles.length; j++) {
            var result = await processImage(imageFiles[j], outputFormat, quality);
            optimizedImages.push(result);
        }

        processingEl.classList.remove('visible');
        renderResults();
    }

    function renderResults() {
        if (optimizedImages.length === 0) { resultsEl.classList.remove('visible'); return; }

        resultsEl.classList.add('visible');
        gridEl.innerHTML = '';

        var totalOriginal = 0, totalOptimized = 0, successCount = 0;

        optimizedImages.forEach(function (img, idx) {
            var card = document.createElement('div');
            card.className = 'io-card';

            if (!img.success) {
                card.innerHTML =
                    '<div class="io-card-preview" style="background: rgba(239, 68, 68, 0.1); color: #fca5a5; font-size: 0.85rem; padding: 1rem;">' +
                        '<div style="text-align: center;"><i class="fas fa-exclamation-triangle" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block;"></i>' + escapeHtml(img.error) + '</div>' +
                    '</div>' +
                    '<div class="io-card-body">' +
                        '<div class="io-card-name" title="' + escapeHtml(img.name) + '">' + escapeHtml(img.name) + '</div>' +
                    '</div>';
                gridEl.appendChild(card);
                return;
            }

            totalOriginal += img.originalSize;
            totalOptimized += img.optimizedSize;
            successCount++;

            var saved = pct(img.originalSize, img.optimizedSize);
            var isLarger = img.optimizedSize > img.originalSize;
            var savingsClass = isLarger ? 'io-card-savings negative' : 'io-card-savings';
            var savingsText = isLarger ? '+' + Math.abs(parseFloat(saved)).toFixed(1) + '%' : '-' + saved + '%';
            var resized = (img.originalWidth && img.originalWidth !== img.width) || (img.originalHeight && img.originalHeight !== img.height);
            var dimsHtml = img.width + ' x ' + img.height + 'px';
            if (resized) dimsHtml += ' <span style="opacity:.6">(from ' + img.originalWidth + ' x ' + img.originalHeight + ')</span>';

            card.innerHTML =
                '<div class="io-card-preview">' +
                    '<img src="' + img.previewUrl + '" alt="' + escapeHtml(img.outputName) + '">' +
                    '<span class="io-card-format-badge">' + getFormatLabel(img.format) + '</span>' +
                '</div>' +
                '<div class="io-card-body">' +
                    '<div class="io-card-name" title="' + escapeHtml(img.outputName) + '">' + escapeHtml(img.outputName) + '</div>' +
                    '<div class="io-card-dimensions">' + dimsHtml + '</div>' +
                    '<div class="io-card-stats">' +
                        '<div class="io-card-sizes">' +
                            '<span class="io-card-original">' + formatBytes(img.originalSize) + '</span>' +
                            '<span class="io-card-arrow"><i class="fas fa-arrow-right"></i></span>' +
                            '<span class="io-card-optimized">' + formatBytes(img.optimizedSize) + '</span>' +
                        '</div>' +
                        '<span class="' + savingsClass + '">' + savingsText + '</span>' +
                    '</div>' +
                    '<div class="io-card-actions">' +
                        '<button class="io-btn" data-action="io-download" data-idx="' + idx + '">' +
                            '<i class="fas fa-download"></i> Download' +
                        '</button>' +
                    '</div>' +
                '</div>';

            gridEl.appendChild(card);
        });

        document.getElementById('io-stat-files').textContent = successCount;
        document.getElementById('io-stat-original').textContent = formatBytes(totalOriginal);
        document.getElementById('io-stat-optimized').textContent = formatBytes(totalOptimized);
        document.getElementById('io-stat-saved').textContent = totalOriginal > 0 ? pct(totalOriginal, totalOptimized) + '%' : '0%';
        document.getElementById('io-download-all').style.display = successCount > 1 ? 'inline-flex' : 'none';
    }

    function ioDownloadSingle(idx) {
        var img = optimizedImages[idx];
        if (!img || !img.success) return;
        var url = URL.createObjectURL(img.blob);
        var a = document.createElement('a');
        a.href = url; a.download = img.outputName;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    document.addEventListener('click', function (e) {
        var target = e.target.closest('[data-action="io-download"]');
        if (target) ioDownloadSingle(parseInt(target.getAttribute('data-idx'), 10));
    });

    window.ioDownloadAll = async function () {
        if (typeof JSZip === 'undefined') { showError('JSZip library not loaded. Please refresh the page.'); return; }
        var zip = new JSZip();
        var nameCount = {};
        optimizedImages.forEach(function (img) {
            if (!img.success) return;
            var name = img.outputName;
            if (nameCount[name]) {
                nameCount[name]++;
                var dot = name.lastIndexOf('.');
                var base = dot === -1 ? name : name.substring(0, dot);
                var ext = dot === -1 ? '' : name.substring(dot);
                name = base + ' (' + nameCount[name] + ')' + ext;
            } else { nameCount[name] = 1; }
            zip.file(name, img.blob);
        });
        var blob = await zip.generateAsync({ type: 'blob' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = 'optimized-images.zip';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    window.ioClearResults = function () {
        optimizedImages.forEach(function (img) { if (img.previewUrl) URL.revokeObjectURL(img.previewUrl); });
        optimizedImages = [];
        gridEl.innerHTML = '';
        resultsEl.classList.remove('visible');
        hideError();
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
