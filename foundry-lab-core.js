/* VA COMICS // Foundry v2 // foundry-lab-core.js  (Print Lab, Faza 1)
   Pure functions, no page code: read file names, plan an issue, read image sizes, build a zip.
   Can be tested on its own (node). Nothing here is sent anywhere: it all runs in your browser. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) { module.exports = factory(); }
    else { root.FoundryLab = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var IMG_EXT = /\.(png|jpe?g|webp)$/i;

    /* "#13_p7.png" -> { issue: "13", kind: "page", num: 7 }
       "#13_frontcover.png" -> { issue: "13", kind: "front" }   "#11_1_p3.png" -> issue "11_1" */
    function parseName(name) {
        var m = /^#?(\d+(?:_\d+)?)_(p(\d+)|frontcover|backcover)\.(png|jpe?g|webp)$/i.exec(String(name).trim());
        if (!m) { return null; }
        var tag = m[2].toLowerCase();
        if (tag === 'frontcover') { return { issue: m[1], kind: 'front' }; }
        if (tag === 'backcover') { return { issue: m[1], kind: 'back' }; }
        return { issue: m[1], kind: 'page', num: parseInt(m[3], 10) };
    }

    function naturalKey(s) {
        return String(s).split(/(\d+)/).map(function (t) { return /^\d+$/.test(t) ? parseInt(t, 10) : t.toLowerCase(); });
    }
    function naturalCompare(a, b) {
        var x = naturalKey(a), y = naturalKey(b);
        for (var i = 0; i < Math.max(x.length, y.length); i++) {
            if (x[i] === undefined) { return -1; }
            if (y[i] === undefined) { return 1; }
            if (x[i] === y[i]) { continue; }
            if (typeof x[i] === 'number' && typeof y[i] === 'number') { return x[i] - y[i]; }
            return String(x[i]) < String(y[i]) ? -1 : 1;
        }
        return 0;
    }

    /* files: [{ name, size }] (anything with a name). opts.oldLastIsBack: in the old naming (p0 = front),
       the last page is the back cover (default true).
       Returns { issue, convention, order: [{ file, role, label, out }], ignored, problems: [{ level, text }] } */
    function planIssue(files, opts) {
        opts = opts || {};
        var oldLastIsBack = opts.oldLastIsBack !== false;
        var problems = [], ignored = [], parsed = [], issues = {};
        files.forEach(function (f) {
            var p = parseName(f.name);
            if (!p) { if (IMG_EXT.test(f.name)) { ignored.push(f.name); } return; }
            if (!f.size) { problems.push({ level: 'err', text: f.name + ' is empty (0 KB). Export it again.' }); }
            issues[p.issue] = (issues[p.issue] || 0) + 1;
            parsed.push({ file: f, info: p });
        });
        var ids = Object.keys(issues);
        if (!parsed.length) {
            return { issue: '', convention: '', order: [], ignored: ignored, problems: [{ level: 'err', text: 'No file named like #13_p1.png, #13_frontcover.png or #13_backcover.png was found.' }] };
        }
        ids.sort(function (a, b) { return issues[b] - issues[a]; });
        var issue = ids[0];
        if (ids.length > 1) {
            problems.push({ level: 'err', text: 'The folder mixes issues: ' + ids.map(function (i) { return '#' + i + ' (' + issues[i] + ' files)'; }).join(', ') + '. Only #' + issue + ' is used.' });
        }
        parsed = parsed.filter(function (p) { return p.info.issue === issue; });

        var front = null, back = null, pages = {}, dup = [];
        parsed.forEach(function (p) {
            var i = p.info;
            if (i.kind === 'front') { if (front) { dup.push(p.file.name); } else { front = p.file; } return; }
            if (i.kind === 'back') { if (back) { dup.push(p.file.name); } else { back = p.file; } return; }
            if (pages[i.num]) { dup.push(p.file.name); } else { pages[i.num] = p.file; }
        });
        dup.forEach(function (n) { problems.push({ level: 'err', text: n + ' is a duplicate (same page twice, maybe .png and .jpg). It is skipped.' }); });

        var nums = Object.keys(pages).map(Number).sort(function (a, b) { return a - b; });
        var convention = (front || back) ? 'new' : (pages[0] ? 'old' : 'pages');
        if (pages[0]) {
            if (front) { problems.push({ level: 'err', text: 'Both _p0 and _frontcover exist. _frontcover is used, _p0 is skipped.' }); }
            else { front = pages[0]; }
            nums = nums.filter(function (n) { return n !== 0; });
        }
        if (convention === 'old' && oldLastIsBack && !back && nums.length > 1) {
            back = pages[nums[nums.length - 1]];
            nums = nums.slice(0, -1);
        }
        if (nums.length) {
            var missing = [];
            for (var n = 1; n <= nums[nums.length - 1]; n++) { if (!pages[n]) { missing.push('p' + n); } }
            if (missing.length) { problems.push({ level: 'err', text: 'Missing pages: ' + missing.join(', ') + '. The reader would skip them.' }); }
        }
        if (!front) { problems.push({ level: 'warn', text: 'No front cover found. Page 1 in the reader will be the first story page.' }); }
        if (!back && convention !== 'pages') { problems.push({ level: 'info', text: 'No back cover found. The issue ends on the last story page.' }); }

        var order = [];
        if (front) { order.push({ file: front, role: 'front', label: 'front cover' }); }
        nums.forEach(function (n) { order.push({ file: pages[n], role: 'page', label: 'p' + n }); });
        if (back) { order.push({ file: back, role: 'back', label: 'back cover' }); }
        order.forEach(function (o, idx) { o.out = 'page' + (idx + 1) + '.webp'; });
        return { issue: issue, convention: convention, order: order, ignored: ignored, problems: problems };
    }

    /* Image size from the first bytes of a PNG, JPEG or WebP file (no full decode). */
    function readSize(buf) {
        var b = new Uint8Array(buf), v = new DataView(b.buffer, b.byteOffset, b.byteLength);
        if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) {
            return { w: v.getUint32(16), h: v.getUint32(20) };
        }
        if (b.length > 4 && b[0] === 0xFF && b[1] === 0xD8) {
            var i = 2;
            while (i + 9 < b.length) {
                if (b[i] !== 0xFF) { i++; continue; }
                var mk = b[i + 1];
                if (mk === 0xD8 || mk === 0x01 || (mk >= 0xD0 && mk <= 0xD7) || mk === 0xFF) { i += (mk === 0xFF ? 1 : 2); continue; }
                var len = v.getUint16(i + 2);
                if ((mk >= 0xC0 && mk <= 0xC3) || (mk >= 0xC5 && mk <= 0xC7) || (mk >= 0xC9 && mk <= 0xCB) || (mk >= 0xCD && mk <= 0xCF)) {
                    return { w: v.getUint16(i + 7), h: v.getUint16(i + 5) };
                }
                i += 2 + len;
            }
            return null;
        }
        if (b.length > 30 && String.fromCharCode(b[0], b[1], b[2], b[3]) === 'RIFF' && String.fromCharCode(b[8], b[9], b[10], b[11]) === 'WEBP') {
            var c = String.fromCharCode(b[12], b[13], b[14], b[15]);
            if (c === 'VP8X') { return { w: 1 + (b[24] | b[25] << 8 | b[26] << 16), h: 1 + (b[27] | b[28] << 8 | b[29] << 16) }; }
            if (c === 'VP8 ') { return { w: v.getUint16(26, true) & 0x3FFF, h: v.getUint16(28, true) & 0x3FFF }; }
            if (c === 'VP8L') { var x = v.getUint32(21, true); return { w: (x & 0x3FFF) + 1, h: ((x >> 14) & 0x3FFF) + 1 }; }
        }
        return null;
    }

    /* Compare sizes inside one issue. sizes: [{ label, role, w, h }] -> problems */
    function checkSizes(sizes) {
        var out = [], count = {}, pages = sizes.filter(function (s) { return s.role === 'page'; });
        sizes.forEach(function (s) { if (!s.w) { out.push({ level: 'err', text: s.label + ': the image could not be read (damaged or not an image).' }); } });
        pages.forEach(function (s) { if (s.w) { var k = s.w + 'x' + s.h; count[k] = (count[k] || 0) + 1; } });
        var keys = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; });
        if (!keys.length) { return out; }
        var main = keys[0], mw = parseInt(main, 10), mh = parseInt(main.split('x')[1], 10);
        out.push({ level: 'ok', text: 'Story pages: ' + count[main] + ' of ' + pages.length + ' are ' + main + ' px.' });
        pages.forEach(function (s) {
            if (!s.w || (s.w + 'x' + s.h) === main) { return; }
            var ratioOff = Math.abs(s.w / s.h - mw / mh) > 0.01;
            out.push({ level: ratioOff ? 'warn' : 'info', text: s.label + ' is ' + s.w + 'x' + s.h + (ratioOff ? ' (different shape from the other pages)' : ' (same shape, different size)') + '.' });
        });
        sizes.forEach(function (s) {
            if (s.role === 'page' || !s.w) { return; }
            out.push({ level: 'info', text: s.label + ': ' + s.w + 'x' + s.h + ' px.' + (s.h < 1000 ? ' Small for Kindle (Amazon wants at least 1000 px on the long side).' : '') });
        });
        return out;
    }

    /* Size that fills the target box (crop the overflow, centred). Returns the source rectangle. */
    function coverCrop(sw, sh, tw, th) {
        var s = Math.max(tw / sw, th / sh), cw = tw / s, ch = th / s;
        return { sx: (sw - cw) / 2, sy: (sh - ch) / 2, sw: cw, sh: ch };
    }

    /* ---------------- ZIP (stored, no compression: WebP is already compressed) ---------------- */
    var CRC_TABLE = (function () {
        var t = new Uint32Array(256);
        for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) { c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; } t[n] = c >>> 0; }
        return t;
    })();
    function crc32(u8) {
        var c = 0xFFFFFFFF;
        for (var i = 0; i < u8.length; i++) { c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); }
        return (c ^ 0xFFFFFFFF) >>> 0;
    }
    /* entries: [{ path, data: Uint8Array }] -> array of Uint8Array parts (join them into a Blob) */
    function buildZip(entries) {
        var parts = [], central = [], offset = 0;
        var d = new Date(), dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
            dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
        entries.forEach(function (e) {
            var name = new TextEncoder().encode(e.path), crc = crc32(e.data), size = e.data.length;
            var h = new DataView(new ArrayBuffer(30));
            h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
            h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true); h.setUint32(14, crc, true);
            h.setUint32(18, size, true); h.setUint32(22, size, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
            parts.push(new Uint8Array(h.buffer), name, e.data);
            var c = new DataView(new ArrayBuffer(46));
            c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
            c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true); c.setUint32(16, crc, true);
            c.setUint32(20, size, true); c.setUint32(24, size, true); c.setUint16(28, name.length, true);
            c.setUint32(42, offset, true);
            central.push(new Uint8Array(c.buffer), name);
            offset += 30 + name.length + size;
        });
        var cSize = central.reduce(function (s, p) { return s + p.length; }, 0);
        var end = new DataView(new ArrayBuffer(22));
        end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
        end.setUint32(12, cSize, true); end.setUint32(16, offset, true);
        return parts.concat(central, [new Uint8Array(end.buffer)]);
    }


    /* ---------------- PRINT (Faza 2): KDP paperback interior ---------------- */
    /* Confirmed KDP setup: Premium color, trim 6 x 9 in, Bleed ON, Glossy. Page with bleed = 6.125 x 9.25 in. */
    var PRINT = { dpi: 300, trimW: 6, trimH: 9, bleed: 0.125, minPages: 24, perPageIn: 0.002347 };
    PRINT.pageW = Math.round((PRINT.trimW + PRINT.bleed) * PRINT.dpi);       /* 1838 */
    PRINT.pageH = Math.round((PRINT.trimH + PRINT.bleed * 2) * PRINT.dpi);   /* 2775 */

    /* Fit a w x h image INSIDE a box (no crop). Returns size and position. */
    function fitContain(w, h, boxW, boxH) {
        var s = Math.min(boxW / w, boxH / h), dw = Math.round(w * s), dh = Math.round(h * s);
        return { w: dw, h: dh, scale: s };
    }
    /* Where one story page goes on the print page (safe = share of the page used by the art, e.g. 0.88). */
    function printPlacement(w, h, safe) {
        var boxW = Math.round(PRINT.pageW * safe), boxH = Math.round(PRINT.pageH * safe), f = fitContain(w, h, boxW, boxH);
        return { x: Math.round((PRINT.pageW - f.w) / 2), y: Math.round((PRINT.pageH - f.h) / 2), w: f.w, h: f.h,
                 dpi: Math.round(w / (f.w / PRINT.dpi)) };
    }
    function spineInches(pages) { return pages * PRINT.perPageIn; }

    /* Print preflight. pages: [{ label, w, h }] (story pages only, in order). */
    function printCheck(pages, safe) {
        var out = [], n = pages.length, low = [], soft = [];
        if (!n) { return { problems: [{ level: 'err', text: 'No story pages to print.' }], blanks: 0, total: 0 }; }
        pages.forEach(function (p) {
            if (!p.w) { return; }
            var pl = printPlacement(p.w, p.h, safe);
            if (pl.dpi < 200) { low.push(p.label + ' (' + pl.dpi + ' DPI)'); } else if (pl.dpi < 290) { soft.push(p.label + ' (' + pl.dpi + ' DPI)'); }
        });
        var blanks = Math.max(0, PRINT.minPages - n), total = n + blanks;
        out.push({ level: 'ok', text: n + ' story pages' + (blanks ? ' + ' + blanks + ' black pages added at the end (KDP minimum is ' + PRINT.minPages + ')' : '') + ' = ' + total + ' pages in the PDF. Covers are not included (they go in the cover PDF).' });
        if (low.length) { out.push({ level: 'err', text: 'Too small for print (will look blurry): ' + low.join(', ') + '. 300 DPI is the target.' }); }
        if (soft.length) { out.push({ level: 'warn', text: 'A bit under 300 DPI (usually still fine): ' + soft.join(', ') + '.' }); }
        if (!low.length && !soft.length) { out.push({ level: 'ok', text: 'Resolution: every page is about 300 DPI or better at this size.' }); }
        var sp = spineInches(total);
        out.push({ level: 'info', text: 'For the cover PDF later: about ' + total + ' pages → spine ≈ ' + sp.toFixed(3) + '" (' + Math.round(sp * PRINT.dpi) + ' px). Check it once in the KDP cover calculator.' });
        return { problems: out, blanks: blanks, total: total };
    }

    /* Tiny PDF writer: one full-page JPEG per page. Parts can be Uint8Array or Blob (with .size). */
    function pdfWriter(pageWpt, pageHpt) {
        var enc = function (s) { return new TextEncoder().encode(s); };
        var parts = [], pos = 0, offsets = [], pageIds = [], nextId = 3;
        function push(p) { parts.push(p); pos += (p.size !== undefined ? p.size : p.length); }
        function startObj(id) { offsets[id] = pos; push(enc(id + ' 0 obj\n')); }
        push(enc('%PDF-1.4\n')); push(new Uint8Array([37, 226, 227, 207, 211, 10]));
        return {
            addJpegPage: function (jpeg, imgW, imgH) {
                var imgId = nextId++, contId = nextId++, pageId = nextId++, len = jpeg.size !== undefined ? jpeg.size : jpeg.length;
                startObj(imgId);
                push(enc('<< /Type /XObject /Subtype /Image /Width ' + imgW + ' /Height ' + imgH + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + len + ' >>\nstream\n'));
                push(jpeg); push(enc('\nendstream\nendobj\n'));
                var c = 'q ' + pageWpt + ' 0 0 ' + pageHpt + ' 0 0 cm /Im0 Do Q';
                startObj(contId); push(enc('<< /Length ' + c.length + ' >>\nstream\n' + c + '\nendstream\nendobj\n'));
                startObj(pageId);
                push(enc('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageWpt + ' ' + pageHpt + '] /Resources << /XObject << /Im0 ' + imgId + ' 0 R >> >> /Contents ' + contId + ' 0 R >>\nendobj\n'));
                pageIds.push(pageId);
            },
            finish: function (title) {
                startObj(2); push(enc('<< /Type /Pages /Count ' + pageIds.length + ' /Kids [' + pageIds.map(function (i) { return i + ' 0 R'; }).join(' ') + '] >>\nendobj\n'));
                startObj(1); push(enc('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'));
                var infoId = nextId++; startObj(infoId);
                push(enc('<< /Title (' + String(title || '').replace(/[()\\]/g, '') + ') /Producer (VA Comics Foundry Print Lab) >>\nendobj\n'));
                var xref = pos, lines = ['xref', '0 ' + nextId, '0000000000 65535 f '];
                for (var i = 1; i < nextId; i++) { lines.push(('0000000000' + offsets[i]).slice(-10) + ' 00000 n '); }
                push(enc(lines.join('\n') + '\ntrailer\n<< /Size ' + nextId + ' /Root 1 0 R /Info ' + infoId + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n'));
                return parts;
            },
            pages: function () { return pageIds.length; }
        };
    }

    function baseName(name) { return String(name).replace(/\.[^.]+$/, '').replace(/^#/, '').replace(/[^\w\-]+/g, '_'); }

    return { parseName: parseName, naturalCompare: naturalCompare, planIssue: planIssue, readSize: readSize, checkSizes: checkSizes,
             coverCrop: coverCrop, crc32: crc32, buildZip: buildZip, baseName: baseName,
             PRINT: PRINT, fitContain: fitContain, printPlacement: printPlacement, spineInches: spineInches, printCheck: printCheck, pdfWriter: pdfWriter };
});
