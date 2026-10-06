/* VA COMICS // Foundry v2 // foundry.js  (the page logic) */
(function () {
    'use strict';
    var C = FoundryCore, G = FoundryGH;
    var LS = 'foundry_v2_cfg';
    var NEWS_FILE = 'chronicles.html', VIEWER_FILE = 'media/viewer.html';
    var cfg = loadCfg(), gh = null, editingId = null;

    var $ = function (id) { return document.getElementById(id); };
    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) { n.className = cls; } if (text !== undefined) { n.textContent = text; } return n; }

    /* ---------- settings storage ---------- */
    function loadCfg() {
        var d = { owner: 'laiho66', repo: 'va-comics.com-2.0', branch: 'main', token: '' };
        try { var s = JSON.parse(localStorage.getItem(LS)); if (s) { for (var k in d) { if (s[k]) { d[k] = s[k]; } } } } catch (e) { /* ignore */ }
        return d;
    }
    function saveCfg() { try { localStorage.setItem(LS, JSON.stringify(cfg)); } catch (e) { /* ignore */ } }
    function connect() { gh = cfg.token ? G.make(cfg) : null; return gh; }

    /* ---------- status line ---------- */
    var statusEl = $('status');
    function say(msg, kind) {
        statusEl.hidden = !msg; statusEl.textContent = msg || '';
        statusEl.className = 'fstatus' + (kind ? ' is-' + kind : '');
        if (msg && statusEl.scrollIntoView) { statusEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    }
    function conn(text, ok) { var c = $('connState'); c.textContent = text; c.className = 'chip' + (ok ? ' chip--active' : ''); }
    function busy(btn, on) { if (btn) { btn.classList.toggle('is-busy', on); btn.disabled = on; } }
    function needGh() { if (!gh) { say('Connect first: Settings → paste the GitHub token.', 'err'); show('settings'); return false; } return true; }
    function fail(e) { say(e && e.message ? e.message : String(e), 'err'); }

    /* ---------- tabs ---------- */
    function show(name) {
        ['news', 'issues', 'settings'].forEach(function (t) { $('tab-' + t).hidden = t !== name; });
        Array.prototype.forEach.call($('tabs').querySelectorAll('button'), function (b) { b.classList.toggle('chip--active', b.getAttribute('data-tab') === name); });
    }
    $('tabs').addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) { return; }
        show(b.getAttribute('data-tab'));
        if (b.getAttribute('data-tab') === 'issues' && gh && !$('issueList').getAttribute('data-loaded')) { loadIssues(); }
    });

    /* ======================== SETTINGS ======================== */
    function fillSettings() { $('sOwner').value = cfg.owner; $('sRepo').value = cfg.repo; $('sBranch').value = cfg.branch; $('sToken').value = cfg.token; }
    function testConnection(silent) {
        if (!connect()) { conn('NOT CONNECTED', false); return Promise.resolve(false); }
        conn('CHECKING...', false);
        return gh.whoami().then(function (u) {
            return gh.repoInfo().then(function (r) {
                var canWrite = !r.permissions || r.permissions.push;
                if (!canWrite) { conn('READ ONLY', false); say('The token can read the repository but not write. Make it with "Contents: Read and write".', 'err'); return false; }
                conn('CONNECTED: ' + u.login, true);
                if (!silent) { say('Connected as ' + u.login + ' to ' + cfg.owner + '/' + cfg.repo + ' (branch ' + cfg.branch + ').', 'ok'); }
                return true;
            });
        }).catch(function (e) { conn('NOT CONNECTED', false); fail(e); return false; });
    }
    $('btnSave').addEventListener('click', function () {
        cfg.owner = $('sOwner').value.trim(); cfg.repo = $('sRepo').value.trim(); cfg.branch = $('sBranch').value.trim() || 'main'; cfg.token = $('sToken').value.trim();
        if (!cfg.owner || !cfg.repo || !cfg.token) { say('Owner, repository and token are required.', 'err'); return; }
        if (!/-2\.0$/.test(cfg.repo) && !confirm('The repository name does not end with "-2.0" (the one connected to Cloudflare). Continue anyway?')) { return; }
        saveCfg();
        var b = $('btnSave'); busy(b, true);
        testConnection(false).then(function (ok) { busy(b, false); if (ok) { show('news'); loadNews(); } });
    });
    $('btnForget').addEventListener('click', function () {
        cfg.token = ''; saveCfg(); gh = null; $('sToken').value = ''; conn('NOT CONNECTED', false); say('The token was removed from this browser.', 'info');
    });

    /* ======================== NEWS ======================== */
    function formPost() {
        return { title: $('fTitle').value.trim(), author: $('fAuthor').value.trim() || 'Aris', badge: $('fBadge').value.trim() || 'TRANSMISSION // DEADDROP BUNKER',
                 date: $('fDate').value || C.today(), body: $('fBody').value };
    }
    function checkPost(p) {
        if (!p.title) { return 'The title is empty.'; }
        if (!p.body.trim()) { return 'The text is empty.'; }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date)) { return 'The date is not valid.'; }
        return '';
    }
    function resetForm() {
        editingId = null;
        $('fTitle').value = ''; $('fBody').value = ''; $('fDate').value = C.today(); $('fAuthor').value = 'Aris';
        $('fBadge').value = 'TRANSMISSION // DEADDROP BUNKER';
        $('formPanel').setAttribute('data-label', 'NEW_TRANSMISSION // NEWS_POST');
        $('btnPublish').textContent = 'PUBLISH'; $('btnCancel').hidden = true; $('previewBox').hidden = true;
    }
    function loadNews() {
        if (!needGh()) { return; }
        var box = $('postList'); box.innerHTML = ''; box.appendChild(el('p', 'hint', 'Loading...'));
        gh.getFile(NEWS_FILE).then(function (f) {
            var posts = C.listPosts(f.text); box.innerHTML = '';
            if (!posts.length) { box.appendChild(el('p', 'hint', 'No posts yet.')); return; }
            posts.forEach(function (p) {
                var row = el('div', 'fitem'), main = el('div', 'fitem-main'), act = el('div', 'fitem-actions');
                main.appendChild(el('b', '', p.title)); main.appendChild(el('span', 'meta', p.date + '  //  ' + p.author));
                var be = el('button', 'btn btn--sm', 'EDIT'); be.type = 'button'; be.addEventListener('click', function () { startEdit(p); });
                var bd = el('button', 'btn btn--sm btn--danger', 'DELETE'); bd.type = 'button'; bd.addEventListener('click', function () { removePost(p, bd); });
                act.appendChild(be); act.appendChild(bd); row.appendChild(main); row.appendChild(act); box.appendChild(row);
            });
        }).catch(function (e) { box.innerHTML = ''; fail(e); });
    }
    function startEdit(p) {
        editingId = p.id;
        $('fTitle').value = p.title; $('fAuthor').value = p.author; $('fBadge').value = p.badge; $('fDate').value = p.date; $('fBody').value = p.body;
        $('formPanel').setAttribute('data-label', 'EDIT_TRANSMISSION // ' + p.id); $('btnPublish').textContent = 'SAVE_CHANGES'; $('btnCancel').hidden = false;
        $('formPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
        say('Editing "' + p.title + '". Change it and press SAVE_CHANGES, or CANCEL_EDIT.', 'info');
    }
    $('btnCancel').addEventListener('click', function () { resetForm(); say('', ''); });
    $('btnPreview').addEventListener('click', function () {
        var p = formPost(), err = checkPost(p); if (err) { say(err, 'err'); return; }
        $('preview').innerHTML = C.buildPost(p); $('previewBox').hidden = false; $('previewBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('btnPublish').addEventListener('click', function () {
        if (!needGh()) { return; }
        var p = formPost(), err = checkPost(p); if (err) { say(err, 'err'); return; }
        var editing = editingId;
        if (!confirm((editing ? 'Save the changes to' : 'Publish') + ' "' + p.title + '" on the live site?')) { return; }
        var b = $('btnPublish'); busy(b, true); say('Working...', 'info');
        gh.update(NEWS_FILE, function (text) { return editing ? C.replacePost(text, editing, p) : C.insertPost(text, p); },
            'Foundry: ' + (editing ? 'edit post - ' : 'new post - ') + p.title, C.guardNews)
            .then(function () {
                say((editing ? 'Saved.' : 'Published.') + ' It is live in about 1-2 minutes at https://va-comics.com/chronicles', 'ok');
                resetForm(); loadNews();
            }).catch(fail).then(function () { busy(b, false); });
    });
    function removePost(p, btn) {
        if (!needGh()) { return; }
        if (!confirm('Delete "' + p.title + '" from the live site? (It stays in the GitHub history.)')) { return; }
        busy(btn, true); say('Working...', 'info');
        gh.update(NEWS_FILE, function (text) { return C.deletePost(text, p.id); }, 'Foundry: delete post - ' + p.title, C.guardNews)
            .then(function () { say('Deleted. The site updates in about 1-2 minutes.', 'ok'); if (editingId === p.id) { resetForm(); } loadNews(); })
            .catch(fail).then(function () { busy(btn, false); });
    }
    $('reloadNews').addEventListener('click', function (e) { e.preventDefault(); loadNews(); });

    /* ======================== ISSUES ======================== */
    function loadIssues() {
        if (!needGh()) { return; }
        var box = $('issueList'); box.innerHTML = ''; box.appendChild(el('p', 'hint', 'Loading...'));
        gh.getFile(VIEWER_FILE).then(function (f) {
            var list = C.parseIssues(f.text); box.innerHTML = ''; box.setAttribute('data-loaded', '1');
            list.forEach(function (it) {
                var row = el('div', 'fitem'), main = el('div', 'fitem-main');
                main.appendChild(el('b', '', it.badge + '  //  ' + it.title)); main.appendChild(el('span', 'meta', 'key ' + it.key + '  //  folder ' + it.folder + '  //  ' + it.pages + ' pages'));
                row.appendChild(main); box.appendChild(row);
            });
            if (!$('iKey').value) { suggestNext(list); }
        }).catch(function (e) { box.innerHTML = ''; fail(e); });
    }
    function suggestNext(list) {
        var max = 0; list.forEach(function (it) { var n = parseInt(it.key, 10); if (n > max) { max = n; } });
        $('iKey').value = String(max + 1); autoFill();
    }
    function autoFill() {
        var k = $('iKey').value.trim(); if (!k) { return; }
        $('iBadge').value = C.suggestBadge(k); $('iFolder').value = C.suggestFolder(k);
    }
    $('iKey').addEventListener('input', autoFill);
    $('reloadIssues').addEventListener('click', function (e) { e.preventDefault(); loadIssues(); });
    function readB64(file) {
        return new Promise(function (res, rej) {
            var r = new FileReader();
            r.onload = function () { res(String(r.result).split(',')[1]); };
            r.onerror = function () { rej(new Error('Could not read the cover file.')); };
            r.readAsDataURL(file);
        });
    }
    $('btnAddIssue').addEventListener('click', function () {
        if (!needGh()) { return; }
        var it = { key: $('iKey').value.trim(), title: $('iTitle').value.trim(), badge: $('iBadge').value.trim(), folder: $('iFolder').value.trim(), pages: parseInt($('iPages').value, 10) };
        if (!it.key || !it.title || !it.badge || !it.folder || !(it.pages > 0)) { say('Fill in the key, title, badge, folder and number of pages.', 'err'); return; }
        var cover = $('iCover').files[0];
        if (cover && !/\.webp$/i.test(cover.name)) { say('The cover must be a .webp file.', 'err'); return; }
        if (cover && cover.size > 600 * 1024) { say('The cover is too big (' + Math.round(cover.size / 1024) + ' KB). Keep it under 600 KB.', 'err'); return; }
        if (!confirm('Add ' + it.badge + ' (' + it.pages + ' pages, folder "' + it.folder + '") to the live reader?\n\nMake sure the pages are already in R2.')) { return; }
        var b = $('btnAddIssue'); busy(b, true); say('Working...', 'info');
        var step = cover
            ? readB64(cover).then(function (b64) { return gh.putBinary('deaddrop/assets/' + C.coverFile(it.key) + '.webp', b64, 'Foundry: cover for issue ' + it.key); })
            : Promise.resolve();
        step.then(function () { return gh.update(VIEWER_FILE, function (t) { return C.addIssue(t, it); }, 'Foundry: add issue ' + it.key + ' - ' + it.title, C.guardViewer); })
            .then(function () {
                say('Issue ' + it.key + ' added. The reader shows it in about 1-2 minutes.' + (cover ? '' : ' (No cover yet: add deaddrop/assets/' + C.coverFile(it.key) + '.webp.)'), 'ok');
                $('iTitle').value = ''; $('iPages').value = ''; $('iCover').value = ''; $('iKey').value = ''; loadIssues();
            }).catch(fail).then(function () { busy(b, false); });
    });

    /* ---------- start ---------- */
    $('fDate').value = C.today();
    fillSettings();
    if (cfg.token) { testConnection(true).then(function (ok) { if (ok) { loadNews(); } }); } else { show('settings'); say('Welcome. Connect first: follow the steps below and paste the GitHub token.', 'info'); }
})();
