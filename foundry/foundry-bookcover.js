/* VA COMICS // Foundry v2 // foundry-bookcover.js
   Print Lab: BOOK_COVER panel. KDP full cover (back + spine + front, one image in one PDF) for paperback
   and hardcover (case laminate), made from a front and a back image in any format the browser can open.
   Art FILLS each cover face (centred, small crop if the shape differs); the bleed / wrap around it is filled
   with a mirror of the edge, so nothing important ends up folded under the board.
   Part 1 (FoundryBookCover): pure geometry + checks, tested in Node. Part 2: the panel (browser only).
   KDP figures (Nov 2026): paperback bleed 0.125", premium colour spine = pages x 0.002347", spine text from 80 pages;
   hardcover (KDP cover calculator, 6x9): board = trim + 0.197" x 0.236", wrap 0.591" (15 mm), hinge 0.394" (10 mm),
   margin 0.125", barcode 2" x 1.2" at 0.25" from the hinge and 0.375" from the board bottom, 75-550 pages.
   KDP gives NO hardcover spine formula -> the spine comes from its calculator. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) { module.exports = factory(); }
    else { root.FoundryBookCover = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';
    var K = {
        dpi: 300, perPage: 0.002347, bleed: 0.125, wrap: 0.5906, hinge: 0.3937, safe: 0.125, spineClear: 0.0625,
        boardW: 0.197, boardH: 0.236, hcBarBottom: 0.375,     /* hardcover board = trim + 0.197" x 0.236"; wrap 15 mm, hinge 10 mm (KDP calculator, 6x9, Nov 2026) */
        barW: 2, barH: 1.2, pbMin: 24, pbMax: 828, hcMin: 75, hcMax: 550, spineTextMin: 80
    };
    var TRIMS = {
        paperback: [[5, 8], [5.06, 7.81], [5.25, 8], [5.5, 8.5], [6, 9], [6.14, 9.21], [6.69, 9.61], [7, 10], [7.44, 9.69], [7.5, 9.25], [8, 10], [8.25, 6], [8.25, 8.25], [8.5, 8.5], [8.5, 11], [8.27, 11.69], [8.25, 11]],
        hardcover: [[5.5, 8.5], [6, 9], [6.14, 9.21], [7, 10], [8.25, 11]]
    };
    function r4(x) { return Math.round(x * 10000) / 10000; }
    function spineAuto(pages) { return r4(pages * K.perPage); }

    /* all sizes in inches; o = { kind, trimW, trimH, pages, spine, W, H }  (W/H/spine for hardcover = from KDP) */
    function layout(o) {
        var L = { kind: o.kind, trimW: o.trimW, trimH: o.trimH, pages: o.pages }, faceW, faceH, m, s;
        if (o.kind === 'hardcover') {
            s = +o.spine; m = K.wrap;
            L.W = +o.W; L.H = +o.H;
            faceW = (L.W - s) / 2 - m; faceH = L.H - 2 * m;
            L.edge = m; L.edgeName = 'wrap';
        } else {
            s = typeof o.spine === 'number' && o.spine >= 0 ? o.spine : spineAuto(o.pages); m = K.bleed;
            faceW = o.trimW; faceH = o.trimH;
            L.W = 2 * m + 2 * faceW + s; L.H = 2 * m + faceH;
            L.edge = m; L.edgeName = 'bleed';
        }
        L.spineW = s;
        L.back = { x: m, y: m, w: faceW, h: faceH };
        L.spine = { x: m + faceW, y: 0, w: s, h: L.H };
        L.front = { x: m + faceW + s, y: m, w: faceW, h: faceH };
        var hz = o.kind === 'hardcover' ? K.hinge : 0;     /* no-text strip next to the spine: hinge on hardcover; paperback = none (as in the KDP calculator: safe area = trim - 0.125") */
        L.hinge = o.kind === 'hardcover' ? [{ x: L.back.x + faceW - K.hinge, y: m, w: K.hinge, h: faceH }, { x: L.front.x, y: m, w: K.hinge, h: faceH }] : [];
        L.safeBack = { x: L.back.x + K.safe, y: m + K.safe, w: faceW - K.safe - hz, h: faceH - 2 * K.safe };
        L.safeFront = { x: L.front.x + hz, y: m + K.safe, w: faceW - K.safe - hz, h: faceH - 2 * K.safe };
        if (o.kind === 'hardcover') {
            var right = L.back.x + faceW - K.hinge - 0.25;
            L.barcode = { x: right - K.barW, y: m + faceH - K.hcBarBottom - K.barH, w: K.barW, h: K.barH };
        } else {
            L.barcode = { x: L.back.x + faceW - 0.25 - K.barW, y: m + faceH - 0.25 - K.barH, w: K.barW, h: K.barH };
        }
        L.spineText = { x: L.spine.x + K.spineClear, y: m + K.safe + (o.kind === 'hardcover' ? 0.125 : 0), w: Math.max(0, s - 2 * K.spineClear), h: faceH - 2 * K.safe - (o.kind === 'hardcover' ? 0.25 : 0) };
        L.px = function (inch) { return Math.round(inch * K.dpi); };
        L.Wpx = L.px(L.W); L.Hpx = L.px(L.H);
        return L;
    }
    /* centred "cover" crop of an iw x ih image into a face of fw x fh inches -> source rect + print DPI */
    function fill(iw, ih, fw, fh) {
        var s = Math.max(fw / iw, fh / ih), cw = fw / s, ch = fh / s;
        return { sx: (iw - cw) / 2, sy: (ih - ch) / 2, sw: cw, sh: ch, dpi: Math.round(1 / s), cropW: 1 - cw / iw, cropH: 1 - ch / ih };
    }
    /* "safe frame" (like the old stitch.py): the WHOLE image, never cut, inside a black border of 115 px
       (0.383") from the outer edges of the file, and away from the spine / hinge */
    K.frame = 115 / 300;
    function frameBox(L, side) {
        var hc = L.kind === 'hardcover', out = Math.max(K.frame, L.edge + K.safe), inner = hc ? K.hinge + K.safe : K.safe;
        var f = side === 'front' ? L.front : L.back, top = Math.max(K.frame, L.edge + K.safe);
        if (side === 'front') { return { x: f.x + inner, y: top, w: L.W - out - (f.x + inner), h: L.H - 2 * top }; }
        return { x: out, y: top, w: f.x + f.w - inner - out, h: L.H - 2 * top };
    }
    /* where the art goes: fit 'fill' = covers the face (centred crop), 'frame' = whole image inside frameBox */
    function art(L, side, iw, ih, fit) {
        var f = side === 'front' ? L.front : L.back;
        if (fit === 'frame') {
            var b = frameBox(L, side), s = Math.min(b.w / iw, b.h / ih), w = iw * s, h = ih * s;
            return { frame: true, x: b.x + (b.w - w) / 2, y: b.y + (b.h - h) / 2, w: w, h: h, sx: 0, sy: 0, sw: iw, sh: ih, dpi: Math.round(1 / s), cropW: 0, cropH: 0 };
        }
        var c = fill(iw, ih, f.w, f.h);
        return { frame: false, x: f.x, y: f.y, w: f.w, h: f.h, sx: c.sx, sy: c.sy, sw: c.sw, sh: c.sh, dpi: c.dpi, cropW: c.cropW, cropH: c.cropH };
    }
    function check(o, L, front, back) {
        var out = [], hc = o.kind === 'hardcover';
        var lo = hc ? K.hcMin : K.pbMin, hi = hc ? K.hcMax : K.pbMax;
        if (!(o.pages >= lo && o.pages <= hi)) { out.push({ level: 'err', text: (hc ? 'Hardcover' : 'Paperback') + ' needs ' + lo + '-' + hi + ' pages (you have ' + (o.pages || 0) + ').' }); }
        var okTrim = TRIMS[o.kind].some(function (t) { return t[0] === o.trimW && t[1] === o.trimH; });
        if (!okTrim) { out.push({ level: 'warn', text: 'Trim ' + o.trimW + '" x ' + o.trimH + '" is not in the usual KDP ' + o.kind + ' list.' }); }
        if (hc) {
            if (!(L.W > 0 && L.H > 0 && L.spineW > 0)) { out.push({ level: 'err', text: 'Type the spine width from the KDP cover calculator (Hardcover, your trim and page count).' }); return out; }
            if (!o.hcTyped) { out.push({ level: 'info', text: 'Full width and height are worked out from the spine (as the KDP calculator does for 6" x 9"). For another trim size, compare them once with the calculator.' }); }
            if (L.front.w < o.trimW - 0.01 || L.front.h < o.trimH - 0.01) { out.push({ level: 'err', text: 'These sizes leave a cover face of ' + L.front.w.toFixed(3) + '" x ' + L.front.h.toFixed(3) + '", smaller than the ' + o.trimW + '" x ' + o.trimH + '" trim. Check the numbers from the KDP calculator.' }); }
            else if (L.front.w > o.trimW + 1 || L.front.h > o.trimH + 1) { out.push({ level: 'warn', text: 'The cover face comes out ' + L.front.w.toFixed(3) + '" x ' + L.front.h.toFixed(3) + '": much bigger than the trim. Check the numbers.' }); }
            else { out.push({ level: 'ok', text: 'Hardcover face ' + L.front.w.toFixed(3) + '" x ' + L.front.h.toFixed(3) + '" + wrap ' + K.wrap.toFixed(3) + '" all round + hinge ' + K.hinge.toFixed(3) + '" next to the spine.' }); }
        } else {
            var auto = spineAuto(o.pages);
            if (Math.abs(L.spineW - auto) > 0.0005) { out.push({ level: 'info', text: 'Spine set by hand: ' + L.spineW.toFixed(4) + '" (the formula gives ' + auto.toFixed(4) + '" for ' + o.pages + ' pages).' }); }
        }
        if (o.fit === 'frame') { out.push({ level: 'info', text: 'Safe frame (stitch.py style): each image is shown whole, at least 0.383" (115 px) from the outer edges, on black. Nothing of the art can be cut or folded.' }); }
        [['Front', front, 'front'], ['Back', back, 'back']].forEach(function (x) {
            if (!x[1]) { out.push({ level: 'err', text: x[0] + ' image is missing.' }); return; }
            if (!x[1].w) { out.push({ level: 'err', text: x[0] + ' image could not be opened.' }); return; }
            var f = art(L, x[2], x[1].w, x[1].h, o.fit), cut = Math.round(Math.max(f.cropW, f.cropH) * 100);
            var lvl = f.dpi < 200 ? 'err' : f.dpi < 280 ? 'warn' : 'ok';
            out.push({ level: lvl, text: x[0] + ': ' + x[1].w + 'x' + x[1].h + ' px → about ' + f.dpi + ' DPI in print' + (lvl === 'err' ? ' (too soft, 300 is the target: use a bigger image)' : lvl === 'warn' ? ' (300 is the target; usually still fine)' : '') + '.' +
                (cut >= 1 ? ' About ' + cut + '% is cut from the ' + (f.cropW > f.cropH ? 'left and right' : 'top and bottom') + ' edges to fit the ' + (hc ? 'board' : 'trim') + ' shape.' : '') });
        });
        if (o.spineText) {
            if (!hc && o.pages < K.spineTextMin) { out.push({ level: 'err', text: 'KDP prints spine text only from ' + K.spineTextMin + ' pages. Remove the spine text or the cover is rejected.' }); }
            else if (L.spineText.w < 0.12) { out.push({ level: 'warn', text: 'The spine is very thin (' + L.spineW.toFixed(3) + '"): the text will be tiny.' }); }
        }
        out.push({ level: 'info', text: 'Cover PDF: ' + L.W.toFixed(3) + '" x ' + L.H.toFixed(3) + '" = ' + L.Wpx + ' x ' + L.Hpx + ' px, spine ' + L.spineW.toFixed(4) + '". Compare once with the KDP cover calculator.' });
        out.push({ level: 'info', text: 'White box = where KDP puts the barcode if you do not add your own. Keep logos and text out of it.' });
        return out;
    }
    function r3(x) { return Math.round(x * 1000 + 1e-6) / 1000; }
    /* hardcover full size from the spine (same numbers as the KDP calculator) */
    function hcAuto(trimW, trimH, spine) {
        return { W: r3(2 * K.wrap + 2 * (trimW + K.boardW) + spine), H: r3(2 * K.wrap + trimH + K.boardH) };
    }
    /* the same table the KDP cover calculator shows: [name, width, height] in inches, 3 decimals */
    function table(L) {
        var f = L.front, s = L.spineW, rows;
        if (L.kind === 'hardcover') {
            rows = [['Full Cover', L.W, L.H], ['Front Cover', f.w, f.h], ['Margin', K.safe, K.safe], ['Wrap', K.wrap, K.wrap], ['Hinge', K.hinge, L.H],
                    ['Spine', s, f.h], ['Spine Safe Area', s - 2 * K.spineClear, f.h - 2 * K.safe], ['Spine Margin', 0.062, 0.062], ['Barcode Margin', 0.25, K.hcBarBottom]];
        } else {
            rows = [['Full Cover', L.W, L.H], ['Front Cover', f.w, f.h], ['Safe Area', f.w - K.safe, f.h - 2 * K.safe], ['Bleed', K.bleed, K.bleed], ['Margin', K.safe, K.safe],
                    ['Spine', s, f.h], ['Spine Safe Area', s - 2 * K.spineClear, f.h - 2 * K.safe], ['Spine Margin', 0.062, 0.062], ['Barcode Margin', 0.25, 0.25]];
        }
        return rows.map(function (r) { return [r[0], r3(r[1]).toFixed(3), r3(r[2]).toFixed(3)]; });
    }
    function fileName(title, kind, pages) {
        var t = String(title || 'Book').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'Book';
        return t + '_' + kind.toUpperCase() + '_COVER_' + pages + 'p.pdf';
    }
    return { K: K, TRIMS: TRIMS, spineAuto: spineAuto, layout: layout, fill: fill, art: art, frameBox: frameBox, check: check, fileName: fileName, hcAuto: hcAuto, table: table };
});

/* ============================== the panel (browser only) ============================== */
(function () {
    'use strict';
    if (typeof document === 'undefined' || !document.getElementById('bcPanel')) { return; }
    var B = FoundryBookCover, LAB = window.FoundryLab, K = B.K;
    var $ = function (id) { return document.getElementById(id); };
    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) { n.className = cls; } if (text !== undefined) { n.textContent = text; } return n; }
    var img = { front: null, back: null }, running = false, autoSpine = 0, autoColor = '';

    function list(box, items) { box.innerHTML = ''; items.forEach(function (p) { box.appendChild(el('li', 'is-' + p.level, p.text)); }); }
    function kb(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB'; }
    function download(blob, name) {
        var a = document.createElement('a'), url = URL.createObjectURL(blob);
        a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    }
    function say(text) { $('bcProgress').hidden = !text; $('bcProgressText').textContent = text || ''; }

    /* open any image the browser understands (JPG, PNG, WebP, AVIF, GIF, BMP...) */
    function open(file) {
        return createImageBitmap(file).then(function (bmp) { return bmp; }, function () {
            /* second try through <img> (some formats decode only that way) */
            return new Promise(function (res, rej) {
                var u = URL.createObjectURL(file), im = new Image();
                im.onload = function () { createImageBitmap(im).then(function (b) { URL.revokeObjectURL(u); res(b); }, rej); };
                im.onerror = function () { URL.revokeObjectURL(u); rej(new Error(file.name + ' cannot be opened in the browser. HEIC, TIFF and PSD do not work here: save it as PNG or JPG first (or use QUICK_CONVERT below if it opens there).')); };
                im.src = u;
            });
        });
    }
    function setImage(side, file) {
        if (!file) { return; }
        say('Opening ' + file.name + '...');
        open(file).then(function (bmp) {
            if (img[side] && img[side].bmp) { img[side].bmp.close(); }
            img[side] = { file: file, bmp: bmp, w: bmp.width, h: bmp.height };
            $(side === 'front' ? 'bcFrontInfo' : 'bcBackInfo').textContent = file.name + ' · ' + bmp.width + 'x' + bmp.height + ' px · ' + kb(file.size);
            if (side === 'front' && !$('bcTitle').value) { $('bcTitle').value = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim(); }
            say(''); render();
        }).catch(function (e) {
            img[side] = null; $(side === 'front' ? 'bcFrontInfo' : 'bcBackInfo').textContent = e.message; say(''); render();
        });
    }

    function opts() {
        var kind = $('bcKind').value, t = $('bcTrim').value.split('x');
        return {
            kind: kind, trimW: +t[0], trimH: +t[1], pages: parseInt($('bcPages').value, 10) || 0,
            spine: kind === 'hardcover' ? parseFloat($('bcHcSpine').value) : parseFloat($('bcSpine').value),
            W: parseFloat($('bcHcW').value), H: parseFloat($('bcHcH').value), hcTyped: !!($('bcHcW').getAttribute('data-touched') || $('bcHcH').getAttribute('data-touched')),
            spineText: $('bcSpineTitle').value.trim(), spineSub: $('bcSpineSub').value.trim(),
            spineColor: $('bcSpineColor').value, textColor: $('bcTextColor').value, font: $('bcFont').value, edge: $('bcEdge').value, fit: $('bcFit').value
        };
    }
    function fillTrims() {
        var kind = $('bcKind').value, cur = $('bcTrim').value || '6x9', sel = $('bcTrim'); sel.innerHTML = '';
        B.TRIMS[kind].forEach(function (t) { var o = el('option', '', t[0] + '" x ' + t[1] + '"'); o.value = t[0] + 'x' + t[1]; sel.appendChild(o); });
        sel.value = Array.prototype.some.call(sel.options, function (o) { return o.value === cur; }) ? cur : '6x9';
        $('bcPbBox').hidden = kind === 'hardcover'; $('bcHcBox').hidden = kind !== 'hardcover';
    }
    /* average colour of the front image's spine-side strip (used as the default spine colour) */
    function edgeColor(bmp) {
        var c = document.createElement('canvas'); c.width = 8; c.height = 64;
        var x = c.getContext('2d'); x.drawImage(bmp, 0, 0, Math.max(1, Math.round(bmp.width * 0.03)), bmp.height, 0, 0, 8, 64);
        var d = x.getImageData(0, 0, 8, 64).data, r = 0, g = 0, b = 0, n = d.length / 4;
        for (var i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
        function h(v) { return ('0' + Math.round(v / n).toString(16)).slice(-2); }
        return '#' + h(r) + h(g) + h(b);
    }

    /* draws the whole cover at scale k (px per inch) into ctx; guides = preview lines */
    function paint(ctx, L, o, k, guides) {
        var W = Math.round(L.W * k), H = Math.round(L.H * k);
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        [['back', L.back, 'left'], ['front', L.front, 'right']].forEach(function (x) {
            var im = img[x[0]], f = x[1];
            var fx = Math.round(f.x * k), fy = Math.round(f.y * k), fw = Math.round((f.x + f.w) * k) - fx, fh = Math.round((f.y + f.h) * k) - fy;
            if (!im || !im.bmp) { return; }
            if (o.fit === 'frame') {
                var a = B.art(L, x[0], im.w, im.h, 'frame');
                ctx.drawImage(im.bmp, Math.round(a.x * k), Math.round(a.y * k), Math.round(a.w * k), Math.round(a.h * k));
                return;
            }
            var src = B.fill(im.w, im.h, f.w, f.h);
            var face = document.createElement('canvas'); face.width = fw; face.height = fh;
            var fc = face.getContext('2d'); fc.imageSmoothingEnabled = true; fc.imageSmoothingQuality = 'high';
            fc.drawImage(im.bmp, src.sx, src.sy, src.sw, src.sh, 0, 0, fw, fh);
            ctx.drawImage(face, fx, fy);
            /* fill the bleed / wrap around the face (outer side, top, bottom); the spine side stays clean */
            var m = fy, mode = o.edge || 'stretch';
            var x0 = x[2] === 'left' ? 0 : fx, x1 = x[2] === 'left' ? fx + fw : W;     /* columns of this side incl. the outer strip */
            if (mode === 'mirror') {
                ctx.save();
                if (x[2] === 'left') { ctx.translate(fx, 0); ctx.scale(-1, 1); ctx.drawImage(face, 0, 0, Math.min(m, fw), fh, 0, fy, Math.min(m, fw), fh); }
                else { ctx.translate(fx + fw, 0); ctx.scale(-1, 1); ctx.drawImage(face, fw - Math.min(m, fw), 0, Math.min(m, fw), fh, -Math.min(m, fw), fy, Math.min(m, fw), fh); }
                ctx.restore();
                var strip = document.createElement('canvas'); strip.width = x1 - x0; strip.height = Math.min(m, fh);
                var sc = strip.getContext('2d');
                sc.drawImage(ctx.canvas, x0, fy, x1 - x0, strip.height, 0, 0, x1 - x0, strip.height);
                ctx.save(); ctx.translate(0, fy); ctx.scale(1, -1); ctx.drawImage(strip, x0, 0); ctx.restore();
                sc.clearRect(0, 0, strip.width, strip.height);
                sc.drawImage(ctx.canvas, x0, fy + fh - strip.height, x1 - x0, strip.height, 0, 0, x1 - x0, strip.height);
                ctx.save(); ctx.translate(0, fy + fh); ctx.scale(1, -1); ctx.drawImage(strip, x0, -strip.height); ctx.restore();
                strip.width = 0;
            } else if (mode === 'stretch') {
                /* the outermost colours, softened and stretched outwards: no readable text ends up in the bleed / wrap */
                var sm = document.createElement('canvas'); sm.width = Math.max(2, Math.ceil(fw / 24)); sm.height = Math.max(2, Math.ceil(fh / 24));
                var smc = sm.getContext('2d'); smc.imageSmoothingEnabled = true; smc.imageSmoothingQuality = 'high'; smc.drawImage(face, 0, 0, sm.width, sm.height);
                if (x[2] === 'left') { ctx.drawImage(sm, 0, 0, 1, sm.height, fx - m, fy, m, fh); }
                else { ctx.drawImage(sm, sm.width - 1, 0, 1, sm.height, fx + fw, fy, m, fh); }
                var band = document.createElement('canvas'); band.width = Math.max(2, Math.ceil((x1 - x0) / 24)); band.height = sm.height;
                var bc = band.getContext('2d'); bc.imageSmoothingEnabled = true; bc.imageSmoothingQuality = 'high';
                bc.drawImage(ctx.canvas, x0, fy, x1 - x0, fh, 0, 0, band.width, band.height);
                ctx.drawImage(band, 0, 0, band.width, 1, x0, fy - m, x1 - x0, m);
                ctx.drawImage(band, 0, band.height - 1, band.width, 1, x0, fy + fh, x1 - x0, m);
                sm.width = 0; band.width = 0;
            } else {
                ctx.fillStyle = '#000';
                ctx.fillRect(x0, 0, x1 - x0, fy); ctx.fillRect(x0, fy + fh, x1 - x0, H - fy - fh);
                if (x[2] === 'left') { ctx.fillRect(0, fy, fx, fh); } else { ctx.fillRect(fx + fw, fy, W - fx - fw, fh); }
            }
            face.width = 0;
        });
        /* spine */
        var sx = Math.round(L.spine.x * k), sw = Math.round((L.spine.x + L.spine.w) * k) - sx;
        ctx.fillStyle = o.spineColor || '#000'; ctx.fillRect(sx, 0, sw, H);
        if (o.spineText && L.spineText.w > 0) { spineText(ctx, L, o, k); }
        if (!guides) { return; }
        function rect(r, color, dash, width) { ctx.setLineDash(dash || []); ctx.lineWidth = width || 1; ctx.strokeStyle = color; ctx.strokeRect(r.x * k + 0.5, r.y * k + 0.5, r.w * k, r.h * k); }
        function vline(xIn, color, dash) { ctx.setLineDash(dash || []); ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xIn * k + 0.5, 0); ctx.lineTo(xIn * k + 0.5, H); ctx.stroke(); }
        var e = L.edge;
        rect({ x: e, y: e, w: L.W - 2 * e, h: L.H - 2 * e }, 'rgba(255, 69, 0, 0.95)', [6, 4]);       /* trim / fold */
        vline(L.spine.x, 'rgba(255, 69, 0, 0.95)', [6, 4]); vline(L.spine.x + L.spine.w, 'rgba(255, 69, 0, 0.95)', [6, 4]);
        L.hinge.forEach(function (h) { ctx.fillStyle = 'rgba(255, 196, 0, 0.18)'; ctx.fillRect(h.x * k, h.y * k, h.w * k, h.h * k); });
        rect(L.safeBack, 'rgba(0, 220, 255, 0.85)', [2, 3]); rect(L.safeFront, 'rgba(0, 220, 255, 0.85)', [2, 3]);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.82)'; ctx.fillRect(L.barcode.x * k, L.barcode.y * k, L.barcode.w * k, L.barcode.h * k);
        ctx.setLineDash([]); ctx.fillStyle = '#000'; ctx.font = 'bold ' + Math.max(9, Math.round(0.14 * k)) + 'px monospace';
        ctx.fillText('BARCODE', (L.barcode.x + 0.12) * k, (L.barcode.y + 0.3) * k);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'; ctx.font = '11px monospace';
        ctx.fillText('BACK', 8, 14); ctx.fillText('FRONT', W - 46, 14);
    }
    function spineText(ctx, L, o, k) {
        var area = L.spineText, cw = area.w * k, len = area.h * k, fam = o.font || 'Georgia, serif';
        ctx.save();
        ctx.translate((area.x + area.w / 2) * k, area.y * k); ctx.rotate(Math.PI / 2);     /* reads top to bottom */
        ctx.fillStyle = o.textColor || '#fff'; ctx.textBaseline = 'middle'; ctx.setLineDash([]);
        var size = cw * 0.72, gap = o.spineSub ? 0.35 * k : 0;
        function widthAt(s) {
            ctx.font = 'bold ' + s + 'px ' + fam; var a = ctx.measureText(o.spineText).width, b = 0;
            if (o.spineSub) { ctx.font = (s * 0.72) + 'px ' + fam; b = ctx.measureText(o.spineSub).width; }
            return a + b + gap;
        }
        while (size > 4 && widthAt(size) > len) { size *= 0.95; }
        ctx.textAlign = 'left'; ctx.font = 'bold ' + size + 'px ' + fam; ctx.fillText(o.spineText, 0, 0);
        if (o.spineSub) { ctx.textAlign = 'right'; ctx.font = (size * 0.72) + 'px ' + fam; ctx.fillText(o.spineSub, len, 0); }
        ctx.restore();
    }

    var token = 0;
    function render() {
        var o = opts();
        if (o.kind === 'paperback') {
            var auto = B.spineAuto(o.pages || 0);
            if (!$('bcSpine').value || +$('bcSpine').value === autoSpine) { $('bcSpine').value = auto ? auto : ''; autoSpine = auto; o.spine = auto; }
        }
        if (o.kind === 'hardcover' && o.spine > 0) {
            var a = B.hcAuto(o.trimW, o.trimH, o.spine);
            if (!$('bcHcW').getAttribute('data-touched')) { $('bcHcW').value = a.W; o.W = a.W; }
            if (!$('bcHcH').getAttribute('data-touched')) { $('bcHcH').value = a.H; o.H = a.H; }
        }
        if (img.front && img.front.bmp && (!$('bcSpineColor').getAttribute('data-touched'))) {
            var c = edgeColor(img.front.bmp); if (c !== autoColor) { autoColor = c; $('bcSpineColor').value = c; o.spineColor = c; }
        }
        var L = B.layout(o), probs = B.check(o, L, img.front, img.back);
        list($('bcProblems'), probs);
        var tb = $('bcTable'); tb.innerHTML = '';
        if (isFinite(L.W) && L.W > 0) {
            B.table(L).forEach(function (r, i) {
                var tr = document.createElement('tr');
                [String(i + 1), r[0], r[1], r[2]].forEach(function (v) { tr.appendChild(el('td', '', v)); });
                tb.appendChild(tr);
            });
        }
        var cv = $('bcCanvas'), ok = [L.W, L.H, L.spineW, L.front.w, L.front.h].every(function (v) { return isFinite(v) && v >= 0; }) && L.front.w > 0 && L.front.h > 0;
        if (!ok) { cv.hidden = true; return; }
        cv.hidden = false;
        var k = 760 / L.W; cv.width = 760; cv.height = Math.round(L.H * k);
        cv.style.aspectRatio = cv.width + ' / ' + cv.height;
        ++token; paint(cv.getContext('2d'), L, o, k, true);
    }

    function make() {
        if (running) { return; }
        var o = opts(), L = B.layout(o), probs = B.check(o, L, img.front, img.back);
        if (!img.front || !img.back) { alert('Add both the front and the back image first.'); return; }
        if (![L.W, L.H, L.spineW, L.front.w].every(function (v) { return isFinite(v) && v > 0; })) { alert('Some sizes are missing (pages, spine or the hardcover numbers).'); return; }
        if (probs.some(function (p) { return p.level === 'err'; }) && !confirm('The check found problems (red). Make the PDF anyway?')) { return; }
        running = true; $('bcGo').disabled = true; say('Building the cover (' + L.Wpx + ' x ' + L.Hpx + ' px)...');
        var t0 = Date.now(), cv = document.createElement('canvas'); cv.width = L.Wpx; cv.height = L.Hpx;
        setTimeout(function () {
            try { paint(cv.getContext('2d'), L, o, K.dpi, false); } catch (e) { done(e); return; }
            cv.toBlob(function (jpg) {
                if (!jpg) { done(new Error('The browser could not make the JPEG (image too big for this browser?).')); return; }
                var pdf = LAB.pdfWriter(Math.round(L.W * 72 * 1000) / 1000, Math.round(L.H * 72 * 1000) / 1000);
                pdf.addJpegPage(jpg, L.Wpx, L.Hpx);
                var name = B.fileName($('bcTitle').value, o.kind, o.pages);
                var blob = new Blob(pdf.finish(($('bcTitle').value || 'Book') + ' - ' + o.kind + ' cover'), { type: 'application/pdf' });
                download(blob, name);
                var msg = 'Done in ' + Math.round((Date.now() - t0) / 1000) + ' s: ' + L.Wpx + ' x ' + L.Hpx + ' px, ' + L.W.toFixed(3) + '" x ' + L.H.toFixed(3) + '", ' + kb(blob.size) + '. File: ' + name;
                if (!$('bcPng').checked) { done(null, msg); return; }
                say(msg + ' Making the PNG copy...');
                cv.toBlob(function (png) {
                    if (png) { download(png, name.replace(/\.pdf$/, '.png')); msg += ' + PNG copy (' + kb(png.size) + ').'; }
                    done(null, msg);
                }, 'image/png');
            }, 'image/jpeg', parseInt($('bcQuality').value, 10) / 100);
        }, 30);
        function done(err, msg) { cv.width = 0; running = false; $('bcGo').disabled = false; say(err ? 'Stopped: ' + err.message : msg); }
    }
    function kindle() {
        if (!img.front) { alert('Add the front image first.'); return; }
        var b = img.front.bmp, c = document.createElement('canvas'); c.width = b.width; c.height = b.height;
        c.getContext('2d').drawImage(b, 0, 0);
        c.toBlob(function (jpg) {
            c.width = 0;
            if (!jpg) { say('The browser could not make the JPEG.'); return; }
            download(jpg, String($('bcTitle').value || 'Book').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') + '_KINDLE_COVER.jpg');
            say('Kindle cover: ' + b.width + ' x ' + b.height + ' px JPEG, ' + kb(jpg.size) + '.' + (b.height < 1000 ? ' Too small for Kindle (at least 1000 px tall).' : b.height < 2560 ? ' OK for Kindle; about 2560 px tall looks sharper in the store.' : ' Good size for Kindle.'));
        }, 'image/jpeg', 0.92);
    }

    ['bcFront', 'bcBack'].forEach(function (id) {
        $(id).addEventListener('change', function () { setImage(id === 'bcFront' ? 'front' : 'back', this.files[0]); });
        var zone = $(id + 'Drop');
        ['dragenter', 'dragover'].forEach(function (t) { zone.addEventListener(t, function (e) { e.preventDefault(); zone.classList.add('is-over'); }); });
        ['dragleave', 'drop'].forEach(function (t) { zone.addEventListener(t, function () { zone.classList.remove('is-over'); }); });
        zone.addEventListener('drop', function (e) { e.preventDefault(); var f = e.dataTransfer.files[0]; if (f) { setImage(id === 'bcFront' ? 'front' : 'back', f); } });
    });
    $('bcKind').addEventListener('change', function () { fillTrims(); render(); });
    ['bcTrim', 'bcPages', 'bcSpine', 'bcHcW', 'bcHcH', 'bcHcSpine', 'bcSpineTitle', 'bcSpineSub', 'bcTextColor', 'bcFont', 'bcEdge', 'bcFit'].forEach(function (id) {
        $(id).addEventListener('input', render); $(id).addEventListener('change', render);
    });
    $('bcSpineColor').addEventListener('input', function () { this.setAttribute('data-touched', '1'); render(); });
    ['bcHcW', 'bcHcH'].forEach(function (id) { $(id).addEventListener('input', function () { if (this.value) { this.setAttribute('data-touched', '1'); } else { this.removeAttribute('data-touched'); } }); });
    $('bcSpineAuto').addEventListener('click', function () { $('bcSpineColor').removeAttribute('data-touched'); autoColor = ''; render(); });
    $('bcQuality').addEventListener('input', function () { $('bcQualityOut').textContent = this.value; });
    $('bcGo').addEventListener('click', make);
    $('bcKindle').addEventListener('click', kindle);
    fillTrims(); render();
})();
