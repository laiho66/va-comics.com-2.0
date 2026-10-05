/* ==========================================================================
   VA COMICS // reader.js
   The Dead Drop reader: library (covers + progress) and the full-screen reader.
   It reads the issue list from COMICS_DATABASE (defined in media/viewer.html,
   the block Foundry updates). Nothing in this file needs editing for a new issue.
   Address examples:  /media/viewer.html   /media/viewer.html?issue=13&page=5
   ========================================================================== */
(function () {
    'use strict';
    if (typeof COMICS_DATABASE === 'undefined') { return; }

    /* ---------- EDIT ZONE ---------- */
    /* Clean titles for the library (the database titles are old). A new issue that is not
       listed here simply uses the title from the database. */
    var ISSUE_NAMES = {
        '1': 'Terminal Velocity', '2': 'The Ghost Mark', '3': 'The Gossamer Shadow', '4': 'The Chimera Project',
        '5': 'Ghost in the Machine', '6': 'Terminal Protocol Part I', '7': 'Terminal Protocol Part II',
        '8': 'Terminal Protocol Part III', '9': 'Zero Collateral', '10': "The Devil's Pact",
        '11_1': 'The New Order Part 1', '11_2': 'The New Order Part 2', '12': 'The Game', '13': 'Open Season'
    };
    /* Volumes: "max" = the last issue number that belongs to the volume. "page" = where to buy. */
    var VOLUMES = [
        { title: 'VOLUME 1 // ISSUES 1-8', max: 8, page: '/deaddrop/vol1.html' },
        { title: 'VOLUME 2 // ISSUES 9-13', max: 13, page: '/deaddrop/vol2.html' }
    ];
    var OTHER_VOLUME = { title: 'NEW ISSUES', page: '/deaddrop/index.html' };   /* issues past the last volume */
    var STORE = 'vc_reader_v1';
    var IDLE_MS = 3000;
    /* -------------------------------- */

    var $ = function (id) { return document.getElementById(id); };
    var library = $('library'), reader = $('reader');
    if (!library || !reader) { return; }

    /* ---------- helpers ---------- */
    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) { n.className = cls; } if (text !== undefined) { n.textContent = text; } return n; }
    function num(k) { return parseInt(String(k).split('_')[0], 10) || 0; }
    function part(k) { return parseInt(String(k).split('_')[1], 10) || 0; }
    function sortedKeys() {
        return Object.keys(COMICS_DATABASE).sort(function (a, b) { return (num(a) - num(b)) || (part(a) - part(b)); });
    }
    function label(k) {
        var n = String(num(k)); if (n.length < 2) { n = '0' + n; }
        return 'ISSUE #' + n + (part(k) ? ' // PART ' + part(k) : '');
    }
    function shortLabel(k) { return '#' + (num(k) < 10 ? '0' : '') + num(k) + (part(k) ? ' PT ' + part(k) : ''); }
    function titleOf(k) { return ISSUE_NAMES[k] || (COMICS_DATABASE[k] && COMICS_DATABASE[k].title) || ''; }
    function pagesOf(k) { return COMICS_DATABASE[k].pages; }
    function coverSrc(k) {
        var f = k === '11_1' ? 'cover11p1' : k === '11_2' ? 'cover11p2' : 'cover' + k;
        return '/deaddrop/assets/' + f + '.webp';
    }
    function volumeOf(k) {
        for (var i = 0; i < VOLUMES.length; i++) { if (num(k) <= VOLUMES[i].max) { return VOLUMES[i]; } }
        return OTHER_VOLUME;
    }

    /* ---------- progress (stays in this browser only) ---------- */
    function load() { try { return JSON.parse(localStorage.getItem(STORE)) || { last: null, p: {} }; } catch (e) { return { last: null, p: {} }; } }
    function save(s) { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) { /* ignore */ } }
    var store = load();
    function remember(k, page) {
        store.last = k; store.p[k] = { page: page, total: pagesOf(k).length }; save(store);
    }

    /* ======================== LIBRARY ======================== */
    function renderLibrary() {
        var keys = sortedKeys();

        /* continue reading */
        var resume = $('resume'); resume.innerHTML = '';
        var last = store.last, lp = last && store.p[last];
        if (last && COMICS_DATABASE[last] && lp && lp.page > 0) {
            var pct = Math.round(Math.min(lp.page, lp.total) / lp.total * 100);
            var box = el('section', 'card card--row card--static card--band');
            box.style.borderLeft = '3px solid var(--accent)';
            box.innerHTML =
                '<div class="media ratio-2x3" style="flex: 0 0 78px; min-height: 104px;"><div class="ph"></div><img alt="" src="' + coverSrc(last) + '" onerror="this.remove()"></div>' +
                '<div class="card-body" style="flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: flex-start; gap: 18px; padding: 18px 22px;">' +
                '<div class="stack-sm" style="flex: 1 1 240px; min-width: 0;"><span class="tag">CONTINUE_READING</span>' +
                '<span class="h3"></span><div class="progress"><i style="width: ' + pct + '%"></i></div></div>' +
                '<a class="btn btn--primary" href="?issue=' + last + '&page=' + lp.page + '">CONTINUE</a></div>';
            box.querySelector('.h3').textContent = label(last).replace('ISSUE ', 'Issue ') + ' // Page ' + lp.page + ' / ' + lp.total;
            box.querySelector('a').addEventListener('click', function (e) { e.preventDefault(); openReader(last, lp.page, true); });
            resume.appendChild(box);
        }

        /* volumes */
        var host = $('volumes'); host.innerHTML = '';
        var groups = [];
        keys.forEach(function (k) {
            var v = volumeOf(k), g = null;
            for (var i = 0; i < groups.length; i++) { if (groups[i].v === v) { g = groups[i]; break; } }
            if (!g) { g = { v: v, keys: [] }; groups.push(g); }
            g.keys.push(k);
        });
        groups.forEach(function (g) {
            var sec = el('section', 'stack');
            var h = el('h2', 'section-label'); h.appendChild(el('span', '', g.v.title));
            var buy = el('a', '', '[ GET IT ON AMAZON ]'); buy.href = g.v.page; h.appendChild(buy);
            sec.appendChild(h);
            var grid = el('div', 'grid grid-5');
            g.keys.forEach(function (k) {
                var a = el('a', 'card lib-card'); a.href = '?issue=' + k;
                var p = store.p[k], status = 'NEW', bar = '';
                if (p && p.page >= p.total && p.total) { status = '✓ READ'; }
                else if (p && p.page > 1) { var pc = Math.round(p.page / p.total * 100); status = pc + '%'; bar = '<div class="progress"><i style="width:' + pc + '%"></i></div>'; }
                a.innerHTML = '<div class="media ratio-2x3"><div class="ph">[ COVER ]</div><img class="fade" loading="lazy" alt="" src="' + coverSrc(k) + '" onerror="this.remove()"></div>' + bar +
                    '<div class="card-body lib-meta"><b></b><span class="meta"></span></div>';
                a.querySelector('img').alt = label(k) + ': ' + titleOf(k);
                a.querySelector('b').textContent = shortLabel(k);
                a.querySelector('.meta').textContent = status;
                a.title = titleOf(k);
                a.addEventListener('click', function (e) { e.preventDefault(); openReader(k, (p && p.page < p.total) ? p.page : 1, true); });
                grid.appendChild(a);
            });
            sec.appendChild(grid); host.appendChild(sec);
        });

        /* fade-in for the images just created */
        Array.prototype.forEach.call(host.querySelectorAll('img.fade'), function (im) {
            if (im.complete && im.naturalWidth) { im.classList.add('is-loaded'); return; }
            im.addEventListener('load', function () { im.classList.add('is-loaded'); });
            im.addEventListener('error', function () { im.classList.add('is-loaded'); });
        });
    }

    /* ======================== READER ======================== */
    var rImg = $('rImg'), rBox = $('rPageBox'), rRange = $('rRange'), rCount = $('rCount'), rTitle = $('rTitle'),
        rIssue = $('rIssue'), rMapPanel = $('rMapPanel'), rThumbs = $('rThumbs'), rEnd = $('rEnd'), rLoading = $('rLoading');
    var cur = { k: null, p: 1 }, idleTimer = null, isOpen = false;

    function buildIssueSelect() {
        rIssue.innerHTML = '';
        sortedKeys().forEach(function (k) {
            var o = document.createElement('option'); o.value = k; o.textContent = label(k) + ' // ' + titleOf(k); rIssue.appendChild(o);
        });
    }

    function wake() {
        reader.classList.remove('is-idle');
        clearTimeout(idleTimer);
        if (isOpen && rMapPanel.hidden && rEnd.hidden) {
            idleTimer = setTimeout(function () { reader.classList.add('is-idle'); }, IDLE_MS);
        }
    }

    function setUrl(replace) {
        var u = location.pathname + '?issue=' + cur.k + '&page=' + cur.p;
        try {
            if (replace) { history.replaceState(history.state, '', u); }
            else { history.pushState({ reader: 1 }, '', u); }
        } catch (e) { /* ignore */ }
    }

    function show(p, replace) {
        var pages = pagesOf(cur.k);
        cur.p = Math.max(1, Math.min(pages.length, p));
        rLoading.hidden = false;
        rImg.onload = function () { rLoading.hidden = true; };
        rImg.onerror = function () { rLoading.hidden = true; };
        rImg.alt = label(cur.k) + ', page ' + cur.p;
        rImg.src = pages[cur.p - 1];
        rBox.scrollTop = 0; rBox.scrollLeft = 0;
        rRange.max = pages.length; rRange.value = cur.p;
        var fill = pages.length > 1 ? (cur.p - 1) / (pages.length - 1) * 100 : 100;
        rRange.style.setProperty('--fill', fill + '%');
        rCount.textContent = cur.p + ' / ' + pages.length;
        remember(cur.k, cur.p);
        setUrl(replace !== false);
        /* preload the next two pages */
        [cur.p, cur.p + 1].forEach(function (i) { if (i < pages.length) { var im = new Image(); im.src = pages[i]; } });
        markThumb();
    }

    function openReader(k, p, push) {
        if (!COMICS_DATABASE[k]) { k = sortedKeys()[0]; p = 1; }
        var changed = cur.k !== k;
        cur.k = k;
        rTitle.innerHTML = 'DEAD DROP // <b></b> // <span></span>';
        rTitle.querySelector('b').textContent = label(k);
        rTitle.querySelector('span').textContent = titleOf(k);
        rIssue.value = k;
        if (changed) { rThumbs.innerHTML = ''; rThumbs.removeAttribute('data-k'); }
        reader.hidden = false; isOpen = true;
        document.body.classList.add('reader-open');
        rEnd.hidden = true; rMapPanel.hidden = true; reader.classList.remove('is-zoomed');
        cur.p = p || 1;
        var pages = pagesOf(k).length; if (cur.p > pages) { cur.p = pages; }
        /* push a history entry when coming from the library, so "Back" returns to it */
        if (push) { show(cur.p, false); } else { show(cur.p, true); }
        wake();
        $('rBack').focus({ preventScroll: true });
    }

    function closeReader(fromPop) {
        if (!isOpen) { return; }
        isOpen = false; reader.hidden = true; clearTimeout(idleTimer);
        document.body.classList.remove('reader-open', 'reader-full');
        if (document.fullscreenElement && document.exitFullscreen) { document.exitFullscreen(); }
        renderLibrary();
        if (!fromPop) { try { history.pushState(null, '', location.pathname); } catch (e) { /* ignore */ } }
    }

    function go(d) {
        var total = pagesOf(cur.k).length;
        if (d > 0 && cur.p >= total) { openEnd(); return; }
        if (cur.p + d < 1) { return; }
        rEnd.hidden = true; show(cur.p + d, true); wake();
    }

    /* ---------- end of issue ---------- */
    function openEnd() {
        var keys = sortedKeys(), i = keys.indexOf(cur.k), next = i >= 0 && i < keys.length - 1 ? keys[i + 1] : null;
        rEnd.innerHTML = '';
        var box = el('div', 'notice'); box.setAttribute('data-label', 'END_OF_TRANSMISSION // ' + label(cur.k));
        if (next) {
            var b = el('button', 'btn btn--primary btn--block', 'NEXT: ' + label(next)); b.type = 'button';
            b.addEventListener('click', function () { rEnd.hidden = true; openReader(next, 1, false); });
            box.appendChild(b);
        } else { box.appendChild(el('p', 'meta', 'END OF AVAILABLE ISSUES')); }
        var a = el('a', 'btn btn--block', 'GET THIS ISSUE // AMAZON'); a.href = volumeOf(cur.k).page; box.appendChild(a);
        var l = el('button', 'btn btn--block', 'BACK TO LIBRARY'); l.type = 'button';
        l.addEventListener('click', function () { rEnd.hidden = true; goLibrary(); }); box.appendChild(l);
        var c = el('button', 'btn btn--block', 'BACK TO THE LAST PAGE'); c.type = 'button';
        c.addEventListener('click', function () { rEnd.hidden = true; wake(); }); box.appendChild(c);
        rEnd.appendChild(box); rEnd.hidden = false; reader.classList.remove('is-idle');
        l.focus({ preventScroll: true });
    }

    function goLibrary() {
        if (history.state && history.state.reader) { history.back(); } else { closeReader(false); }
    }

    /* ---------- page map ---------- */
    function buildThumbs() {
        if (rThumbs.getAttribute('data-k') === cur.k) { return; }
        rThumbs.innerHTML = ''; rThumbs.setAttribute('data-k', cur.k);
        pagesOf(cur.k).forEach(function (src, i) {
            var b = el('button', 'map-thumb'); b.type = 'button'; b.setAttribute('data-p', i + 1);
            var im = new Image(); im.loading = 'lazy'; im.decoding = 'async'; im.alt = ''; im.src = src;
            b.appendChild(im); b.appendChild(el('span', '', String(i + 1)));
            b.addEventListener('click', function () { show(i + 1, true); if (window.innerWidth < 1024) { toggleMap(false); } });
            rThumbs.appendChild(b);
        });
    }
    function markThumb() {
        Array.prototype.forEach.call(rThumbs.children, function (b) { b.classList.toggle('is-current', Number(b.getAttribute('data-p')) === cur.p); });
    }
    function toggleMap(open) {
        if (open === undefined) { open = rMapPanel.hidden; }
        rMapPanel.hidden = !open;
        reader.classList.toggle('has-map', open);
        if (open) {
            buildThumbs(); markThumb(); reader.classList.remove('is-idle'); clearTimeout(idleTimer);
            var c = rThumbs.querySelector('.is-current'); if (c && c.scrollIntoView) { c.scrollIntoView({ block: 'center' }); }
        } else { wake(); }
    }

    /* ---------- zoom, fullscreen ---------- */
    function toggleZoom() { reader.classList.toggle('is-zoomed'); rBox.scrollTop = 0; rBox.scrollLeft = 0; }
    function toggleFull() {
        if (document.fullscreenEnabled && reader.requestFullscreen) {
            if (document.fullscreenElement) { document.exitFullscreen(); } else { reader.requestFullscreen(); }
        } else { document.body.classList.toggle('reader-full'); }
    }

    /* ---------- events ---------- */
    $('rBack').addEventListener('click', goLibrary);
    $('rPrev').addEventListener('click', function () { go(-1); });
    $('rNext').addEventListener('click', function () { go(1); });
    $('rZoneL').addEventListener('click', function () { go(-1); });
    $('rZoneR').addEventListener('click', function () { go(1); });
    $('rZoneC').addEventListener('click', function () { reader.classList.toggle('is-idle'); if (!reader.classList.contains('is-idle')) { wake(); } });
    $('rZoom').addEventListener('click', toggleZoom);
    $('rMap').addEventListener('click', function () { toggleMap(); });
    $('rMapClose').addEventListener('click', function () { toggleMap(false); });
    $('rFull').addEventListener('click', toggleFull);
    rIssue.addEventListener('change', function () { openReader(rIssue.value, 1, false); });
    rRange.addEventListener('input', function () { rEnd.hidden = true; show(Number(rRange.value), true); });
    rBox.addEventListener('dblclick', toggleZoom);

    ['mousemove', 'touchstart', 'keydown'].forEach(function (ev) { reader.addEventListener(ev, wake, { passive: true }); });

    /* swipe */
    var sx = 0, sy = 0;
    rBox.addEventListener('touchstart', function (e) { var t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
    rBox.addEventListener('touchend', function (e) {
        if (reader.classList.contains('is-zoomed')) { return; }
        var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { go(dx < 0 ? 1 : -1); }
    }, { passive: true });

    document.addEventListener('keydown', function (e) {
        if (!isOpen || e.target === rIssue) { return; }
        var k = e.key;
        if (k === 'Escape') {
            if (!rEnd.hidden) { rEnd.hidden = true; wake(); }
            else if (!rMapPanel.hidden) { toggleMap(false); }
            else if (reader.classList.contains('is-zoomed')) { toggleZoom(); }
            else if (!document.fullscreenElement) { goLibrary(); }
        }
        else if (e.target === rRange && (k === 'ArrowRight' || k === 'ArrowLeft')) { return; }
        else if (k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && e.target.tagName !== 'BUTTON')) { e.preventDefault(); go(1); }
        else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); go(-1); }
        else if (k === 'Home' && e.target !== rRange) { show(1, true); }
        else if (k === 'End' && e.target !== rRange) { show(pagesOf(cur.k).length, true); }
        else if (k === 'f' || k === 'F') { toggleFull(); }
        else if (k === 'm' || k === 'M') { toggleMap(); }
        else if (k === 'z' || k === 'Z') { toggleZoom(); }
    });

    window.addEventListener('popstate', function () { route(true); });

    /* ---------- start ---------- */
    function route(fromPop) {
        var q = new URLSearchParams(location.search), k = q.get('issue'), p = parseInt(q.get('page'), 10);
        if (k && COMICS_DATABASE[k]) { openReader(k, p || 1, false); }
        else if (isOpen) { closeReader(fromPop); }
    }

    buildIssueSelect();
    renderLibrary();
    route(false);
})();
