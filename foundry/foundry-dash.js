/* VA COMICS // Foundry v2 // foundry-dash.js
   DASHBOARD tab (the first thing Foundry shows): what needs you and what moved lately.
   Reads only what Foundry can already read: the board (comments + Q&A), the Reading Room codes,
   the last changes on GitHub and the date your GitHub token expires. Nothing is written from here. */
(function () {
    'use strict';
    if (typeof document === 'undefined' || !document.getElementById('tab-dash')) { return; }
    var $ = function (id) { return document.getElementById(id); };
    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) { n.className = cls; } if (text !== undefined) { n.textContent = text; } return n; }
    var onSite = /(^|\.)va-comics\.com$/.test(location.hostname);
    var DAY = 86400, EXP_KEY = 'foundry_token_expires';

    function cfg() {
        var c = { owner: 'laiho66', repo: 'va-comics.com-2.0', branch: 'main', token: '' };
        try { var s = JSON.parse(localStorage.getItem('foundry_v2_cfg')); if (s) { for (var k in c) { if (s[k]) { c[k] = s[k]; } } } } catch (e) { /* ignore */ }
        return c;
    }
    function getJSON(url, opts) {
        opts = opts || {}; opts.cache = 'no-store'; opts.credentials = 'same-origin';
        return fetch(url, opts).then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (j) {
                if (!r.ok) { var e = new Error(r.status === 401 || r.status === 403 ? 'Not logged in for the admin part: reload the page.' : (j.message || 'Error ' + r.status)); e.status = r.status; throw e; }
                return { j: j, r: r };
            });
        });
    }
    function ago(sec) {
        var d = Math.floor(Date.now() / 1000) - sec;
        if (d < 3600) { return Math.max(1, Math.round(d / 60)) + ' min ago'; }
        if (d < DAY) { return Math.round(d / 3600) + ' h ago'; }
        if (d < 30 * DAY) { return Math.round(d / DAY) + ' days ago'; }
        return new Date(sec * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    function day(sec) { return new Date(sec * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
    function place(t) {
        if (t === 'qa') { return 'Q&A'; }
        var m = /^issue:(\d+)(?:_(\d+))?$/.exec(t);
        if (m) { return 'Dead Drop #' + (m[1].length < 2 ? '0' + m[1] : m[1]) + (m[2] ? ' Part ' + m[2] : ''); }
        m = /^book:(.+)$/.exec(t);
        return m ? 'Vanguard: ' + m[1].replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }) : t;
    }
    function goTab(name) { var b = document.querySelector('#tabs [data-tab="' + name + '"]'); if (b) { b.click(); } }
    function stat(n, label, kind) { var d = el('div', 'dash-stat' + (kind ? ' is-' + kind : '')); d.appendChild(el('b', '', String(n))); d.appendChild(el('span', 'meta', label)); return d; }
    function line(box, text, cls) { box.appendChild(el('p', cls || 'dash-line', text)); }
    function clear(id) { var b = $(id); b.innerHTML = ''; return b; }
    function offSite(id) { line(clear(id), 'Works only on va-comics.com/foundry (it needs your Cloudflare Access login).', 'hint'); }

    /* ---------------- BOARD ---------------- */
    function board() {
        if (!onSite) { offSite('dbBoard'); return; }
        var box = clear('dbBoard'); line(box, 'Loading...', 'hint');
        getJSON('/foundry/api/board/messages?status=all').then(function (x) {
            var all = (x.j.messages || []).filter(function (m) { return !m.staff; }), now = Math.floor(Date.now() / 1000);
            var pending = all.filter(function (m) { return m.status === 'pending'; });
            var week = all.filter(function (m) { return m.created > now - 7 * DAY; });
            box = clear('dbBoard');
            var row = el('div', 'dash-stats');
            row.appendChild(stat(pending.length, 'waiting for you', pending.length ? 'hot' : ''));
            row.appendChild(stat(week.length, 'new in 7 days'));
            row.appendChild(stat(all.filter(function (m) { return m.status === 'approved'; }).length, 'published in total'));
            box.appendChild(row);
            if (week.length) {
                var by = {}; week.forEach(function (m) { by[place(m.target)] = (by[place(m.target)] || 0) + 1; });
                line(box, 'This week: ' + Object.keys(by).map(function (k) { return k + ' (' + by[k] + ')'; }).join(', ') + '.');
            }
            var latest = all.slice().sort(function (a, b) { return b.created - a.created; }).slice(0, 3);
            if (latest.length) {
                var ul = el('ul', 'dash-list');
                latest.forEach(function (m) {
                    var li = el('li'); li.appendChild(el('b', '', m.nick));
                    li.appendChild(document.createTextNode(' · ' + place(m.target) + ' · ' + ago(m.created) + (m.status !== 'approved' ? ' · ' + m.status.toUpperCase() : '')));
                    li.appendChild(el('span', 'dash-quote', String(m.body).slice(0, 140) + (String(m.body).length > 140 ? '…' : '')));
                    ul.appendChild(li);
                });
                box.appendChild(ul);
            } else { line(box, 'No messages from readers yet.', 'hint'); }
            var go = el('button', 'btn btn--sm' + (pending.length ? ' btn--primary' : ''), pending.length ? 'OPEN_BOARD (' + pending.length + ' waiting)' : 'OPEN_BOARD');
            go.type = 'button'; go.addEventListener('click', function () { goTab('board'); }); box.appendChild(go);
            var badge = $('dashBadge'); if (badge) { badge.hidden = !pending.length; badge.textContent = pending.length; }
        }).catch(function (e) { line(clear('dbBoard'), e.message, 'hint'); });
    }

    /* ---------------- READING ROOM ---------------- */
    function reader() {
        if (!onSite) { offSite('dbReader'); return; }
        var box = clear('dbReader'); line(box, 'Loading...', 'hint');
        Promise.all([getJSON('/foundry/api/reader/codes'), getJSON('/foundry/api/reader/library')]).then(function (x) {
            var now = x[0].j.now || Math.floor(Date.now() / 1000), codes = x[0].j.codes || [], books = x[1].j.books || [];
            var name = {}; books.forEach(function (b) { name[b.id] = b.title; });
            var active = codes.filter(function (c) { return !c.revoked && c.expires > now; });
            var soon = active.filter(function (c) { return c.expires - now < 3 * DAY; });
            box = clear('dbReader');
            var row = el('div', 'dash-stats');
            row.appendChild(stat(active.length, 'active codes'));
            row.appendChild(stat(soon.length, 'end in 3 days', soon.length ? 'warn' : ''));
            row.appendChild(stat(active.filter(function (c) { return c.lastUsed && c.lastUsed > now - 7 * DAY; }).length, 'read in 7 days'));
            box.appendChild(row);
            var per = {}; active.forEach(function (c) { (c.books || [c.book]).forEach(function (b) { var k = b === '*' ? 'All books' : (name[b] || b); per[k] = (per[k] || 0) + 1; }); });
            if (Object.keys(per).length) { line(box, 'Active codes per book: ' + Object.keys(per).map(function (k) { return k + ' (' + per[k] + ')'; }).join(', ') + '.'); }
            line(box, 'Books: ' + books.map(function (b) { return b.title + (b.visible ? '' : ' (hidden)') + (b.ready ? '' : ' (FOLDER MISSING)'); }).join(', ') + '.');
            var recent = active.filter(function (c) { return c.lastUsed; }).sort(function (a, b) { return b.lastUsed - a.lastUsed; }).slice(0, 3);
            var ul = el('ul', 'dash-list');
            recent.forEach(function (c) { var li = el('li'); li.appendChild(el('b', '', c.label)); li.appendChild(document.createTextNode(' · last opened ' + ago(c.lastUsed) + ' · devices ' + (c.devices || 0) + '/2')); ul.appendChild(li); });
            soon.forEach(function (c) { var li = el('li', 'is-warn'); li.appendChild(el('b', '', c.label)); li.appendChild(document.createTextNode(' · code ends ' + day(c.expires))); ul.appendChild(li); });
            if (ul.children.length) { box.appendChild(ul); }
            var go = el('button', 'btn btn--sm', 'OPEN_READER_CODES'); go.type = 'button'; go.addEventListener('click', function () { goTab('codes'); }); box.appendChild(go);
        }).catch(function (e) { line(clear('dbReader'), e.message, 'hint'); });
    }

    /* ---------------- SITE (GitHub) + TOKEN ---------------- */
    function site() {
        var c = cfg(), box = clear('dbSite');
        if (!c.token) { line(box, 'Connect GitHub in Settings to see the last changes.', 'hint'); token(null); return; }
        line(box, 'Loading...', 'hint');
        getJSON('https://api.github.com/repos/' + c.owner + '/' + c.repo + '/commits?per_page=5&sha=' + encodeURIComponent(c.branch),
            { headers: { 'Authorization': 'Bearer ' + c.token, 'Accept': 'application/vnd.github+json' }, credentials: 'omit' }).then(function (x) {
            box = clear('dbSite');
            var ul = el('ul', 'dash-list');
            (x.j || []).forEach(function (cm) {
                var msg = String(cm.commit && cm.commit.message || '').split('\n')[0], when = Date.parse(cm.commit && cm.commit.author && cm.commit.author.date || '') / 1000;
                var li = el('li'), a = el('a', '', msg); a.href = cm.html_url; a.target = '_blank'; a.rel = 'noopener noreferrer';
                li.appendChild(a); li.appendChild(document.createTextNode(' · ' + (isNaN(when) ? '' : ago(when)) + (/^Foundry:/.test(msg) ? ' · from Foundry' : '')));
                ul.appendChild(li);
            });
            box.appendChild(ul);
            line(box, 'Each change is live on va-comics.com about 1-2 minutes after it appears here.', 'hint');
            token(x.r.headers.get('github-authentication-token-expiration'));
        }).catch(function (e) { line(clear('dbSite'), e.message, 'hint'); token(null); });
    }
    function token(header) {
        var box = clear('dbToken'), stored = '';
        try { stored = localStorage.getItem(EXP_KEY) || ''; } catch (e) { /* ignore */ }
        var t = header ? Date.parse(header.replace(' UTC', 'Z').replace(' ', 'T')) : (stored ? Date.parse(stored + 'T12:00:00') : NaN);
        if (header && !isNaN(t)) { try { localStorage.setItem(EXP_KEY, new Date(t).toISOString().slice(0, 10)); } catch (e) { /* ignore */ } }
        if (!isNaN(t)) {
            var left = Math.ceil((t - Date.now()) / 86400000);
            var kind = left <= 0 ? 'err' : left <= 14 ? 'warn' : 'ok';
            box.appendChild(el('p', 'dash-line is-' + kind, left <= 0 ? 'The GitHub token has EXPIRED: make a new one (Settings → steps).' :
                'GitHub token: ' + left + ' day' + (left === 1 ? '' : 's') + ' left (until ' + new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + ').' + (left <= 14 ? ' Make a new one soon (Settings → steps).' : '')));
        } else {
            line(box, 'GitHub did not say when the token expires. Type the date from GitHub (Settings → Developer settings → Fine-grained tokens):', 'hint');
        }
        var f = el('div', 'row dash-tokrow'), inp = el('input'); inp.type = 'date'; inp.value = stored; inp.className = 'dash-date'; inp.setAttribute('aria-label', 'Token expiry date');
        var b = el('button', 'btn btn--sm', 'SET_DATE'); b.type = 'button';
        b.addEventListener('click', function () { try { if (inp.value) { localStorage.setItem(EXP_KEY, inp.value); } else { localStorage.removeItem(EXP_KEY); } } catch (e) { /* ignore */ } token(null); });
        if (!header) { f.appendChild(inp); f.appendChild(b); box.appendChild(f); }
    }

    function all() { board(); reader(); site(); }
    $('dashReload').addEventListener('click', function (e) { e.preventDefault(); all(); });
    $('tabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b && b.getAttribute('data-tab') === 'dash') { all(); } });
    all();
})();
