/* VA COMICS // Foundry v2 // foundry-videos.js
   VIDEOS tab: add, edit, reorder and remove the YouTube clips on /media/video.
   The list lives in media/video.html (const VIDEO_DATABASE = [ ... ];). Foundry only rewrites that list,
   never the rest of the page, and checks this before it saves (same safety idea as ISSUES and NEWS).
   Part 1 (FoundryVideos): pure text functions, also tested in Node. Part 2: the tab itself (browser only). */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) { module.exports = factory(); }
    else { root.FoundryVideos = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var START = 'const VIDEO_DATABASE = [';
    var STR = '"((?:[^"\\\\]|\\\\.)*)"';
    var ENTRY = new RegExp('\\{\\s*type:\\s*' + STR + '\\s*,\\s*id:\\s*' + STR + '\\s*,\\s*title:\\s*' + STR + '\\s*,\\s*meta:\\s*' + STR + '\\s*,?\\s*\\}', 'g');
    var ID_VIDEO = /^[A-Za-z0-9_-]{11}$/, ID_LIST = /^[A-Za-z0-9_-]{10,64}$/;

    function unq(s) { return JSON.parse('"' + s + '"'); }
    /* JS string literal that is safe inside <script> */
    function q(s) { return JSON.stringify(String(s)).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029'); }

    /* where the list is: { a: index after "[", b: index of the closing "];" } */
    function frame(html) {
        var s = html.indexOf(START); if (s < 0) { return null; }
        var a = s + START.length, b = html.indexOf('];', a);
        if (b < 0) { return null; }
        return { a: a, b: b };
    }
    function parse(html) {
        var f = frame(html); if (!f) { throw new Error('VIDEO_DATABASE not found in media/video.html.'); }
        var block = html.slice(f.a, f.b), out = [], m; ENTRY.lastIndex = 0;
        while ((m = ENTRY.exec(block))) {
            out.push({ type: unq(m[1]), id: unq(m[2]), title: unq(m[3]), meta: unq(m[4]) });
        }
        var opens = (block.match(/\{/g) || []).length;
        if (opens !== out.length) { throw new Error('The clip list in media/video.html has a shape Foundry does not know (' + opens + ' blocks, ' + out.length + ' read). Nothing was changed.'); }
        return out;
    }
    function build(list) {
        return '\n' + list.map(function (v) {
            return '    {\n        type: ' + q(v.type) + ',\n        id: ' + q(v.id) + ',\n        title: ' + q(v.title) + ',\n        meta: ' + q(v.meta) + '\n    }';
        }).join(',\n') + '\n';
    }
    function check(v) {
        if (v.type !== 'single' && v.type !== 'playlist') { throw new Error('Unknown clip type: ' + v.type); }
        if (v.type === 'single' && !ID_VIDEO.test(v.id)) { throw new Error('This does not look like a YouTube video id: ' + v.id); }
        if (v.type === 'playlist' && !ID_LIST.test(v.id)) { throw new Error('This does not look like a YouTube playlist id: ' + v.id); }
        if (!String(v.title).trim()) { throw new Error('Every clip needs a title.'); }
        if (String(v.title).length > 120 || String(v.meta).length > 120) { throw new Error('Title and description line: max 120 characters each.'); }
        if (/[\r\n]/.test(v.title + v.meta)) { throw new Error('Title and description must be one line.'); }
    }
    function write(html, list) {
        var f = frame(html); if (!f) { throw new Error('VIDEO_DATABASE not found in media/video.html.'); }
        if (!list.length) { throw new Error('The page needs at least one clip.'); }
        var seen = {};
        list.forEach(function (v) { check(v); var k = v.type + ':' + v.id; if (seen[k]) { throw new Error('This clip is in the list twice: ' + v.title); } seen[k] = 1; });
        return html.slice(0, f.a) + build(list) + html.slice(f.b);
    }
    /* safety check before saving: only the list may change, and it must read back exactly */
    function guard(oldHtml, newHtml, list) {
        var o = frame(oldHtml), n = frame(newHtml);
        if (!o || !n) { throw new Error('Safety check: the clip list could not be found. Nothing was saved.'); }
        if (oldHtml.slice(0, o.a) !== newHtml.slice(0, n.a) || oldHtml.slice(o.b) !== newHtml.slice(n.b)) {
            throw new Error('Safety check: this change would alter the video page outside the clip list. Nothing was saved.');
        }
        if (!/id="videoList"/.test(newHtml) || !/assets\/video\.js/.test(newHtml)) { throw new Error('Safety check: the page would lose its player. Nothing was saved.'); }
        if (list && JSON.stringify(parse(newHtml)) !== JSON.stringify(list)) { throw new Error('Safety check: the saved list would not read back the same. Nothing was saved.'); }
    }
    /* any YouTube link (or a bare id) -> { type, id } */
    function fromLink(input) {
        var s = String(input || '').trim(); if (!s) { return null; }
        if (ID_VIDEO.test(s)) { return { type: 'single', id: s }; }
        var u; try { u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); } catch (e) { return null; }
        var host = u.hostname.replace(/^www\.|^m\.|^music\./, '');
        if (host !== 'youtube.com' && host !== 'youtu.be' && host !== 'youtube-nocookie.com') { return null; }
        var v = u.searchParams.get('v'), list = u.searchParams.get('list');
        if (host === 'youtu.be') { v = u.pathname.split('/')[1]; }
        var m = /^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/.exec(u.pathname); if (m) { v = m[1]; }
        if (v && ID_VIDEO.test(v)) { return { type: 'single', id: v }; }
        if (list && ID_LIST.test(list)) { return { type: 'playlist', id: list }; }
        return null;
    }
    return { parse: parse, write: write, guard: guard, fromLink: fromLink, check: check };
});

/* ============================== the tab (browser only) ============================== */
(function () {
    'use strict';
    if (typeof document === 'undefined' || !document.getElementById('tab-videos')) { return; }
    var V = FoundryVideos, FILE = 'media/video.html';
    var $ = function (id) { return document.getElementById(id); };
    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) { n.className = cls; } if (text !== undefined) { n.textContent = text; } return n; }
    function say(msg, kind) {
        var s = $('status'); s.hidden = !msg; s.textContent = msg || ''; s.className = 'fstatus' + (kind ? ' is-' + kind : '');
        if (msg && s.scrollIntoView) { s.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    }
    function gh() {
        var cfg = { owner: 'laiho66', repo: 'va-comics.com-2.0', branch: 'main', token: '' };
        try { var s = JSON.parse(localStorage.getItem('foundry_v2_cfg')); if (s) { for (var k in cfg) { if (s[k]) { cfg[k] = s[k]; } } } } catch (e) { /* ignore */ }
        return cfg.token ? FoundryGH.make(cfg) : null;
    }
    function thumb(v) { return v.type === 'single' ? 'https://i.ytimg.com/vi/' + v.id + '/mqdefault.jpg' : ''; }
    function watch(v) { return v.type === 'single' ? 'https://www.youtube.com/watch?v=' + v.id : 'https://www.youtube.com/playlist?list=' + v.id; }

    var list = null, saved = '', editing = -1;
    function dirty() { return list && JSON.stringify(list) !== saved; }
    function markDirty() { $('vdDirty').hidden = !dirty(); $('vdSave').disabled = !dirty(); }

    function load() {
        var g = gh(); if (!g) { say('Connect first: Settings → paste the GitHub token.', 'err'); return; }
        var box = $('vdList'); box.innerHTML = ''; box.appendChild(el('p', 'hint', 'Loading...'));
        g.getFile(FILE).then(function (f) {
            list = V.parse(f.text); saved = JSON.stringify(list); editing = -1; render(); metas();
        }).catch(function (e) { box.innerHTML = ''; box.appendChild(el('p', 'hint', 'Could not load.')); say(e.message, 'err'); });
    }
    function metas() {
        var dl = $('vdMetas'); dl.innerHTML = '';
        var seen = {};
        ['PROTOCOL: TRACK_RELEASE // MELODIC_DEATH_METAL', 'PROTOCOL: DATA_UPDATE // LAUNCH_PROMO', 'PROTOCOL: OVERVIEW // SECURE_STREAM']
            .concat(list.map(function (v) { return v.meta; }))
            .forEach(function (m) { if (m && !seen[m]) { seen[m] = 1; var o = document.createElement('option'); o.value = m; dl.appendChild(o); } });
    }
    function render() {
        var box = $('vdList'); box.innerHTML = '';
        list.forEach(function (v, i) {
            var row = el('div', 'fitem vd-item');
            var pic = el('div', 'vd-thumb');
            if (thumb(v)) { var im = el('img'); im.src = thumb(v); im.alt = ''; im.loading = 'lazy'; pic.appendChild(im); } else { pic.textContent = 'PLAYLIST'; }
            var main = el('div', 'fitem-main');
            if (editing === i) {
                var t = el('input'); t.type = 'text'; t.maxLength = 120; t.value = v.title; t.className = 'vd-in';
                var m = el('input'); m.type = 'text'; m.maxLength = 120; m.value = v.meta; m.className = 'vd-in'; m.setAttribute('list', 'vdMetas');
                main.appendChild(t); main.appendChild(m);
                var acts = el('div', 'fitem-actions');
                var ok = el('button', 'btn btn--sm btn--primary', 'OK'); ok.type = 'button';
                ok.addEventListener('click', function () {
                    var nv = { type: v.type, id: v.id, title: t.value.trim(), meta: m.value.trim() };
                    try { V.check(nv); } catch (e) { say(e.message, 'err'); return; }
                    list[i] = nv; editing = -1; render(); markDirty(); say('', '');
                });
                var no = el('button', 'btn btn--sm', 'CANCEL'); no.type = 'button'; no.addEventListener('click', function () { editing = -1; render(); });
                acts.appendChild(ok); acts.appendChild(no);
                row.appendChild(pic); row.appendChild(main); row.appendChild(acts); box.appendChild(row); return;
            }
            main.appendChild(el('b', '', (i === 0 ? '▶ ' : '') + v.title));
            main.appendChild(el('span', 'meta', v.meta));
            var a = el('a', 'meta vd-link', (v.type === 'playlist' ? 'PLAYLIST ' : '') + v.id + ' ↗'); a.href = watch(v); a.target = '_blank'; a.rel = 'noopener noreferrer';
            main.appendChild(a);
            var acts2 = el('div', 'fitem-actions vd-acts');
            function btn(label, title, fn, dis, cls) { var b = el('button', 'btn btn--sm' + (cls ? ' ' + cls : ''), label); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title); b.disabled = !!dis; b.addEventListener('click', fn); acts2.appendChild(b); }
            btn('↑', 'Move up', function () { var x = list[i - 1]; list[i - 1] = list[i]; list[i] = x; render(); markDirty(); }, i === 0);
            btn('↓', 'Move down', function () { var x = list[i + 1]; list[i + 1] = list[i]; list[i] = x; render(); markDirty(); }, i === list.length - 1);
            btn('EDIT', 'Edit title and description', function () { editing = i; render(); });
            btn('REMOVE', 'Remove from the page', function () {
                if (list.length < 2) { say('The page needs at least one clip.', 'err'); return; }
                list.splice(i, 1); render(); markDirty(); say('Removed from the list. Press SAVE_TO_SITE to make it live (or RELOAD to undo).', 'info');
            }, false, 'btn--danger');
            row.appendChild(pic); row.appendChild(main); row.appendChild(acts2); box.appendChild(row);
        });
        markDirty();
    }

    /* new clip form */
    function preview() {
        var v = V.fromLink($('vdLink').value), p = $('vdPrev');
        p.innerHTML = '';
        if (!$('vdLink').value.trim()) { p.hidden = true; return null; }
        p.hidden = false;
        if (!v) { p.appendChild(el('span', 'hint', 'This is not a YouTube link I can read. Paste the link from the Share button or the address bar.')); return null; }
        if (v.type === 'single') { var im = el('img'); im.src = thumb(v); im.alt = 'Preview of the clip'; p.appendChild(im); }
        p.appendChild(el('span', 'meta', (v.type === 'playlist' ? 'PLAYLIST // ' : 'VIDEO // ') + v.id));
        var a = el('a', 'meta vd-link', 'Open on YouTube ↗'); a.href = watch(v); a.target = '_blank'; a.rel = 'noopener noreferrer'; p.appendChild(a);
        return v;
    }
    $('vdLink').addEventListener('input', preview);
    $('vdAdd').addEventListener('click', function () {
        if (!list) { say('Wait for the list to load (or press RELOAD).', 'err'); return; }
        var v = preview(); if (!v) { say('Paste a YouTube link first.', 'err'); return; }
        var nv = { type: v.type, id: v.id, title: $('vdTitle').value.trim(), meta: $('vdMeta').value.trim() };
        try { V.check(nv); } catch (e) { say(e.message, 'err'); return; }
        if (list.some(function (x) { return x.type === nv.type && x.id === nv.id; })) { say('This clip is already on the page.', 'err'); return; }
        list.unshift(nv); render();
        $('vdLink').value = ''; $('vdTitle').value = ''; $('vdMeta').value = ''; preview();
        say('Added at the top. Press SAVE_TO_SITE to make it live.', 'info');
    });
    $('vdSave').addEventListener('click', function () {
        var g = gh(); if (!g) { say('Connect first: Settings → paste the GitHub token.', 'err'); return; }
        var b = $('vdSave'), want = list.slice(); b.disabled = true; b.classList.add('is-busy'); say('Saving...', 'info');
        g.update(FILE, function (text) { return V.write(text, want); }, 'Foundry: update video list (' + want.length + ' clips)',
            function (o, n) { V.guard(o, n, want); })
            .then(function () { saved = JSON.stringify(want); markDirty(); say('Saved. The video page updates in about 1-2 minutes.', 'ok'); })
            .catch(function (e) { say(e.message, 'err'); markDirty(); })
            .then(function () { b.classList.remove('is-busy'); });
    });
    $('vdReload').addEventListener('click', function (e) {
        e.preventDefault();
        if (dirty() && !window.confirm('Drop the changes that are not saved yet?')) { return; }
        load();
    });
    window.addEventListener('beforeunload', function (e) { if (dirty()) { e.preventDefault(); e.returnValue = ''; } });
    $('tabs').addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (b && b.getAttribute('data-tab') === 'videos' && !list) { load(); }
    });
})();
