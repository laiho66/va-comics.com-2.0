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
        { label: 'BOOK 1', href: '/vanguard/book1.html' }
        /* , { label: 'BOOK 2', href: '/vanguard/book2.html' } */
    ];

    /* The 18+ notice is shown ONLY on pages whose address starts with one of these. */
    var ADULT_PATHS = ['/deaddrop', '/media/viewer', '/media/video'];

    /* ================================================================== */

    var MENU = [
        { n: '01', label: 'HOME', href: '/index.html' },
        {
            n: '02', label: 'PROJECTS', href: '/projects.html', base: ['/deaddrop', '/vanguard'],
            groups: [
                { label: 'DEAD DROP', href: '/deaddrop/index.html',
                  items: DEADDROP_VOLUMES.concat([{ label: 'CHARACTERS', href: '/deaddrop/characters.html' }]) }
            ].concat(SHOW_VANGUARD ? [
                { label: 'VANGUARD CHRONICLES', href: '/vanguard/index.html',
                  items: VANGUARD_BOOKS.concat([{ label: 'CHARACTERS', href: '/vanguard/characters.html' }]) }
            ] : [])
        },
        { n: '03', label: 'NEWS', href: '/chronicles.html' },
        {
            n: '04', label: 'MEDIA', href: '/media.html', base: ['/media'],
            groups: [{ label: null, items: [
                { label: 'VIDEO', href: '/media/video.html' },
                { label: 'VIEWER', href: '/media/viewer.html' }
            ] }]
        },
        { n: '05', label: 'ABOUT US', href: '/about.html' },
        { n: '06', label: 'CONTACT', href: '/contact.html' }
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
        var html = '<div class="nav-brand">VA_COMICS // SYS</div><ul class="nav-list">';
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
        '<button type="button" class="topbar-btn" aria-expanded="false" aria-controls="siteNav">[ &equiv; MENU ]</button>';
    document.body.insertBefore(bar, layer.nextSibling);

    /* ---------- breadcrumb: trail built from the menu ---------- */
    function trail() {
        var t = null;
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
            '<a href="' + SITE.x + '" target="_blank" rel="noopener noreferrer">// X</a></nav>';
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
    }

    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
    else { init(); }
})();
