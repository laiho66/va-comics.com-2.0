/* ==========================================================================
   VA COMICS // site.js
   Shared navigation + footer + mobile menu behaviour for ALL pages.
   Edit the menu / footer HERE and every page updates automatically.
   ========================================================================== */
(function () {
    'use strict';

    /* ---------- EDIT ZONE: menu labels (change here, not in the pages) ---------- */
    var LABELS = {
        vol1: 'VOL 1 (ISSUES 1-8)',
        vol2: 'VOL 2 (ISSUES 9-13)',
        news: 'NEWS'            /* menu name for the /chronicles page (news and field reports) */
    };

    /* VANGUARD CHRONICLES in the menu.
       Keep SHOW_VANGUARD = false until the Vanguard pages exist AND have content.
       When they are ready: set it to true and list the books that are live
       (one line per book, comma between lines). */
    var SHOW_VANGUARD = false;
    var VANGUARD_BOOKS = [
        { label: 'BOOK 1', href: '/vanguard/book1.html' }
        /* , { label: 'BOOK 2', href: '/vanguard/book2.html' } */
        /* , { label: 'BOOK 3', href: '/vanguard/book3.html' } */
    ];

    /* 18+ NOTICE: shown ONLY on pages whose address starts with one of these.
       (New adult-rated page? add its address here.) */
    var ADULT_PATHS = ['/deaddrop', '/media/viewer', '/media/video'];
    /* --------------------------------------------------------------------------- */

    var MOBILE_BP = 1024;
    function isMobile() { return window.innerWidth < MOBILE_BP; }

    /* Normalise the URL so it works with and without ".html" (Cloudflare Pages
       serves /about.html as /about). Result examples: "/", "/about",
       "/deaddrop", "/deaddrop/vol1", "/media/viewer" */
    var path = location.pathname
        .replace(/\.html$/, '')
        .replace(/\/index$/, '/')
        .replace(/(.)\/$/, '$1');

    var inDead = path.indexOf('/deaddrop') === 0;
    var inMedia = path === '/media' || path.indexOf('/media/') === 0;
    var inVanguard = path.indexOf('/vanguard') === 0;
    var inProjects = path === '/projects' || inDead || inVanguard;

    function act(cond) { return cond ? ' active' : ''; }

    /* ---------- VANGUARD CHRONICLES branch (hidden while SHOW_VANGUARD is false) ---------- */
    var vanguardHtml = '';
    if (SHOW_VANGUARD) {
        var books = '';
        for (var b = 0; b < VANGUARD_BOOKS.length; b++) {
            var bookPath = VANGUARD_BOOKS[b].href.replace(/\.html$/, '');
            books += '<li class="' + (path === bookPath ? 'active' : '') + '">' +
                '<a href="' + VANGUARD_BOOKS[b].href + '" class="vol-link">&raquo; ' + VANGUARD_BOOKS[b].label + '</a></li>';
        }
        vanguardHtml =
            '<li class="dropdown-item has-sub-dropdown' + act(inVanguard) + '">' +
            '<a href="/vanguard/index.html" class="sub-nav-link mobile-expandable">&gt; VANGUARD CHRONICLES</a>' +
            '<ul class="dropdown-level-2">' + books + '</ul></li>';
    }

    /* ---------- NAVIGATION (injected immediately, no flash) ---------- */
    var navHtml =
        '<ul class="main-menu">' +

        '<li class="menu-item' + act(path === '/') + '">' +
        '<a href="/index.html" class="nav-link"><span class="node-num">[01]</span> HOME</a></li>' +

        '<li class="menu-item has-dropdown' + act(inProjects) + '">' +
        '<a href="/projects.html" class="nav-link mobile-expandable"><span class="node-num">[02]</span> PROJECTS</a>' +
        '<ul class="dropdown-level-1">' +
        '<li class="dropdown-item has-sub-dropdown' + act(inDead) + '">' +
        '<a href="/deaddrop/index.html" class="sub-nav-link mobile-expandable">&gt; DEAD DROP</a>' +
        '<ul class="dropdown-level-2">' +
        '<li class="' + (path === '/deaddrop/vol1' ? 'active' : '') + '"><a href="/deaddrop/vol1.html" class="vol-link">&raquo; ' + LABELS.vol1 + '</a></li>' +
        '<li class="' + (path === '/deaddrop/vol2' ? 'active' : '') + '"><a href="/deaddrop/vol2.html" class="vol-link">&raquo; ' + LABELS.vol2 + '</a></li>' +
        '</ul></li>' + vanguardHtml + '</ul></li>' +

        '<li class="menu-item' + act(path === '/chronicles') + '">' +
        '<a href="/chronicles.html" class="nav-link"><span class="node-num">[03]</span> ' + LABELS.news + '</a></li>' +

        '<li class="menu-item has-dropdown' + act(inMedia) + '">' +
        '<a href="/media.html" class="nav-link mobile-expandable"><span class="node-num">[04]</span> MEDIA</a>' +
        '<ul class="dropdown-level-1">' +
        '<li><a href="/media/music.html" class="sub-nav-link">&raquo; MUSIC</a></li>' +
        '<li><a href="/media/video.html" class="sub-nav-link">&raquo; VIDEO</a></li>' +
        '<li><a href="/media/viewer.html" class="sub-nav-link">&raquo; VIEWER</a></li>' +
        '</ul></li>' +

        '<li class="menu-item' + act(path === '/about') + '">' +
        '<a href="/about.html" class="nav-link"><span class="node-num">[05]</span> ABOUT US</a></li>' +

        '<li class="menu-item' + act(path === '/contact') + '">' +
        '<a href="/contact.html" class="nav-link"><span class="node-num">[06]</span> CONTACT</a></li>' +

        '</ul>';

    var navEl = document.getElementById('globalNav');
    if (navEl) { navEl.innerHTML = navHtml; }

    /* ---------- FOOTER ---------- */
    function buildFooter() {
        var f = document.getElementById('siteFooter');
        if (!f) { return; }
        function legal(href, label, isCurrent) {
            return '<a href="' + href + '" class="legal-link"' +
                (isCurrent ? ' style="color: var(--text-colorless);"' : '') + '>' + label + '</a>';
        }
        f.innerHTML =
            '<div class="hud-status-bar"><span class="status-indicator"></span> // SYS_STATUS: OPERATIONAL [MAGMA_ACTIVE]</div>' +
            '<div class="legal-bindings">' +
            legal('/terms.html', '// LEGAL_BINDINGS', path === '/terms') +
            legal('/privacy.html', '// DATA_ENCRYPTION_POLICY', path === '/privacy') +
            legal('/cookies.html', '// SIGNAL_TRACKING_PROTOCOL', path === '/cookies') +
            '</div>';
    }

    /* ---------- MOBILE MENU ---------- */
    function initMobile() {
        var nav = document.getElementById('globalNav');
        var btn = document.querySelector('.mobile-bunker-toggle');
        if (!nav || !btn) { return; }

        btn.setAttribute('aria-controls', 'globalNav');
        btn.setAttribute('aria-expanded', 'false');

        function closeDropdowns() {
            var open = nav.querySelectorAll('.dropdown-open');
            for (var i = 0; i < open.length; i++) { open[i].classList.remove('dropdown-open'); }
        }

        function setOpen(open) {
            nav.classList.toggle('mobile-open', open);
            btn.textContent = open ? '[ X ] CLOSE_MENU' : '[ = ] SYS_MENU';
            btn.style.color = open ? '#FF4500' : '#ffffff';
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            if (open) {
                /* auto-expand the branch of the page we are on */
                var branches = nav.querySelectorAll('.menu-item.active > .dropdown-level-1, .dropdown-item.active > .dropdown-level-2');
                for (var i = 0; i < branches.length; i++) { branches[i].classList.add('dropdown-open'); }
            } else {
                closeDropdowns();
            }
        }

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            setOpen(!nav.classList.contains('mobile-open'));
        });

        /* First tap on PROJECTS / DEAD DROP / MEDIA opens its submenu,
           second tap follows the link. */
        nav.addEventListener('click', function (e) {
            if (!isMobile()) { return; }
            var link = e.target.closest ? e.target.closest('a.mobile-expandable') : null;
            if (!link) { return; }
            var sub = link.nextElementSibling;
            if (sub && !sub.classList.contains('dropdown-open')) {
                e.preventDefault();
                sub.classList.add('dropdown-open');
            }
        });

        /* tap outside = close */
        document.addEventListener('click', function (e) {
            if (isMobile() && nav.classList.contains('mobile-open') &&
                !nav.contains(e.target) && !btn.contains(e.target)) {
                setOpen(false);
            }
        });
    }

    /* ---------- DESKTOP PARALLAX (only on pages that had it before) ---------- */
    function initParallax() {
        var b = document.body;
        if (!(b.classList.contains('home-page') || b.hasAttribute('data-parallax'))) { return; }
        if (!window.matchMedia('(min-width: 1024px)').matches) { return; }
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { return; }
        var bg = document.querySelector('.bunker-bg-overlay');
        var side = document.querySelector('.sidebar-nav');
        if (!bg || !side) { return; }
        side.style.transition = 'transform 0.1s ease-out';
        window.addEventListener('mousemove', function (e) {
            var x = e.clientX / window.innerWidth - 0.5;
            var y = e.clientY / window.innerHeight - 0.5;
            bg.style.transform = 'translate(' + (x * -20) + 'px, ' + (y * -20) + 'px)';
            side.style.transform = 'translate(' + (x * 10) + 'px, ' + (y * 10) + 'px)';
        });
    }


    /* ---------- 18+ NOTICE (shown once per browser) ---------- */
    function initAgeGate() {
        var gated = false;
        for (var g = 0; g < ADULT_PATHS.length; g++) {
            if (path.indexOf(ADULT_PATHS[g]) === 0) { gated = true; break; }
        }
        if (!gated) { return; }

        var KEY = 'vacomics_18plus';
        try { if (window.localStorage.getItem(KEY) === '1') { return; } } catch (e) { /* storage blocked: show it */ }

        var css = document.createElement('style');
        css.textContent =
            '.age-gate{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,0.96);}' +
            '.age-gate-box{position:relative;width:100%;max-width:520px;padding:38px 32px 30px;background:#050505;border:1px solid rgba(255,69,0,0.4);box-shadow:0 0 30px rgba(255,69,0,0.15);text-align:center;font-family:Arial,sans-serif;}' +
            '.age-gate-tag{position:absolute;top:-10px;left:20px;background:#050505;padding:0 10px;font-family:"Courier New",Courier,monospace;font-size:11px;letter-spacing:1px;color:#FF4500;}' +
            '.age-gate-box h2{margin:0 0 14px;font-size:22px;letter-spacing:3px;text-transform:uppercase;color:#ffffff;}' +
            '.age-gate-box p{margin:0 0 26px;font-size:15px;line-height:1.6;color:#dddddd;}' +
            '.age-gate-actions{display:flex;flex-wrap:wrap;gap:12px;}' +
            '.age-btn{flex:1 1 200px;display:block;padding:14px 16px;background:transparent;border:1px solid #ffffff;color:#ffffff;font-family:"Courier New",Courier,monospace;font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;text-decoration:none;cursor:pointer;transition:all 0.3s ease;}' +
            '.age-btn-enter{border-color:#FF4500;color:#FF4500;}' +
            '.age-btn:hover,.age-btn:focus{background:#000000;border-color:#FF4500;color:#FF4500;box-shadow:0 0 15px rgba(255,69,0,0.3);outline:none;}';
        document.head.appendChild(css);

        var gate = document.createElement('div');
        gate.className = 'age-gate';
        gate.setAttribute('role', 'dialog');
        gate.setAttribute('aria-modal', 'true');
        gate.setAttribute('aria-labelledby', 'ageGateTitle');
        gate.innerHTML =
            '<div class="age-gate-box">' +
            '<div class="age-gate-tag">// RESTRICTED_ACCESS</div>' +
            '<h2 id="ageGateTitle">Mature content // 18+</h2>' +
            '<p>This website and the Dead Drop comics contain graphic violence, explicit language and mature themes. By entering you confirm that you are at least 18 years old.</p>' +
            '<div class="age-gate-actions">' +
            '<button type="button" class="age-btn age-btn-enter">[ I AM 18+ // ENTER ]</button>' +
            '<a class="age-btn" href="https://www.google.com/" rel="noopener">[ LEAVE ]</a>' +
            '</div></div>';
        document.body.appendChild(gate);

        var prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        var enter = gate.querySelector('.age-btn-enter');
        enter.addEventListener('click', function () {
            try { window.localStorage.setItem(KEY, '1'); } catch (e) { /* ignore */ }
            document.body.removeChild(gate);
            document.body.style.overflow = prevOverflow;
        });
        enter.focus();
    }

    function init() {
        buildFooter();
        initMobile();
        initParallax();
        initAgeGate();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
