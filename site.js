/* ==========================================================================
   VA COMICS v3.2 // site.js
   Builds the menu, the top bar (phone), the background, the breadcrumb and the
   footer on EVERY page, and shows the 18+ notice on the pages that need it.
   You edit the menu / links HERE and every page changes.
   ========================================================================== */
(function () {
    'use strict';

    /* ============================ EDIT ZONE ============================ */

    var SITE = {
        name: 'VA COMICS',
        year: 2026,
        facebook: 'https://www.facebook.com/vacomics66',
        x: 'https://x.com/VAComics'
    };

    /* Dead Drop: add a line here when a new volume appears (comma between lines). */
    var DEADDROP_VOLUMES = [
        { label: 'VOL 1', href: '/deaddrop/vol1.html' },
        { label: 'VOL 2', href: '/deaddrop/vol2.html' }
        /* , { label: 'VOL 3', href: '/deaddrop/vol3.html' } */
    ];

    /* Vanguard Chronicles: add a line here when a new book appears. */
    var SHOW_VANGUARD = true;
    var VANGUARD_BOOKS = [
        { label: 'BOOK 1', href: '/vanguard/book1.html' },
        { label: 'BOOK 2', href: '/vanguard/book2.html' }
    ];

    /* The 18+ notice is shown ONLY on pages whose address starts with one of these. */
    var ADULT_PATHS = ['/deaddrop', '/media/viewer', '/media/video', '/media/talk'];

    /* ================================================================== */

    var MENU = [
        { n: '01', label: 'HOME', href: '/index.html' },
        { n: '02', label: 'START HERE', href: '/start.html' },
        {
            n: '03', label: 'PROJECTS', href: '/projects.html', base: ['/deaddrop', '/vanguard'],
            groups: [
                { label: 'DEAD DROP', href: '/deaddrop/index.html',
                  items: DEADDROP_VOLUMES.concat([{ label: 'CHARACTERS', href: '/deaddrop/characters.html' }]) }
            ].concat(SHOW_VANGUARD ? [
                { label: 'VANGUARD CHRONICLES', href: '/vanguard/index.html',
                  items: VANGUARD_BOOKS.concat([{ label: 'CHARACTERS', href: '/vanguard/characters.html' }]) }
            ] : [])
        },
        { n: '04', label: 'NEWS', href: '/chronicles.html' },
        {
            n: '05', label: 'MEDIA', href: '/media.html', base: ['/media'],
            groups: [{ label: null, items: [
                { label: 'VIDEO', href: '/media/video.html' },
                { label: 'VIEWER', href: '/media/viewer.html' },
                { label: 'READING ROOM', href: '/media/reader.html' }
            ] }]
        },
        {
            n: '06', label: 'ABOUT US', href: '/about.html', base: ['/about', '/qa'],
            groups: [{ label: null, items: [
                { label: 'ABOUT US', href: '/about.html' },
                { label: 'Q&A', href: '/qa.html' }
            ] }]
        },
        { n: '07', label: 'CONTACT', href: '/contact.html' }
    ];

    /* ---------- helpers ---------- */

    /* "/about.html" and "/about" and "/deaddrop/index.html" and "/deaddrop/" are normalised
       so they compare equal: "/about", "/deaddrop", "/" */
    function norm(p) {
        return String(p).split('?')[0].split('#')[0]
            .replace(/\.html$/, '').replace(/\/index$/, '/').replace(/(.)\/$/, '$1') || '/';
    }
    var path = norm(location.pathname);

    function same(href) { return norm(href) === path; }
    function under(base) { var b = norm(base); return path === b || path.indexOf(b + '/') === 0; }
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

    function isCurrentTop(it) {
        if (same(it.href)) { return true; }
        if (it.base) { for (var i = 0; i < it.base.length; i++) { if (under(it.base[i])) { return true; } } }
        return false;
    }

    /* ---------- menu ---------- */
    function buildNav() {
        var html = '<div class="nav-brand">VA_COMICS // SYS</div>' +
            '<button type="button" class="nav-search" data-va-search aria-label="Search the site (shortcut: /)">[ / ] SEARCH</button><ul class="nav-list">';
        MENU.forEach(function (it) {
            var cur = isCurrentTop(it);
            var hasSub = !!it.groups;
            html += '<li class="nav-item' + (hasSub ? ' has-sub' : '') + (cur ? ' is-current is-open' : '') + '">';
            html += '<a class="nav-link" href="' + it.href + '"' + (same(it.href) ? ' aria-current="page"' : '') +
                '><span class="nav-num">[' + it.n + ']</span><span class="nav-text">' + esc(it.label) + '</span></a>';
            if (hasSub) {
                html += '<button type="button" class="nav-toggle" aria-expanded="' + (cur ? 'true' : 'false') +
                    '" aria-label="Open the ' + esc(it.label) + ' submenu"></button><div class="nav-panel">';
                it.groups.forEach(function (g) {
                    html += '<div class="nav-group">';
                    if (g.label) {
                        html += '<a class="nav-grouplink' + (same(g.href) ? ' is-current' : '') + '" href="' + g.href + '">&gt; ' + esc(g.label) + '</a>';
                    }
                    if (g.items) {
                        html += '<div class="nav-subitems">';
                        g.items.forEach(function (s) {
                            html += '<a' + (same(s.href) ? ' class="is-current" aria-current="page"' : '') + ' href="' + s.href + '">&raquo; ' + esc(s.label) + '</a>';
                        });
                        html += '</div>';
                    }
                    html += '</div>';
                });
                html += '</div>';
            }
            html += '</li>';
        });
        html += '</ul><div class="nav-social"><a href="' + SITE.facebook + '" target="_blank" rel="noopener noreferrer">// FACEBOOK</a>' +
            '<a href="' + SITE.x + '" target="_blank" rel="noopener noreferrer">// X</a></div>';
        return html;
    }

    var nav = document.getElementById('siteNav');
    if (nav) { nav.innerHTML = buildNav(); }

    /* ---------- background layer + top bar (phone) ---------- */
    var layer = document.createElement('div');
    layer.className = 'bg-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(layer, document.body.firstChild);
    if (!document.body.getAttribute('data-bg')) { document.body.setAttribute('data-bg', 'wall'); }

    var bar = document.createElement('header');
    bar.className = 'topbar';
    bar.innerHTML = '<a class="topbar-brand" href="/index.html">' + SITE.name + '</a>' +
        '<span class="topbar-actions"><button type="button" class="topbar-search" data-va-search aria-label="Search the site"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2.6" stroke-linecap="square"/></svg></button>' +
        '<button type="button" class="topbar-btn" aria-expanded="false" aria-controls="siteNav">[ &equiv; MENU ]</button></span>';
    document.body.insertBefore(bar, layer.nextSibling);

    /* ---------- search: the code (/assets/search.js) loads only when someone opens it ---------- */
    function openSearch() {
        if (window.VASearch) { window.VASearch.open(); return; }
        if (document.getElementById('vaSearchScript')) { return; }
        var sc = document.createElement('script');
        sc.id = 'vaSearchScript'; sc.src = '/assets/search.js?v=1';
        sc.onload = function () { if (window.VASearch) { window.VASearch.open(); } };
        document.head.appendChild(sc);
    }
    document.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('[data-va-search]') : null;
        if (!b) { return; }
        e.preventDefault();
        if (document.body.classList.contains('menu-open')) { var mb = document.querySelector('.topbar-btn'); if (mb) { mb.click(); } }
        openSearch();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) { return; }
        var t = e.target, tag = (t && t.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) { return; }
        e.preventDefault(); openSearch();
    });

    /* ---------- MALAKH: the cyan launcher on every page (except Foundry) ----------
       The chat itself (/assets/malakh.js + malakh.css) loads only on the first click,
       or right away if a channel was left open on the previous page (it follows the reader). */
    function loadMalakh(then) {
        if (window.VAMalakh) { then(); return; }
        if (!document.getElementById('vaMalakhCss')) {
            var css = document.createElement('link'); css.id = 'vaMalakhCss'; css.rel = 'stylesheet'; css.href = '/assets/malakh.css?v=1';
            document.head.appendChild(css);
        }
        loadMalakh.wait = then;                       /* only the last click counts while it loads */
        if (!document.getElementById('vaMalakhScript')) {
            var sc = document.createElement('script'); sc.id = 'vaMalakhScript'; sc.src = '/assets/malakh.js?v=1';
            sc.onload = function () { if (window.VAMalakh && loadMalakh.wait) { var f = loadMalakh.wait; loadMalakh.wait = null; f(); } };
            document.head.appendChild(sc);
        }
    }
    function initMalakh() {
        if (path.indexOf('/foundry') === 0) { return; }
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'malakh-launcher';
        if (path.indexOf('/media/viewer') === 0 || path.indexOf('/media/reader') === 0) { b.classList.add('is-mini'); }
        b.setAttribute('aria-label', 'Talk to MALAKH, the VA Comics AI');
        b.setAttribute('aria-expanded', 'false');
        b.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">' +
            '<rect x="3" y="3" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
            '<path class="mk-l-wave" d="M6 16h4l2-6 3 12 3-9 2 5 2-2h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="miter" stroke-linecap="square"/></svg>' +
            '<span class="malakh-launcher-tip">MALAKH // ASK</span>';
        document.body.appendChild(b);
        b.addEventListener('click', function () { loadMalakh(function () { window.VAMalakh.toggle(); }); });
        var st = null;
        try { st = JSON.parse(sessionStorage.getItem('malakh_v1') || 'null'); } catch (e) { /* ignore */ }
        if (st && st.token && st.expires * 1000 > Date.now()) {
            b.classList.add('is-live');
            if (st.open) { loadMalakh(function () { window.VAMalakh.open(); }); }
        }
    }

    /* ---------- breadcrumb: trail built from the menu ---------- */
    function trail(as) {
        var t = null;
        var same = function (href) { return norm(href) === (as ? norm(as) : path); };   /* "as" = build the trail of another page */
        MENU.forEach(function (it) {
            if (t) { return; }
            if (same(it.href) && it.href !== '/index.html') { t = [{ l: it.label, h: null }]; return; }
            (it.groups || []).forEach(function (g) {
                if (t) { return; }
                if (g.label && same(g.href)) { t = [{ l: it.label, h: it.href }, { l: g.label, h: null }]; return; }
                (g.items || []).forEach(function (s) {
                    if (t) { return; }
                    if (same(s.href)) {
                        t = [{ l: it.label, h: it.href }];
                        if (g.label) { t.push({ l: g.label, h: g.href }); }
                        t.push({ l: s.label, h: null });
                    }
                });
            });
        });
        return t;
    }

    function buildCrumbs() {
        var el = document.getElementById('crumbs');
        if (!el) { return; }
        var t = trail();
        /* a page that is not in the menu (issue pages): <nav id="crumbs" data-parent="/deaddrop/vol1.html" data-label="ISSUE #01">
           = the trail of the parent page + this label */
        var par = el.getAttribute('data-parent'), lab = el.getAttribute('data-label');
        if (!t && par && lab) {
            t = trail(par);
            if (t) { t[t.length - 1].h = par; t.push({ l: lab, h: null }); }
        }
        if (!t) { el.hidden = true; return; }
        var html = '<ol><li><a href="/index.html">' + SITE.name + '</a></li>';
        t.forEach(function (c, i) {
            html += '<li' + (i === t.length - 1 ? ' aria-current="page"' : '') + '>' +
                (c.h && i < t.length - 1 ? '<a href="' + c.h + '">' + esc(c.l) + '</a>' : esc(c.l)) + '</li>';
        });
        el.setAttribute('aria-label', 'Breadcrumb');
        el.innerHTML = html + '</ol>';
    }

    /* ---------- footer ---------- */
    function buildFooter() {
        var f = document.getElementById('siteFooter');
        if (!f) { return; }
        f.innerHTML = '<span><span class="status-dot"></span>SYS_STATUS: OPERATIONAL // &copy; ' + SITE.year + ' ' + SITE.name + '</span>' +
            '<nav aria-label="Footer"><a href="/legal.html">// LEGAL</a>' +
            '<a href="' + SITE.facebook + '" target="_blank" rel="noopener noreferrer">// FACEBOOK</a>' +
            '<a href="' + SITE.x + '" target="_blank" rel="noopener noreferrer">// X</a>' +
            '<a href="/feed.xml" type="application/rss+xml">// RSS</a></nav>';
    }

    /* ---------- menu behaviour ---------- */
    function initMenu() {
        var btn = document.querySelector('.topbar-btn');
        if (!nav || !btn) { return; }

        function setOpen(open) {
            nav.classList.toggle('is-open', open);
            document.body.classList.toggle('menu-open', open && window.innerWidth < 1024);
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            btn.innerHTML = open ? '[ X ] CLOSE' : '[ &equiv; MENU ]';
        }
        btn.addEventListener('click', function () { setOpen(!nav.classList.contains('is-open')); });

        /* arrows open/close one submenu (phone, tablet, touch) */
        nav.addEventListener('click', function (e) {
            var t = e.target.closest ? e.target.closest('.nav-toggle') : null;
            if (!t) { return; }
            var item = t.parentNode;
            var open = !item.classList.contains('is-open');
            item.classList.toggle('is-open', open);
            t.setAttribute('aria-expanded', open ? 'true' : 'false');
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); btn.focus(); }
        });
        window.addEventListener('resize', function () {
            if (window.innerWidth >= 1024 && nav.classList.contains('is-open')) { setOpen(false); }
        });
    }

    /* ---------- images fade in ---------- */
    function initFade() {
        var imgs = document.querySelectorAll('img.fade');
        for (var i = 0; i < imgs.length; i++) {
            (function (im) {
                if (im.complete && im.naturalWidth) { im.classList.add('is-loaded'); return; }
                im.addEventListener('load', function () { im.classList.add('is-loaded'); });
                im.addEventListener('error', function () { im.classList.add('is-loaded'); });
            })(imgs[i]);
        }
    }

    /* ---------- 18+ notice ----------
       Shown once per browser, only on ADULT_PATHS.
       Testing: open any page with ?gate=1 to force it, even if you already confirmed. */
    function initAgeGate() {
        var KEY = 'vacomics_18plus';
        var forced = /[?&]gate=1\b/.test(location.search);
        var gated = false;
        for (var i = 0; i < ADULT_PATHS.length; i++) { if (path.indexOf(norm(ADULT_PATHS[i])) === 0) { gated = true; break; } }
        if (!gated && !forced) { return; }
        if (!forced) { try { if (window.localStorage.getItem(KEY) === '1') { return; } } catch (e) { /* storage blocked: show it */ } }

        var gate = document.createElement('div');
        gate.className = 'age-gate';
        gate.setAttribute('role', 'dialog');
        gate.setAttribute('aria-modal', 'true');
        gate.setAttribute('aria-labelledby', 'ageGateTitle');
        gate.innerHTML =
            '<div class="age-gate-box"><div class="tag">// RESTRICTED_ACCESS</div>' +
            '<h2 id="ageGateTitle">Mature content // 18+</h2>' +
            '<p>This part of the website and the Dead Drop comics contain graphic violence, explicit language and mature themes. By entering you confirm that you are at least 18 years old.</p>' +
            '<div class="age-gate-actions"><button type="button" class="btn btn--primary" id="ageEnter">I AM 18+ // ENTER</button>' +
            '<a class="btn" href="https://www.google.com/" rel="noopener">LEAVE</a></div></div>';
        document.body.appendChild(gate);
        document.body.classList.add('gate-open');

        var enter = document.getElementById('ageEnter');
        enter.addEventListener('click', function () {
            try { window.localStorage.setItem(KEY, '1'); } catch (e) { /* ignore */ }
            document.body.removeChild(gate);
            document.body.classList.remove('gate-open');
        });
        enter.focus();
    }

    function init() {
        buildCrumbs();
        buildFooter();
        initMenu();
        initFade();
        initAgeGate();
        initMalakh();
    }

    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
    else { init(); }
})();
