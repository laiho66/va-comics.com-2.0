/* VA COMICS // search.js  (v1, nov 2026)
   Site search. Loaded by site.js ONLY when someone opens the search (button SEARCH, or the "/" key).
   No server, no extra service: the first search reads the public pages below, builds a small index in the
   browser and keeps it for the visit (sessionStorage). Results link to the page; characters open their file.
   New page on the site? Add it to PAGES. Nothing else to maintain: News, characters and issues are read live. */
(function () {
    'use strict';
    if (window.VASearch) { return; }

    var PAGES = [
        '/index.html', '/start.html', '/projects.html', '/chronicles.html', '/about.html', '/qa.html', '/press.html', '/contact.html',
        '/deaddrop/index.html', '/deaddrop/vol1.html', '/deaddrop/vol2.html', '/deaddrop/characters.html',
        '/deaddrop/issue-1.html', '/deaddrop/issue-2.html', '/deaddrop/issue-3.html', '/deaddrop/issue-4.html', '/deaddrop/issue-5.html', '/deaddrop/issue-6.html', '/deaddrop/issue-7.html',
        '/deaddrop/issue-8.html', '/deaddrop/issue-9.html', '/deaddrop/issue-10.html', '/deaddrop/issue-11-1.html', '/deaddrop/issue-11-2.html', '/deaddrop/issue-12.html', '/deaddrop/issue-13.html',
        '/vanguard/index.html', '/vanguard/book1.html', '/vanguard/book2.html', '/vanguard/characters.html',
        '/media.html', '/media/viewer.html', '/media/video.html', '/media/reader.html', '/legal.html'
    ];
    var ADULT = ['/deaddrop', '/media/viewer', '/media/video'];
    var CACHE_KEY = 'va_search_v2';
    var MAX = 12;

    var index = null, building = null, ui = null, lastFocus = null;

    function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
    function fold(s) { return clean(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function pretty(u) { return u.replace(/\.html$/, '').replace(/\/index$/, '/'); }
    function isAdult(u) { return ADULT.some(function (a) { return u.indexOf(a) === 0; }); }

    /* ---------- index ---------- */
    function entriesFrom(url, html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var out = [];
        var title = clean((doc.querySelector('title') || {}).textContent).replace(/\s*\/\/\s*VA Comics.*$/i, '') || pretty(url);
        var desc = clean((doc.querySelector('meta[name="description"]') || { getAttribute: function () { return ''; } }).getAttribute('content'));
        var main = doc.querySelector('main') || doc.body;
        if (!main) { return out; }

        /* characters: one result per character, opens the file (#id) */
        Array.prototype.forEach.call(main.querySelectorAll('.char[id]'), function (c) {
            var bio = c.querySelector('.char-bio');
            out.push({ u: url + '#' + c.id, t: c.getAttribute('data-name') || c.id, k: (c.getAttribute('data-label') || '') + ' ' + (c.getAttribute('data-code') || ''),
                x: clean(bio ? bio.textContent : ''), p: title });
        });
        /* News: one result per post */
        Array.prototype.forEach.call(main.querySelectorAll('.chronicle-post[id]'), function (a) {
            var t = a.querySelector('.post-title');
            out.push({ u: url + '#' + a.id, t: clean(t ? t.textContent : 'News'), k: 'news', x: clean(a.textContent).slice(0, 1500), p: title });
        });
        /* issue / book cards: one result per card (links to the page) */
        Array.prototype.forEach.call(main.querySelectorAll('.card--static'), function (c) {
            var h = c.querySelector('h2, h3');
            if (h) { out.push({ u: url, t: clean(h.textContent), k: '', x: clean(c.textContent).slice(0, 800), p: title }); }
        });
        /* the page itself (text without the parts already indexed above) */
        var copy = main.cloneNode(true);
        Array.prototype.forEach.call(copy.querySelectorAll('.char, .chronicle-post, .card--static, script, style, nav'), function (n) {
            if (n.classList.contains('card--static') && !n.querySelector('h2, h3')) { return; }   /* a card without a title (issue pages) was not indexed above: its text stays in the page */
            n.remove();
        });
        Array.prototype.forEach.call(copy.querySelectorAll('*'), function (n) { n.appendChild(doc.createTextNode(' ')); });   /* "Characters" + "18+" -> "Characters 18+" */
        var heads = Array.prototype.map.call(copy.querySelectorAll('h1, h2, h3'), function (h) { return clean(h.textContent); }).join(' · ');
        out.push({ u: url, t: title, k: heads, x: clean(desc + ' ' + copy.textContent).slice(0, 4000), p: '' });
        return out;
    }

    function build() {
        if (index) { return Promise.resolve(index); }
        if (building) { return building; }
        try { var c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null'); if (c && c.length) { index = c; return Promise.resolve(index); } } catch (e) { /* ignore */ }
        building = Promise.all(PAGES.map(function (u) {
            return fetch(u, { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.text() : ''; })
                .then(function (h) { return h ? entriesFrom(u, h) : []; }, function () { return []; });
        })).then(function (lists) {
            index = [].concat.apply([], lists).map(function (e) { e.ft = fold(e.t); e.fk = fold(e.k); e.fx = fold(e.x); return e; });
            try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(index)); } catch (e) { /* too big or private mode: fine */ }
            building = null;
            return index;
        });
        return building;
    }

    /* ---------- search ---------- */
    function search(q) {
        var words = fold(q).split(/[^a-z0-9]+/).filter(function (w) { return w.length > 1; });
        if (!words.length || !index) { return []; }
        var res = [];
        index.forEach(function (e) {
            var s = 0;
            for (var i = 0; i < words.length; i++) {
                var w = words[i], hit = 0;
                if (e.ft.indexOf(w) > -1) { hit += e.ft.indexOf(w) === 0 ? 14 : 10; }
                if (e.fk.indexOf(w) > -1) { hit += 5; }
                if (e.fx.indexOf(w) > -1) { hit += 1 + Math.min(3, e.fx.split(w).length - 2); }
                if (!hit) { return; }           /* every word must be found somewhere */
                s += hit;
            }
            if (e.u.indexOf('#') > -1) { s += 2; }   /* a character / post beats the page that contains it */
            res.push({ e: e, s: s });
        });
        res.sort(function (a, b) { return b.s - a.s; });
        return res.slice(0, MAX).map(function (r) { return r.e; });
    }

    function snippet(e, q) {
        var w = fold(q).split(/[^a-z0-9]+/).filter(function (x) { return x.length > 1; })[0] || '';
        var text = e.x || e.k || '';
        var i = w ? fold(text).indexOf(w) : -1;
        var start = Math.max(0, i - 60);
        var s = (start > 0 ? '…' : '') + text.slice(start, start + 170) + (text.length > start + 170 ? '…' : '');
        var out = esc(s);
        fold(q).split(/[^a-z0-9]+/).filter(function (x) { return x.length > 1; }).forEach(function (x) {
            out = out.replace(new RegExp('(' + x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>');
        });
        return out;
    }

    /* ---------- UI ---------- */
    function makeUi() {
        var wrap = document.createElement('div');
        wrap.className = 'search-overlay'; wrap.hidden = true;
        wrap.innerHTML =
            '<div class="search-box" role="dialog" aria-modal="true" aria-label="Search the site">' +
            '<div class="search-head"><label for="vaSearchInput">SEARCH // VA_COMICS</label>' +
            '<button type="button" class="search-close" aria-label="Close search">X</button></div>' +
            '<input id="vaSearchInput" type="search" autocomplete="off" spellcheck="false" placeholder="Characters, issues, news…">' +
            '<p class="search-status" aria-live="polite"></p><ol class="search-results"></ol></div>';
        document.body.appendChild(wrap);
        var input = wrap.querySelector('input'), list = wrap.querySelector('.search-results'), status = wrap.querySelector('.search-status');
        var timer = null;

        function render() {
            var q = input.value;
            if (fold(q).replace(/[^a-z0-9]/g, '').length < 2) { list.innerHTML = ''; status.textContent = index ? '' : 'Type at least 2 letters.'; return; }
            if (!index) { status.textContent = 'Loading the archive…'; build().then(render); return; }
            var r = search(q);
            status.textContent = r.length ? r.length + (r.length === MAX ? '+' : '') + ' result' + (r.length === 1 ? '' : 's') : 'No results. Try a name, an issue title or a place.';
            list.innerHTML = r.map(function (e) {
                return '<li><a href="' + esc(e.u) + '"><span class="search-title">' + esc(e.t) + (isAdult(e.u) ? ' <span class="chip">18+</span>' : '') + '</span>' +
                    '<span class="search-where">' + esc(e.p ? e.p : pretty(e.u.split('#')[0])) + '</span>' +
                    '<span class="search-snip">' + snippet(e, q) + '</span></a></li>';
            }).join('');
        }
        input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(render, 120); });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { var a = list.querySelector('a'); if (a) { e.preventDefault(); a.click(); } }
            if (e.key === 'ArrowDown') { var f = list.querySelector('a'); if (f) { e.preventDefault(); f.focus(); } }
        });
        list.addEventListener('keydown', function (e) {
            var links = Array.prototype.slice.call(list.querySelectorAll('a')), i = links.indexOf(document.activeElement);
            if (e.key === 'ArrowDown' && i < links.length - 1) { e.preventDefault(); links[i + 1].focus(); }
            if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? links[i - 1] : input).focus(); }
        });
        /* a result on the SAME page (character file, news post): close and jump */
        list.addEventListener('click', function (e) {
            var a = e.target.closest('a'); if (!a) { return; }
            var u = new URL(a.href, location.href);
            if (u.pathname.replace(/\.html$/, '') === location.pathname.replace(/\.html$/, '') && u.hash) {
                e.preventDefault(); close(); location.hash = u.hash;
                var t = document.getElementById(u.hash.slice(1));
                if (t && t.classList.contains('char')) { t.click(); } else if (t) { t.scrollIntoView({ behavior: 'smooth' }); }
            }
        });
        wrap.addEventListener('click', function (e) { if (e.target === wrap) { close(); } });
        wrap.querySelector('.search-close').addEventListener('click', close);
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !wrap.hidden) { close(); } });
        return { wrap: wrap, input: input };
    }

    function open() {
        if (!ui) { ui = makeUi(); }
        lastFocus = document.activeElement;
        ui.wrap.hidden = false;
        document.body.classList.add('gate-open');
        ui.input.focus(); ui.input.select();
        build();                                  /* start reading the pages right away */
    }
    function close() {
        if (!ui) { return; }
        ui.wrap.hidden = true;
        document.body.classList.remove('gate-open');
        if (lastFocus && lastFocus.focus) { lastFocus.focus(); }
    }

    window.VASearch = { open: open, close: close };
})();
