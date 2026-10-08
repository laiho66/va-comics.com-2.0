/* VA COMICS // Foundry v2 // foundry-lab.js  (Print Lab tab, Faza 1: WebP converter)
   Works fully in the browser. Pages are converted one by one, so 50+ page issues do not fill the memory. */
(function () {
    'use strict';
    var L = FoundryLab, C = window.FoundryCore;
    var $ = function (id) { return document.getElementById(id); };
    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) { n.className = cls; } if (text !== undefined) { n.textContent = text; } return n; }

    var files = [], plan = null, result = null, running = false;

    /* ---------------- helpers ---------------- */
    function isImg(f) { return /\.(png|jpe?g|webp)$/i.test(f.name); }
    function list(box, items) {
        box.innerHTML = '';
        items.forEach(function (p) { box.appendChild(el('li', 'is-' + p.level, p.text)); });
    }
    function progress(prefix, done, total, text) {
        $(prefix + 'Progress').hidden = false;
        $(prefix + 'Bar').style.width = (total ? Math.round(done / total * 100) : 0) + '%';
        $(prefix + 'ProgressText').textContent = text;
    }
    function kb(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB'; }
    function download(blob, name) {
        var a = document.createElement('a'), url = URL.createObjectURL(blob);
        a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    }
    function toBlob(canvas, q) {
        return new Promise(function (res, rej) {
            canvas.toBlob(function (b) {
                if (!b) { rej(new Error('The browser could not make the WebP file.')); return; }
                if (b.type !== 'image/webp') { rej(new Error('This browser cannot save WebP. Use Chrome, Edge or Firefox.')); return; }
                res(b);
            }, 'image/webp', q);
        });
    }
    function decode(file) {
        return createImageBitmap(file).catch(function () { throw new Error(file.name + ' could not be opened (damaged file or not an image).'); });
    }
    /* draw a bitmap into a canvas of size tw x th; src = rectangle of the source to use */
    function draw(bmp, tw, th, src) {
        var c = document.createElement('canvas'); c.width = tw; c.height = th;
        var x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
        if (src) { x.drawImage(bmp, src.sx, src.sy, src.sw, src.sh, 0, 0, tw, th); } else { x.drawImage(bmp, 0, 0, tw, th); }
        return c;
    }
    function freeCanvas(c) { c.width = 0; c.height = 0; }

    /* files from a drop: supports dropping a whole folder (one level deep is enough for an issue) */
    function filesFromDrop(dt) {
        var items = dt.items ? Array.prototype.slice.call(dt.items) : [];
        var entries = items.map(function (i) { return i.webkitGetAsEntry ? i.webkitGetAsEntry() : null; }).filter(Boolean);
        if (!entries.length) { return Promise.resolve(Array.prototype.slice.call(dt.files || [])); }
        function readEntry(entry, depth) {
            if (entry.isFile) { return new Promise(function (res) { entry.file(function (f) { res([f]); }, function () { res([]); }); }); }
            if (!entry.isDirectory || depth > 2) { return Promise.resolve([]); }
            var reader = entry.createReader(), all = [];
            return new Promise(function (res) {
                (function more() {
                    reader.readEntries(function (batch) {
                        if (!batch.length) { Promise.all(all.map(function (e) { return readEntry(e, depth + 1); })).then(function (r) { res([].concat.apply([], r)); }); return; }
                        all = all.concat(Array.prototype.slice.call(batch)); more();
                    }, function () { res([]); });
                })();
            });
        }
        return Promise.all(entries.map(function (e) { return readEntry(e, 0); })).then(function (r) { return [].concat.apply([], r); });
    }
    function wireDrop(zone, onFiles) {
        ['dragenter', 'dragover'].forEach(function (t) { zone.addEventListener(t, function (e) { e.preventDefault(); zone.classList.add('is-over'); }); });
        ['dragleave', 'drop'].forEach(function (t) { zone.addEventListener(t, function () { zone.classList.remove('is-over'); }); });
        zone.addEventListener('drop', function (e) { e.preventDefault(); filesFromDrop(e.dataTransfer).then(onFiles); });
    }

    /* ======================== ISSUE CONVERTER ======================== */
    function folderFor(key) { return C && C.suggestFolder ? C.suggestFolder(key) : 'issue' + key; }
    function coverFor(key) { return C && C.coverFile ? C.coverFile(key) : 'cover' + key; }

    function loadIssueFiles(list) {
        files = list.filter(isImg);
        result = null; $('labToIssue').hidden = true; $('labProgress').hidden = true;
        files.sort(function (a, b) { return L.naturalCompare(a.name, b.name); });
        replan(true);
    }
    function replan(fresh) {
        plan = L.planIssue(files, { oldLastIsBack: $('labOldBack').checked });
        $('labPlan').hidden = false;
        if (fresh && plan.issue) { $('labKey').value = plan.issue; $('labFolderName').value = folderFor(plan.issue); }
        var last = plan.order.length ? plan.order[plan.order.length - 1] : null;
        $('labOldBox').hidden = plan.convention !== 'old';
        if (plan.convention === 'old') { $('labOldLast').textContent = last && last.role === 'back' ? last.file.name : 'last _p file'; }

        var sum = $('labSummary'); sum.innerHTML = '';
        if (plan.order.length) {
            var pages = plan.order.filter(function (o) { return o.role === 'page'; }).length;
            sum.appendChild(el('div', '', '')).innerHTML = 'Issue <b>#' + plan.issue + '</b> · naming: <b>' + (plan.convention === 'new' ? 'frontcover / backcover' : plan.convention === 'old' ? 'old (_p0 = front cover)' : 'pages only') + '</b>';
            sum.appendChild(el('div', '', '')).innerHTML = '<b>' + plan.order.length + '</b> files for the reader = ' +
                (plan.order[0].role === 'front' ? '1 front cover + ' : '') + pages + ' pages' + (last && last.role === 'back' ? ' + 1 back cover' : '');
        }
        var probs = plan.problems.slice();
        if (plan.ignored.length) { probs.push({ level: 'info', text: 'Ignored (name not recognised): ' + plan.ignored.join(', ') }); }
        list($('labProblems'), probs);
        var ol = $('labOrder'); ol.innerHTML = '';
        plan.order.forEach(function (o) { ol.appendChild(el('li', '', o.file.name + '  →  ' + o.out)); });
        $('labGo').disabled = !plan.order.length;
        if (plan.order.length) { checkSizesAsync(); }
    }
    function checkSizesAsync() {
        var my = plan;
        Promise.all(my.order.map(function (o) {
            return o.file.slice(0, 262144).arrayBuffer().then(function (buf) {
                var s = L.readSize(buf) || {};
                return { label: o.file.name, role: o.role, w: s.w, h: s.h };
            }).catch(function () { return { label: o.file.name, role: o.role }; });
        })).then(function (sizes) {
            if (my !== plan) { return; }
            var box = $('labProblems');
            L.checkSizes(sizes).forEach(function (p) { box.appendChild(el('li', 'is-' + p.level, p.text)); });
        });
    }

    function convertIssue() {
        if (running || !plan || !plan.order.length) { return; }
        var key = $('labKey').value.trim(), folder = $('labFolderName').value.trim(), q = parseInt($('labQuality').value, 10) / 100;
        if (!/^\w+$/.test(key)) { alert('The issue key can only have letters, digits and _ (example: 14 or 11_1).'); return; }
        if (!/^[\w\-]+$/.test(folder)) { alert('The folder name can only have letters, digits, - and _.'); return; }
        running = true; $('labGo').disabled = true; $('labToIssue').hidden = true;
        var order = plan.order.slice(), entries = [], total = 0, coverBlob = null, t0 = Date.now();
        var steps = order.length + 1;
        function one(i) {
            if (i >= order.length) { return Promise.resolve(); }
            var o = order[i];
            progress('lab', i, steps, 'Converting ' + (i + 1) + ' / ' + order.length + ': ' + o.file.name);
            return decode(o.file).then(function (bmp) {
                var c = draw(bmp, bmp.width, bmp.height);
                var jobs = [toBlob(c, q)];
                if (o.role === 'front') {
                    var h = Math.round(600 * bmp.height / bmp.width), cc = draw(bmp, 600, h);
                    jobs.push(toBlob(cc, 0.86).then(function (b) { freeCanvas(cc); return b; }));
                }
                bmp.close();
                return Promise.all(jobs).then(function (bl) {
                    freeCanvas(c);
                    if (bl[1]) { coverBlob = bl[1]; }
                    return bl[0].arrayBuffer().then(function (ab) {
                        entries.push({ path: folder + '/' + o.out, data: new Uint8Array(ab) }); total += ab.byteLength;
                    });
                });
            }).then(function () { return one(i + 1); });
        }
        one(0).then(function () {
            progress('lab', order.length, steps, 'Packing the zip...');
            var p = coverBlob ? coverBlob.arrayBuffer().then(function (ab) { entries.push({ path: coverFor(key) + '.webp', data: new Uint8Array(ab) }); }) : Promise.resolve();
            return p;
        }).then(function () {
            var zip = new Blob(L.buildZip(entries), { type: 'application/zip' });
            download(zip, folder + '.zip');
            result = { key: key, folder: folder, pages: order.length, cover: coverBlob ? new File([coverBlob], coverFor(key) + '.webp', { type: 'image/webp' }) : null };
            progress('lab', steps, steps, 'Done in ' + Math.round((Date.now() - t0) / 1000) + ' s: ' + order.length + ' pages, ' + kb(total) +
                ' (about ' + kb(total / order.length) + ' per page). Zip: ' + folder + '.zip');
            $('labToIssue').hidden = false;
        }).catch(function (e) {
            progress('lab', 0, 1, 'Stopped: ' + (e && e.message ? e.message : e));
        }).then(function () { running = false; $('labGo').disabled = false; entries = null; });
    }

    function sendToIssues() {
        if (!result) { return; }
        var k = $('iKey'); if (!k) { return; }
        k.value = result.key; k.dispatchEvent(new Event('input', { bubbles: true }));
        $('iPages').value = String(result.pages);
        $('iFolder').value = result.folder;
        if (result.cover && window.DataTransfer) {
            try { var dt = new DataTransfer(); dt.items.add(result.cover); $('iCover').files = dt.files; } catch (e) { /* the cover can still be chosen by hand */ }
        }
        var tab = document.querySelector('#tabs [data-tab="issues"]'); if (tab) { tab.click(); }
        var st = $('status');
        if (st) { st.hidden = false; st.className = 'fstatus is-info';
            st.textContent = 'Filled in from Print Lab: key ' + result.key + ', folder ' + result.folder + ', ' + result.pages + ' pages' + (result.cover ? ', cover ' + result.cover.name : '') +
                '. Write the title, upload the pages to R2 first, then press ADD_ISSUE.'; }
        $('iTitle').focus();
    }

    $('labFolder').addEventListener('change', function () { loadIssueFiles(Array.prototype.slice.call(this.files)); this.value = ''; });
    $('labFiles').addEventListener('change', function () { loadIssueFiles(Array.prototype.slice.call(this.files)); this.value = ''; });
    wireDrop($('labDrop'), loadIssueFiles);
    $('labOldBack').addEventListener('change', function () { replan(false); });
    $('labKey').addEventListener('input', function () { var k = this.value.trim(); if (/^\w+$/.test(k)) { $('labFolderName').value = folderFor(k); } });
    $('labQuality').addEventListener('input', function () { $('labQualityOut').textContent = this.value; });
    $('labGo').addEventListener('click', convertIssue);
    $('labToIssue').addEventListener('click', sendToIssues);

    /* ======================== QUICK CONVERT ======================== */
    function targetSize(preset, w, h) {
        if (preset === 'orig') { return { w: w, h: h }; }
        if (preset === 'maxw') { var m = parseInt($('qcMax').value, 10) || w; return m >= w ? { w: w, h: h } : { w: m, h: Math.round(h * m / w) }; }
        var p = preset.split(':'), v = p[1].split('x');
        if (p[0] === 'width') { var tw = parseInt(v[0], 10); return { w: tw, h: Math.round(h * tw / w) }; }
        var cw = parseInt(v[0], 10), ch = parseInt(v[1], 10);
        return { w: cw, h: ch, crop: L.coverCrop(w, h, cw, ch) };
    }
    function quickConvert(inp) {
        var imgs = inp.filter(function (f) { return /^image\//.test(f.type) || isImg(f); });
        if (!imgs.length || running) { return; }
        running = true;
        var preset = $('qcPreset').value, q = parseInt($('qcQuality').value, 10) / 100, out = [], notes = [], used = {};
        function one(i) {
            if (i >= imgs.length) { return Promise.resolve(); }
            var f = imgs[i];
            progress('qc', i, imgs.length, 'Converting ' + (i + 1) + ' / ' + imgs.length + ': ' + f.name);
            return decode(f).then(function (bmp) {
                var t = targetSize(preset, bmp.width, bmp.height), c = draw(bmp, t.w, t.h, t.crop), sw = bmp.width, sh = bmp.height;
                bmp.close();
                return toBlob(c, q).then(function (b) {
                    freeCanvas(c);
                    var name = L.baseName(f.name), n = name, k = 2; while (used[n]) { n = name + '_' + k++; } used[n] = 1;
                    out.push({ name: n + '.webp', blob: b });
                    var up = t.w > sw || t.h > sh;
                    notes.push({ level: up ? 'warn' : 'ok', text: f.name + ' (' + sw + 'x' + sh + ', ' + kb(f.size) + ') → ' + n + '.webp (' + t.w + 'x' + t.h + ', ' + kb(b.size) + ')' + (up ? ' — enlarged, may look soft' : '') });
                });
            }).catch(function (e) { notes.push({ level: 'err', text: e.message || String(e) }); }).then(function () { return one(i + 1); });
        }
        one(0).then(function () {
            if (out.length === 1) { download(out[0].blob, out[0].name); }
            else if (out.length > 1) {
                return Promise.all(out.map(function (o) { return o.blob.arrayBuffer().then(function (ab) { return { path: o.name, data: new Uint8Array(ab) }; }); }))
                    .then(function (entries) { download(new Blob(L.buildZip(entries), { type: 'application/zip' }), 'converted_webp.zip'); });
            }
        }).then(function () {
            progress('qc', 1, 1, out.length ? 'Done: ' + out.length + ' file(s)' + (out.length > 1 ? ' in converted_webp.zip' : '') + '.' : 'Nothing was converted.');
            list($('qcResult'), notes);
        }).catch(function (e) { progress('qc', 0, 1, 'Stopped: ' + (e.message || e)); })
          .then(function () { running = false; });
    }
    $('qcFiles').addEventListener('change', function () { quickConvert(Array.prototype.slice.call(this.files)); this.value = ''; });
    wireDrop($('qcDrop'), quickConvert);
    $('qcPreset').addEventListener('change', function () { $('qcMaxBox').hidden = this.value !== 'maxw'; });
    $('qcQuality').addEventListener('input', function () { $('qcQualityOut').textContent = this.value; });
})();
