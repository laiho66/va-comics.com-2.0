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
        $('prBody').hidden = true; $('prEmpty').hidden = false;
        $('pcBody').hidden = true; $('pcEmpty').hidden = false; $('pcPages').value = ''; $('pcSpine').value = ''; pcAuto = { pages: 0, spine: 0 };
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
            my.sizes = sizes; renderPrint();
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

    /* ======================== PAPERBACK INTERIOR (Faza 2) ======================== */
    function storyPages() {
        if (!plan || !plan.sizes) { return []; }
        return plan.order.map(function (o, i) { var z = plan.sizes[i] || {}; return { file: o.file, label: o.label, role: o.role, w: z.w, h: z.h }; })
            .filter(function (o) { return o.role === 'page'; });
    }
    function safeVal() { return parseInt($('prSafe').value, 10) / 100; }
    function renderPrint() {
        var pages = storyPages();
        $('prBody').hidden = !pages.length; $('prEmpty').hidden = !!pages.length;
        if (!pages.length) { return; }
        var sel = $('prPage'), keep = sel.value; sel.innerHTML = '';
        pages.forEach(function (p, i) { var o = document.createElement('option'); o.value = String(i); o.textContent = p.label + ' (' + p.file.name + ')'; sel.appendChild(o); });
        if (keep && +keep < pages.length) { sel.value = keep; }
        var chk = L.printCheck(pages, safeVal());
        list($('prProblems'), chk.problems);
        drawPreview();
        renderCover();
    }
    var previewToken = 0;
    function drawPreview() {
        var pages = storyPages(), p = pages[parseInt($('prPage').value, 10) || 0], cv = $('prCanvas');
        if (!p) { return; }
        var my = ++previewToken, P = L.PRINT, k = cv.width / P.pageW, ctx = cv.getContext('2d');
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
        createImageBitmap(p.file).then(function (bmp) {
            if (my !== previewToken) { bmp.close(); return; }
            var pl = L.printPlacement(bmp.width, bmp.height, safeVal());
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(bmp, pl.x * k, pl.y * k, pl.w * k, pl.h * k); bmp.close();
            /* trim line: 0.125 in of bleed top, bottom and outer edge (shown for a right-hand page) */
            var b = P.bleed * P.dpi * k;
            ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255, 69, 0, 0.9)'; ctx.lineWidth = 1;
            ctx.strokeRect(0.5, b, cv.width - b - 0.5, cv.height - 2 * b);
        }).catch(function () { ctx.fillStyle = '#ff5a5a'; ctx.font = '14px monospace'; ctx.fillText('cannot open', 10, 24); });
    }

    function makeInterior() {
        var pages = storyPages();
        if (running || !pages.length) { return; }
        var chk = L.printCheck(pages, safeVal());
        if (chk.problems.some(function (p) { return p.level === 'err'; }) &&
            !confirm('The preflight found problems (red). Make the PDF anyway?')) { return; }
        running = true; $('prGo').disabled = true;
        var P = L.PRINT, q = parseInt($('prQuality').value, 10) / 100, safe = safeVal(), t0 = Date.now();
        var pdf = L.pdfWriter(Math.round((P.trimW + P.bleed) * 72 * 1000) / 1000, Math.round((P.trimH + 2 * P.bleed) * 72 * 1000) / 1000);
        var steps = chk.total, blankJpeg = null;
        var cv = document.createElement('canvas'); cv.width = P.pageW; cv.height = P.pageH;
        var ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        function jpeg() {
            return new Promise(function (res, rej) { cv.toBlob(function (b) { if (b) { res(b); } else { rej(new Error('The browser could not make the JPEG.')); } }, 'image/jpeg', q); });
        }
        function one(i) {
            if (i >= pages.length) { return Promise.resolve(); }
            var p = pages[i];
            progress('pr', i, steps, 'Page ' + (i + 1) + ' / ' + steps + ': ' + p.file.name);
            return decode(p.file).then(function (bmp) {
                var pl = L.printPlacement(bmp.width, bmp.height, safe);
                ctx.fillStyle = '#000'; ctx.fillRect(0, 0, P.pageW, P.pageH);
                ctx.drawImage(bmp, pl.x, pl.y, pl.w, pl.h); bmp.close();
                return jpeg();
            }).then(function (b) { pdf.addJpegPage(b, P.pageW, P.pageH); return one(i + 1); });
        }
        function blanks(n) {
            if (!n) { return Promise.resolve(); }
            var go = blankJpeg ? Promise.resolve(blankJpeg) : (ctx.fillStyle = '#000', ctx.fillRect(0, 0, P.pageW, P.pageH), jpeg().then(function (b) { blankJpeg = b; return b; }));
            return go.then(function (b) { pdf.addJpegPage(b, P.pageW, P.pageH); progress('pr', steps - n + 1, steps, 'Black page ' + (chk.blanks - n + 1) + ' / ' + chk.blanks); return blanks(n - 1); });
        }
        var key = ($('labKey').value.trim() || plan.issue).replace(/[^\w]/g, '_');
        var name = 'DeadDrop_Issue_' + key + '_INTERIOR_6x9_bleed.pdf';
        one(0).then(function () { return blanks(chk.blanks); }).then(function () {
            var blob = new Blob(pdf.finish('Dead Drop Issue ' + key + ' - interior'), { type: 'application/pdf' });
            download(blob, name);
            progress('pr', steps, steps, 'Done in ' + Math.round((Date.now() - t0) / 1000) + ' s: ' + pdf.pages() + ' pages, ' + kb(blob.size) + '. File: ' + name);
        }).catch(function (e) {
            progress('pr', 0, 1, 'Stopped: ' + (e && e.message ? e.message : e));
        }).then(function () { running = false; $('prGo').disabled = false; freeCanvas(cv); });
    }
    $('prSafe').addEventListener('input', function () { $('prSafeOut').textContent = this.value; renderPrint(); });
    $('prQuality').addEventListener('input', function () { $('prQualityOut').textContent = this.value; });
    $('prPage').addEventListener('change', drawPreview);
    $('prGo').addEventListener('click', makeInterior);

    /* ======================== PAPERBACK COVER (Faza 3) ======================== */
    function coverFiles() {
        if (!plan || !plan.sizes) { return null; }
        var f = null, b = null;
        plan.order.forEach(function (o, i) {
            var z = plan.sizes[i] || {}, x = { file: o.file, w: z.w, h: z.h };
            if (o.role === 'front') { f = x; } if (o.role === 'back') { b = x; }
        });
        return { front: f, back: b };
    }
    var pcAuto = { pages: 0, spine: 0 };
    function pcLayout() {
        var pages = parseInt($('pcPages').value, 10) || 24, sp = parseFloat($('pcSpine').value);
        return L.coverLayout(pages, isNaN(sp) ? undefined : sp);
    }
    function renderCover() {
        var c = coverFiles(), pages = storyPages();
        var has = !!(c && (c.front || c.back));
        $('pcBody').hidden = !has; $('pcEmpty').hidden = has;
        if (!has) { return; }
        var total = L.printCheck(pages, safeVal()).total || 24;
        /* refill pages/spine only while the user has not typed their own values */
        if (!$('pcPages').value || +$('pcPages').value === pcAuto.pages) { $('pcPages').value = total; pcAuto.pages = total; }
        var auto = +L.spineInches(+$('pcPages').value).toFixed(4);
        if (!$('pcSpine').value || +$('pcSpine').value === pcAuto.spine) { $('pcSpine').value = auto; pcAuto.spine = auto; }
        var lay = pcLayout();
        list($('pcProblems'), L.coverCheck(c.front, c.back, lay));
        drawCoverPreview(c, lay);
    }
    var pcToken = 0;
    function drawCoverPreview(c, lay) {
        var cv = $('pcCanvas'), my = ++pcToken;
        cv.width = 738; cv.height = Math.round(738 * lay.H / lay.W);
        var k = cv.width / lay.W, ctx = cv.getContext('2d');
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
        var jobs = [[c.back, lay.back], [c.front, lay.front]].map(function (x) {
            if (!x[0]) { return Promise.resolve(); }
            return createImageBitmap(x[0].file).then(function (bmp) {
                if (my !== pcToken) { bmp.close(); return; }
                var pl = L.coverPlacement(bmp.width, bmp.height, x[1]);
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(bmp, pl.x * k, pl.y * k, pl.w * k, pl.h * k); bmp.close();
            }).catch(function () { /* the preflight already says it */ });
        });
        Promise.all(jobs).then(function () {
            if (my !== pcToken) { return; }
            var b = L.PRINT.bleed * L.PRINT.dpi * k;
            ctx.setLineDash([5, 4]); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255, 69, 0, 0.95)';
            ctx.strokeRect(b, b, cv.width - 2 * b, cv.height - 2 * b);                      /* trim */
            ctx.beginPath(); ctx.moveTo(lay.spine.x * k, 0); ctx.lineTo(lay.spine.x * k, cv.height);
            ctx.moveTo((lay.spine.x + lay.spine.w) * k, 0); ctx.lineTo((lay.spine.x + lay.spine.w) * k, cv.height); ctx.stroke();
            ctx.setLineDash([]); ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'; ctx.font = '11px monospace';
            ctx.fillText('BACK', 10, 18); ctx.fillText('FRONT', cv.width - 48, 18);
        });
    }
    function makeCover() {
        var c = coverFiles();
        if (running || !c) { return; }
        if (!c.front || !c.back) { if (!confirm('Only one cover was found. Make the PDF with the other side black?')) { return; } }
        var lay = pcLayout(), probs = L.coverCheck(c.front, c.back, lay);
        if (probs.some(function (x) { return x.level === 'err'; }) && !confirm('The preflight found problems (red). Make the cover PDF anyway?')) { return; }
        running = true; $('pcGo').disabled = true; $('pcKindle').disabled = true;
        var q = parseInt($('pcQuality').value, 10) / 100, t0 = Date.now();
        var cv = document.createElement('canvas'); cv.width = lay.W; cv.height = lay.H;
        var ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, lay.W, lay.H);
        progress('pc', 0, 3, 'Placing the covers...');
        var parts = [[c.back, lay.back], [c.front, lay.front]];
        parts.reduce(function (p, x, i) {
            return p.then(function () {
                if (!x[0]) { return; }
                return decode(x[0].file).then(function (bmp) {
                    var pl = L.coverPlacement(bmp.width, bmp.height, x[1]);
                    ctx.drawImage(bmp, pl.x, pl.y, pl.w, pl.h); bmp.close();
                    progress('pc', i + 1, 3, (i ? 'Front' : 'Back') + ' cover placed.');
                });
            });
        }, Promise.resolve()).then(function () {
            return new Promise(function (res, rej) { cv.toBlob(function (b) { if (b) { res(b); } else { rej(new Error('The browser could not make the JPEG.')); } }, 'image/jpeg', q); });
        }).then(function (jpg) {
            var pdf = L.pdfWriter(Math.round(lay.wIn * 72 * 1000) / 1000, Math.round(lay.hIn * 72 * 1000) / 1000);
            pdf.addJpegPage(jpg, lay.W, lay.H);
            var key = ($('labKey').value.trim() || plan.issue).replace(/[^\w]/g, '_');
            var name = 'DeadDrop_Issue_' + key + '_COVER_' + $('pcPages').value + 'p.pdf';
            var blob = new Blob(pdf.finish('Dead Drop Issue ' + key + ' - cover'), { type: 'application/pdf' });
            download(blob, name);
            progress('pc', 3, 3, 'Done in ' + Math.round((Date.now() - t0) / 1000) + ' s: ' + lay.W + ' x ' + lay.H + ' px, ' + lay.wIn.toFixed(3) + '" x ' + lay.hIn.toFixed(3) + '", ' + kb(blob.size) + '. File: ' + name);
        }).catch(function (e) {
            progress('pc', 0, 1, 'Stopped: ' + (e && e.message ? e.message : e));
        }).then(function () { running = false; $('pcGo').disabled = false; $('pcKindle').disabled = false; freeCanvas(cv); });
    }
    function kindleCover() {
        var c = coverFiles();
        if (running || !c || !c.front) { alert('No front cover in this folder.'); return; }
        running = true;
        decode(c.front.file).then(function (bmp) {
            var cv = draw(bmp, bmp.width, bmp.height), w = bmp.width, h = bmp.height; bmp.close();
            return new Promise(function (res, rej) { cv.toBlob(function (b) { freeCanvas(cv); if (b) { res({ b: b, w: w, h: h }); } else { rej(new Error('The browser could not make the JPEG.')); } }, 'image/jpeg', 0.92); });
        }).then(function (r) {
            var key = ($('labKey').value.trim() || plan.issue).replace(/[^\w]/g, '_');
            download(r.b, 'DeadDrop_Issue_' + key + '_KINDLE_COVER.jpg');
            var note = r.h < 1000 ? ' Too small for Kindle (minimum 1000 px tall).' : (r.h < 2560 ? ' OK for Kindle; about 2560 px tall looks sharper in the store.' : ' Good size for Kindle.');
            progress('pc', 1, 1, 'Kindle cover: ' + r.w + ' x ' + r.h + ' px, ' + kb(r.b.size) + '.' + note);
        }).catch(function (e) { progress('pc', 0, 1, 'Stopped: ' + (e && e.message ? e.message : e)); })
          .then(function () { running = false; });
    }
    $('pcPages').addEventListener('input', function () {
        var auto = +L.spineInches(+this.value || 24).toFixed(4);
        if (+$('pcSpine').value === pcAuto.spine) { $('pcSpine').value = auto; pcAuto.spine = auto; }
        renderCover();
    });
    $('pcSpine').addEventListener('input', renderCover);
    $('pcQuality').addEventListener('input', function () { $('pcQualityOut').textContent = this.value; });
    $('pcGo').addEventListener('click', makeCover);
    $('pcKindle').addEventListener('click', kindleCover);

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
