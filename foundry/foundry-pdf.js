/* VA COMICS // Foundry v2 // foundry-pdf.js
   Print Lab: (1) the sub-tabs ISSUES · BOOK COVER · CONVERT · IMAGES → PDF, (2) IMAGES_TO_PDF:
   many images (JPG, JFIF, PNG, WebP, AVIF, GIF, BMP... anything the browser opens) -> one PDF, one image per page.
   Everything stays in the browser. Part 1 (FoundryPdf): page maths + a small PDF writer, tested in Node. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) { module.exports = factory(); }
    else { root.FoundryPdf = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';
    var PAGES = { a4: [595.276, 841.89], letter: [612, 792], '6x9': [432, 648] };     /* points, portrait */
    var IMAGE_DPI = 300;    /* "same as the image": a 1800 px wide image becomes a 6" wide page */

    /* where one image goes: o = { page: 'image'|'a4'|'letter'|'6x9', margin (in), auto: rotate page for wide images } */
    function place(imgW, imgH, o) {
        var m = (o.margin || 0) * 72, W, H;
        if (o.page === 'image' || !PAGES[o.page]) {
            var w = imgW * 72 / IMAGE_DPI, h = imgH * 72 / IMAGE_DPI;
            W = w + 2 * m; H = h + 2 * m;
            return { W: r(W), H: r(H), x: r(m), y: r(m), w: r(w), h: r(h) };
        }
        W = PAGES[o.page][0]; H = PAGES[o.page][1];
        if (o.auto !== false && imgW > imgH) { var t = W; W = H; H = t; }
        var bw = W - 2 * m, bh = H - 2 * m, s = Math.min(bw / imgW, bh / imgH), dw = imgW * s, dh = imgH * s;
        return { W: r(W), H: r(H), x: r((W - dw) / 2), y: r((H - dh) / 2), w: r(dw), h: r(dh) };
    }
    function r(x) { return Math.round(x * 1000) / 1000; }
    /* longest side limit in px (0 = keep) */
    function scaleTo(w, h, maxSide) {
        if (!maxSide || Math.max(w, h) <= maxSide) { return { w: w, h: h }; }
        var s = maxSide / Math.max(w, h); return { w: Math.round(w * s), h: Math.round(h * s) };
    }
    function hexRgb(hex) {
        var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '#ffffff') || [0, 'ff', 'ff', 'ff'];
        return [1, 2, 3].map(function (i) { return (parseInt(m[i], 16) / 255).toFixed(3); }).join(' ');
    }
    /* PDF writer: every page has its own size; parts can be Uint8Array or Blob */
    function writer() {
        var enc = function (s) { return new TextEncoder().encode(s); };
        var parts = [], pos = 0, offsets = [], pageIds = [], nextId = 3;
        function push(p) { parts.push(p); pos += (p.size !== undefined ? p.size : p.length); }
        function obj(id) { offsets[id] = pos; push(enc(id + ' 0 obj\n')); }
        push(enc('%PDF-1.4\n')); push(new Uint8Array([37, 226, 227, 207, 211, 10]));
        return {
            /* jpeg (Blob/Uint8Array) of iw x ih px placed at pl = place(...); bg = '#rrggbb' or '' */
            addPage: function (jpeg, iw, ih, pl, bg) {
                var img = nextId++, cont = nextId++, page = nextId++, len = jpeg.size !== undefined ? jpeg.size : jpeg.length;
                obj(img);
                push(enc('<< /Type /XObject /Subtype /Image /Width ' + iw + ' /Height ' + ih + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + len + ' >>\nstream\n'));
                push(jpeg); push(enc('\nendstream\nendobj\n'));
                var c = (bg ? hexRgb(bg) + ' rg 0 0 ' + pl.W + ' ' + pl.H + ' re f ' : '') + 'q ' + pl.w + ' 0 0 ' + pl.h + ' ' + pl.x + ' ' + pl.y + ' cm /Im0 Do Q';
                obj(cont); push(enc('<< /Length ' + c.length + ' >>\nstream\n' + c + '\nendstream\nendobj\n'));
                obj(page);
                push(enc('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pl.W + ' ' + pl.H + '] /Resources << /XObject << /Im0 ' + img + ' 0 R >> >> /Contents ' + cont + ' 0 R >>\nendobj\n'));
                pageIds.push(page);
            },
            finish: function (title) {
                obj(2); push(enc('<< /Type /Pages /Count ' + pageIds.length + ' /Kids [' + pageIds.map(function (i) { return i + ' 0 R'; }).join(' ') + '] >>\nendobj\n'));
                obj(1); push(enc('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'));
                var info = nextId++; obj(info);
                push(enc('<< /Title (' + String(title || '').replace(/[^\x20-\x7e]/g, '').replace(/[()\\]/g, '') + ') /Producer (VA Comics Foundry Print Lab) >>\nendobj\n'));
                var xref = pos, lines = ['xref', '0 ' + nextId, '0000000000 65535 f '];
                for (var i = 1; i < nextId; i++) { lines.push(('0000000000' + offsets[i]).slice(-10) + ' 00000 n '); }
                push(enc(lines.join('\n') + '\ntrailer\n<< /Size ' + nextId + ' /Root 1 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n'));
                return parts;
            },
            count: function () { return pageIds.length; }
        };
    }
    return { PAGES: PAGES, place: place, scaleTo: scaleTo, writer: writer };
});

/* ============================== Print Lab sub-tabs (browser only) ============================== */
(function () {
    'use strict';
    if (typeof document === 'undefined' || !document.getElementById('labSubs')) { return; }
    var KEY = 'foundry_lab_sub';
    function pick(name) {
        Array.prototype.forEach.call(document.querySelectorAll('#tab-lab [data-labsub]'), function (p) { p.hidden = p.getAttribute('data-labsub') !== name; });
        Array.prototype.forEach.call(document.querySelectorAll('#labSubs button'), function (b) { b.classList.toggle('chip--active', b.getAttribute('data-sub') === name); });
        try { localStorage.setItem(KEY, name); } catch (e) { /* ignore */ }
    }
    document.getElementById('labSubs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { pick(b.getAttribute('data-sub')); } });
    var start = 'issue'; try { start = localStorage.getItem(KEY) || 'issue'; } catch (e) { /* ignore */ }
    if (!document.querySelector('#labSubs [data-sub="' + start + '"]')) { start = 'issue'; }
    pick(start);
})();

/* ============================== IMAGES_TO_PDF panel (browser only) ============================== */
(function () {
    'use strict';
    if (typeof document === 'undefined' || !document.getElementById('ipPanel')) { return; }
    var P = FoundryPdf, LAB = window.FoundryLab;
    var $ = function (id) { return document.getElementById(id); };
    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) { n.className = cls; } if (text !== undefined) { n.textContent = text; } return n; }
    function kb(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB'; }
    var items = [], running = false, uid = 0;

    function isImage(f) { return /^image\//.test(f.type) || /\.(jpe?g|jfif|pjpeg|pjp|png|webp|avif|gif|bmp|ico|svg)$/i.test(f.name); }
    function open(file) {
        return createImageBitmap(file).catch(function () {
            return new Promise(function (res, rej) {
                var u = URL.createObjectURL(file), im = new Image();
                im.onload = function () { createImageBitmap(im).then(function (b) { URL.revokeObjectURL(u); res(b); }, function () { URL.revokeObjectURL(u); rej(new Error('cannot be opened')); }); };
                im.onerror = function () { URL.revokeObjectURL(u); rej(new Error('cannot be opened')); };
                im.src = u;
            });
        });
    }
    function add(files) {
        var list = Array.prototype.slice.call(files || []), skipped = [];
        list.forEach(function (f) {
            if (!isImage(f)) { skipped.push(f.name); return; }
            var it = { id: ++uid, file: f, url: URL.createObjectURL(f), w: 0, h: 0, bad: '' };
            items.push(it);
            open(f).then(function (b) { it.w = b.width; it.h = b.height; b.close(); render(); }, function () { it.bad = 'cannot be opened here (HEIC, TIFF and PSD do not work in the browser: save as JPG or PNG)'; render(); });
        });
        if (skipped.length) { status('Skipped (not images): ' + skipped.slice(0, 5).join(', ') + (skipped.length > 5 ? '…' : '')); }
        if (!$('ipName').value && items.length) { $('ipName').value = items[0].file.name.replace(/\.[^.]+$/, '').replace(/_?p?\d+$/i, '') || 'images'; }
        render();
    }
    function status(t) { $('ipProgress').hidden = !t; $('ipProgressText').textContent = t || ''; }
    function render() {
        var box = $('ipList'); box.innerHTML = '';
        $('ipEmpty').hidden = !!items.length; $('ipBody').hidden = !items.length;
        items.forEach(function (it, i) {
            var row = el('div', 'fitem ip-item' + (it.bad ? ' is-bad' : ''));
            var th = el('div', 'ip-thumb'), im = el('img'); im.src = it.url; im.alt = ''; im.loading = 'lazy'; th.appendChild(im);
            var main = el('div', 'fitem-main');
            main.appendChild(el('b', '', (i + 1) + '. ' + it.file.name));
            main.appendChild(el('span', 'meta', it.bad ? it.bad : (it.w ? it.w + ' x ' + it.h + ' px · ' : 'reading… · ') + kb(it.file.size)));
            var acts = el('div', 'fitem-actions vd-acts');
            function b(label, title, fn, dis, cls) { var x = el('button', 'btn btn--sm' + (cls ? ' ' + cls : ''), label); x.type = 'button'; x.title = title; x.setAttribute('aria-label', title); x.disabled = !!dis; x.addEventListener('click', fn); acts.appendChild(x); }
            b('↑', 'Move up', function () { var t = items[i - 1]; items[i - 1] = it; items[i] = t; render(); }, i === 0);
            b('↓', 'Move down', function () { var t = items[i + 1]; items[i + 1] = it; items[i] = t; render(); }, i === items.length - 1);
            b('✕', 'Remove', function () { URL.revokeObjectURL(it.url); items.splice(i, 1); render(); }, false, 'btn--danger');
            row.appendChild(th); row.appendChild(main); row.appendChild(acts); box.appendChild(row);
        });
        var ok = items.filter(function (x) { return !x.bad; }).length;
        $('ipCount').textContent = items.length ? ok + ' page' + (ok === 1 ? '' : 's') + ' in the PDF' + (items.length > ok ? ' (' + (items.length - ok) + ' file(s) skipped)' : '') : '';
        $('ipGo').disabled = !ok || running;
    }
    function opts() {
        return { page: $('ipPage').value, margin: parseFloat($('ipMargin').value) || 0, auto: $('ipAuto').checked,
                 bg: $('ipBg').value, max: parseInt($('ipMax').value, 10) || 0, q: parseInt($('ipQuality').value, 10) / 100 };
    }
    function make() {
        if (running) { return; }
        var o = opts(), list = items.filter(function (x) { return !x.bad; }); if (!list.length) { return; }
        running = true; render();
        var pdf = P.writer(), t0 = Date.now();
        function one(i) {
            if (i >= list.length) { return Promise.resolve(); }
            status('Page ' + (i + 1) + ' / ' + list.length + ': ' + list[i].file.name);
            return open(list[i].file).then(function (bmp) {
                var s = P.scaleTo(bmp.width, bmp.height, o.max), c = document.createElement('canvas'); c.width = s.w; c.height = s.h;
                var x = c.getContext('2d'); x.fillStyle = o.bg; x.fillRect(0, 0, s.w, s.h);       /* transparent PNGs get the page colour */
                x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(bmp, 0, 0, s.w, s.h); bmp.close();
                return new Promise(function (res, rej) {
                    c.toBlob(function (jpg) {
                        c.width = 0;
                        if (!jpg) { rej(new Error('The browser could not make the JPEG for ' + list[i].file.name)); return; }
                        /* page size from the ORIGINAL pixels, so a smaller "max size" only makes the file lighter, not the page smaller */
                        var pl = P.place(list[i].w || s.w, list[i].h || s.h, o);
                        pdf.addPage(jpg, s.w, s.h, pl, o.page === 'image' && !o.margin ? '' : o.bg);
                        res();
                    }, 'image/jpeg', o.q);
                });
            }).then(function () { return one(i + 1); });
        }
        one(0).then(function () {
            var name = (String($('ipName').value || 'images').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'images') + '.pdf';
            var blob = new Blob(pdf.finish($('ipName').value || 'Images'), { type: 'application/pdf' });
            var a = document.createElement('a'), u = URL.createObjectURL(blob); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
            setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
            status('Done in ' + Math.round((Date.now() - t0) / 1000) + ' s: ' + pdf.count() + ' pages, ' + kb(blob.size) + '. File: ' + name);
        }).catch(function (e) { status('Stopped: ' + (e && e.message ? e.message : e)); })
          .then(function () { running = false; render(); });
    }

    $('ipFiles').addEventListener('change', function () { add(this.files); this.value = ''; });
    var zone = $('ipDrop');
    ['dragenter', 'dragover'].forEach(function (t) { zone.addEventListener(t, function (e) { e.preventDefault(); zone.classList.add('is-over'); }); });
    ['dragleave', 'drop'].forEach(function (t) { zone.addEventListener(t, function () { zone.classList.remove('is-over'); }); });
    zone.addEventListener('drop', function (e) { e.preventDefault(); add(e.dataTransfer.files); });
    $('ipSort').addEventListener('click', function () {
        var cmp = LAB && LAB.naturalCompare ? LAB.naturalCompare : function (a, b) { return a < b ? -1 : a > b ? 1 : 0; };
        items.sort(function (a, b) { return cmp(a.file.name, b.file.name); }); render();
    });
    $('ipClear').addEventListener('click', function () { items.forEach(function (it) { URL.revokeObjectURL(it.url); }); items = []; $('ipName').value = ''; status(''); render(); });
    $('ipPage').addEventListener('change', function () { $('ipAutoBox').hidden = this.value === 'image'; });
    $('ipQuality').addEventListener('input', function () { $('ipQualityOut').textContent = this.value; });
    $('ipGo').addEventListener('click', make);
    render();
})();
